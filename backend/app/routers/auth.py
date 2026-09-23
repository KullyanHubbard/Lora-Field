"""Route /api/auth: registrasi, login, profil, ganti password, dan reset lewat OTP."""

import logging
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..config import settings
from ..database import get_connection, row_to_dict
from ..deps import client_ip
from ..language_preferences import ensure_user_language, set_user_language
from ..mailer import build_reset_email_html, send_email_via_resend
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


def get_active_reset_row(connection, token: str) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    reset_row = row_to_dict(
        connection.execute(
            """
            SELECT id, user_id, token, expires_at, used
            FROM password_resets
            WHERE token = ?
            """,
            (token,),
        ).fetchone()
    )
    if reset_row is None:
        raise HTTPException(status_code=400, detail="Kode reset tidak valid.")
    if int(reset_row["used"]) == 1:
        raise HTTPException(status_code=400, detail="Kode reset sudah digunakan.")
    if str(reset_row["expires_at"]) <= now_iso:
        raise HTTPException(status_code=400, detail="Kode reset sudah kedaluwarsa.")
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
    if not user or not verify_password(payload.password, user["password_hash"]):
        logger.warning("login | failed | ip=%s email=%s", ip, email)
        raise HTTPException(status_code=401, detail="Email atau password salah.")

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
                "SELECT id, email, name FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        )

        # Jangan bocorkan apakah email ada/tidak.
        if user is None:
            logger.info("forgot-password | unknown-email | ip=%s email=%s", ip, email)
            return {"message": "Jika email terdaftar, tautan reset password akan dikirim."}

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

    frontend_base = settings.frontend_url.rstrip("/")
    reset_link = f"{frontend_base}/reset-password"
    email_html = build_reset_email_html(reset_token, reset_link, RESET_TOKEN_EXPIRE_MINUTES)

    email_sent = False
    try:
        email_sent = send_email_via_resend(user["email"], "Reset Password LoraField", email_html)
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
    with get_connection() as connection:
        reset_row = get_active_reset_row(connection, token)
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
    token = payload.token.strip()
    with get_connection() as connection:
        get_active_reset_row(connection, token)
    return {"message": "Kode reset valid."}
