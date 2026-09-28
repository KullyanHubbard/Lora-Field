"""Route /api/auth: registrasi, login, profil, ganti password, dan reset lewat OTP."""

import logging
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..config import settings
from ..database import get_connection, row_to_dict
from ..deps import client_ip
from ..language_preferences import ensure_user_language, resolve_language, set_user_language
from ..mailer import build_reset_email_html, reset_email_subject, send_email_via_resend
from ..schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    Language,
    LanguagePreferenceResponse,
    LanguagePreferenceUpdate,
    ResetCodeVerifyRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserLogin,
    UserPublic,
    UserRegister,
    UserResponse,
)

logger = logging.getLogger("lorafield")
router = APIRouter()

RESET_TOKEN_EXPIRE_MINUTES = 30
RESET_MAX_ATTEMPTS = 5
RESET_REQUESTS_PER_DAY = 5
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_MINUTES = 15

# Kunci = id user, jadi hanya email terdaftar yang dicatat: jumlah catatan tidak bisa
# melebihi jumlah user walau dibanjiri email acak. (Email terdaftar memang sudah
# terlihat dari 409 register.)
# ponytail: in-memory per proses, reset saat server restart. Pindah ke tabel DB kalau
# backend dijalankan dengan lebih dari satu worker.
_login_failures: dict[str, list[datetime]] = {}
_reset_requests: dict[str, list[datetime]] = {}
_limits_lock = threading.Lock()


def _recent(events: dict[str, list[datetime]], key: str, window: timedelta) -> list[datetime]:
    cutoff = datetime.now(timezone.utc) - window
    recent = [moment for moment in events.get(key, []) if moment > cutoff]
    events[key] = recent
    return recent


def _take_slot(events: dict[str, list[datetime]], key: str, window: timedelta, limit: int) -> bool:
    """Jatah diambil SEBELUM password dicek, supaya permintaan paralel tidak bisa lolos bersamaan."""
    with _limits_lock:
        recent = _recent(events, key, window)
        if len(recent) >= limit:
            return False
        recent.append(datetime.now(timezone.utc))
        return True


def generate_reset_code(connection) -> str:
    # 6 digit OTP, ulangi jika kebetulan bentrok dengan token lain yang masih ada.
    for _ in range(20):
        code = f"{secrets.randbelow(1_000_000):06d}"
        exists = connection.execute(
            "SELECT 1 FROM password_resets WHERE token = ? LIMIT 1",
            (code,),
        ).fetchone()
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Gagal membuat token reset. Silakan coba lagi.")


def check_reset_code(email: str, token: str) -> dict:
    email = email.lower().strip()
    now_iso = datetime.now(timezone.utc).isoformat()
    error = ""
    reset_row = None
    # Jangan raise di dalam blok with: get_connection() me-rollback saat exception, jadi
    # hitungan attempts tidak akan tersimpan. Error disimpan dulu, raise setelah commit.
    with get_connection() as connection:
        # Kunci tulis sejak awal supaya cek kode paralel antre dan hitungan salah tidak terlewati.
        connection.execute("BEGIN IMMEDIATE")
        user = connection.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if user is not None:
            reset_row = row_to_dict(
                connection.execute(
                    """
                    SELECT id, user_id, token, expires_at, attempts
                    FROM password_resets
                    WHERE user_id = ? AND used = 0
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (user["id"],),
                ).fetchone()
            )
        if reset_row is None:
            error = "Kode reset tidak valid."
        # Bandingkan bytes: digit Unicode (mis. angka lebar penuh) lolos pola \d dan bikin compare_digest(str) error.
        elif not secrets.compare_digest(str(reset_row["token"]).encode(), token.encode()):
            attempts = int(reset_row["attempts"]) + 1
            exhausted = attempts >= RESET_MAX_ATTEMPTS
            connection.execute(
                "UPDATE password_resets SET attempts = ?, used = ? WHERE id = ?",
                (attempts, 1 if exhausted else 0, reset_row["id"]),
            )
            error = "Kode reset salah terlalu banyak. Minta kode baru." if exhausted else "Kode reset tidak valid."
        elif str(reset_row["expires_at"]) <= now_iso:
            error = "Kode reset sudah kedaluwarsa."
    if error:
        raise HTTPException(status_code=400, detail=error)
    return reset_row


@router.post("/api/auth/register", response_model=UserPublic, status_code=201)
def register(payload: UserRegister, request: Request) -> dict:
    email = payload.email.lower().strip()
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Nama minimal 2 karakter (tanpa spasi awal/akhir).")
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            logger.info("register | email-conflict | ip=%s email=%s", client_ip(request), email)
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.")

        user_id = f"user-{uuid.uuid4().hex[:12]}"
        try:
            connection.execute(
                """
                INSERT INTO users (id, email, name, password_hash, language)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, email, name, hash_password(payload.password), payload.language),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Email sudah terdaftar.")

    logger.info("register | success | ip=%s email=%s user_id=%s", client_ip(request), email, user_id)
    return {"id": user_id, "email": email, "name": name, "language": payload.language}


@router.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request) -> dict:
    email = payload.email.lower().strip()
    ip = client_ip(request)
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, email, name, phone, language, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    user = row_to_dict(row)
    if not user:
        logger.warning("login | failed | ip=%s email=%s", ip, email)
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    # Dicek sebelum password: selama terkunci, password benar pun ditolak.
    if not _take_slot(_login_failures, user["id"], timedelta(minutes=LOGIN_LOCK_MINUTES), LOGIN_MAX_FAILURES):
        logger.warning("login | locked | ip=%s user_id=%s", ip, user["id"])
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak percobaan login. Coba lagi dalam {LOGIN_LOCK_MINUTES} menit.",
        )
    if not verify_password(payload.password, user["password_hash"]):
        logger.warning("login | failed | ip=%s email=%s", ip, email)
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    with _limits_lock:
        _login_failures.pop(user["id"], None)

    with get_connection() as connection:
        language = ensure_user_language(
            connection,
            user["id"],
            user.get("language"),
            payload.language,
        )

    token = create_access_token(subject=user["id"])
    logger.info("login | success | ip=%s user_id=%s", ip, user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone") or "",
            "language": language,
        },
    }


