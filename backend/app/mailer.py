"""Pengiriman email transaksional lewat Resend."""

import httpx

from .config import settings
from .language_preferences import Language


RESEND_EMAILS_URL = "https://api.resend.com/emails"
RESEND_TIMEOUT_SECONDS = 15


def send_email_via_resend(to_email: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key or not settings.resend_from_email:
        return False

    payload = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=RESEND_TIMEOUT_SECONDS) as client:
        response = client.post(RESEND_EMAILS_URL, headers=headers, json=payload)
        response.raise_for_status()
    return True


RESET_EMAIL_TEXT = {
    "id": {
        "subject": "Reset Password LoraField",
        "intro": "Kami menerima permintaan untuk mengatur ulang password akun Anda.",
        "expiry": "Masa berlaku kode: <strong>{minutes} menit</strong>.",
        "button": "Buka Halaman Reset",
        "code_hint": "Masukkan kode reset berikut secara manual di halaman reset password:",
        "ignore": "Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.",
    },
    "en": {
        "subject": "LoraField Password Reset",
        "intro": "We received a request to reset the password for your account.",
        "expiry": "This code expires in <strong>{minutes} minutes</strong>.",
        "button": "Open Reset Page",
        "code_hint": "Enter the following reset code on the reset password page:",
        "ignore": "If you did not request this, you can ignore this email.",
    },
}


def reset_email_subject(language: Language) -> str:
    return RESET_EMAIL_TEXT[language]["subject"]


# Email tidak bisa memakai token tema, klien email hanya membaca style inline.
def build_reset_email_html(
    reset_token: str, reset_link: str | None, expire_minutes: int, language: Language
) -> str:
    text = RESET_EMAIL_TEXT[language]
    # Tanpa FRONTEND_URL tombol link dihilangkan; kode tetap bisa dimasukkan di halaman reset.
    button = (
        f"<p style='margin:0 0 14px 0'><a href=\"{reset_link}\" style='display:inline-block;padding:10px 14px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:6px'>{text['button']}</a></p>"
        if reset_link
        else ""
    )
    return (
        "<div style='font-family:Arial,sans-serif;line-height:1.6;color:#111827'>"
        f"<h2 style='margin:0 0 12px 0;font-size:20px'>{text['subject']}</h2>"
        f"<p style='margin:0 0 12px 0'>{text['intro']}</p>"
        f"<p style='margin:0 0 12px 0'>{text['expiry'].format(minutes=expire_minutes)}</p>"
        f"{button}"
        f"<p style='margin:0 0 8px 0'>{text['code_hint']}</p>"
        f"<p style='margin:0 0 12px 0;font-family:monospace;font-size:14px;background:#f3f4f6;padding:8px 10px;border-radius:6px;display:inline-block'>{reset_token}</p>"
        f"<p style='margin:0;color:#6b7280;font-size:13px'>{text['ignore']}</p>"
        "</div>"
    )