@router.get("/api/auth/me", response_model=UserPublic)
def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
    browser_language: Language = Query(default="en"),
) -> dict:
    with get_connection() as connection:
        language = ensure_user_language(
            connection,
            current_user["id"],
            current_user.get("language"),
            browser_language,
        )
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "phone": current_user.get("phone") or "",
        "language": language,
    }


@router.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    ip = client_ip(request)
    with get_connection() as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
        if not row or not verify_password(payload.current_password, row["password_hash"]):
            logger.warning("change-password | wrong-current | ip=%s user_id=%s", ip, current_user["id"])
            raise HTTPException(status_code=401, detail="Password saat ini salah.")
        if verify_password(payload.new_password, row["password_hash"]):
            raise HTTPException(status_code=422, detail="Password baru tidak boleh sama dengan password lama.")
        connection.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(payload.new_password), current_user["id"]),
        )
    logger.info("change-password | success | ip=%s user_id=%s", ip, current_user["id"])
    return {"message": "Password berhasil diperbarui."}


@router.patch("/api/auth/profile", response_model=UserResponse)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    browser_language: Language = Query(default="en"),
) -> dict:
    with get_connection() as connection:
        # Tanpa bahasa browser, akun lama yang language-nya kosong dipaksa ke default.
        ensure_user_language(
            connection,
            current_user["id"],
            current_user.get("language"),
            browser_language,
        )
        if payload.phone is not None:
            connection.execute(
                "UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (payload.phone.strip(), current_user["id"]),
            )
        user = row_to_dict(
            connection.execute(
                "SELECT id, email, name, phone, language FROM users WHERE id = ?",
                (current_user["id"],),
            ).fetchone()
        )
    return {"user": user}


@router.patch(
    "/api/auth/preferences/language",
    response_model=LanguagePreferenceResponse,
)
def update_language_preference(
    payload: LanguagePreferenceUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    with get_connection() as connection:
        set_user_language(connection, current_user["id"], payload.language)
    return {"language": payload.language}


@router.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request) -> dict:
    email = payload.email.lower().strip()
    ip = client_ip(request)
    logger.info("forgot-password | request | ip=%s email=%s", ip, email)
    with get_connection() as connection:
        user = row_to_dict(
            connection.execute(
                "SELECT id, email, name, language FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        )

        # Jangan bocorkan apakah email ada/tidak.
        if user is None:
            logger.info("forgot-password | unknown-email | ip=%s email=%s", ip, email)
            return {"message": "Jika email terdaftar, tautan reset password akan dikirim."}

        # Raise di sini aman walau di dalam blok with: belum ada tulisan DB yang ikut ter-rollback.
        if not _take_slot(_reset_requests, user["id"], timedelta(days=1), RESET_REQUESTS_PER_DAY):
            logger.warning("forgot-password | limited | ip=%s user_id=%s", ip, user["id"])
            raise HTTPException(status_code=429, detail="Terlalu sering meminta kode reset. Coba lagi besok.")

        # Hanya boleh ada satu OTP aktif per user, jadi token lama dimatikan dulu.
        connection.execute(
            "UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0",
            (user["id"],),
        )
        reset_token = generate_reset_code(connection)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).isoformat()
        connection.execute(
            """
            INSERT INTO password_resets (user_id, token, expires_at, used)
            VALUES (?, ?, ?, 0)
            """,
            (user["id"], reset_token, expires_at),
        )

    # Link hanya dari FRONTEND_URL. Header Host request bisa dipalsukan, jadi tidak dipakai
    # untuk membangun link (mencegah reset link diarahkan ke situs lain).
    # Email dibawa di fragmen (#) supaya halaman reset langsung membuka isian kode, tanpa
    # meminta kode baru yang menghanguskan kode di email ini. Fragmen tidak ikut terkirim ke server.
    reset_link = (
        f"{settings.frontend_url.rstrip('/')}/reset-password#email={quote(user['email'], safe='')}"
        if settings.frontend_url
        else None
    )
    language = resolve_language(user.get("language"))
    email_html = build_reset_email_html(
        reset_token, reset_link, RESET_TOKEN_EXPIRE_MINUTES, language
    )

    email_sent = False
    try:
        email_sent = send_email_via_resend(user["email"], reset_email_subject(language), email_html)
    except Exception:
        email_sent = False

    response = {"message": "Jika email terdaftar, tautan reset password akan dikirim."}
    if not email_sent and settings.expose_dev_tokens:
        response["reset_token"] = reset_token
        response["note"] = "Email provider belum aktif. Gunakan kode reset ini untuk pengujian."
    return response


@router.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request) -> dict:
    token = payload.token.strip()
    ip = client_ip(request)
    reset_row = check_reset_code(payload.email, token)
    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (hash_password(payload.new_password), reset_row["user_id"]),
        )
        connection.execute(
            "UPDATE password_resets SET used = 1 WHERE id = ?",
            (reset_row["id"],),
        )

    logger.info("reset-password | success | ip=%s user_id=%s", ip, reset_row["user_id"])
    return {"message": "Password berhasil diperbarui."}


@router.post("/api/auth/reset-password/verify")
def verify_reset_code(payload: ResetCodeVerifyRequest) -> dict:
    check_reset_code(payload.email, payload.token.strip())
    return {"message": "Kode reset valid."}
