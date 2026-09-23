"""Pengiriman email transaksional lewat Resend."""

import httpx

from .config import settings


def send_email_via_resend(to_email: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
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
    with httpx.Client(timeout=15) as client:
        response = client.post("https://api.resend.com/emails", headers=headers, json=payload)
        response.raise_for_status()
    return True


def build_reset_email_html(reset_token: str, reset_link: str, expire_minutes: int) -> str:
    return (
        "<div style='font-family:Arial,sans-serif;line-height:1.6;color:#111827'>"
        "<h2 style='margin:0 0 12px 0;font-size:20px'>Reset Password LoraField</h2>"
        "<p style='margin:0 0 12px 0'>Kami menerima permintaan untuk mengatur ulang password akun Anda.</p>"
        f"<p style='margin:0 0 12px 0'>Masa berlaku kode: <strong>{expire_minutes} menit</strong>.</p>"
        f"<p style='margin:0 0 14px 0'><a href=\"{reset_link}\" style='display:inline-block;padding:10px 14px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:6px'>Buka Halaman Reset</a></p>"
        f"<p style='margin:0 0 8px 0'>Masukkan kode reset berikut secara manual di halaman reset password:</p>"
        f"<p style='margin:0 0 12px 0;font-family:monospace;font-size:14px;background:#f3f4f6;padding:8px 10px;border-radius:6px;display:inline-block'>{reset_token}</p>"
        "<p style='margin:0;color:#6b7280;font-size:13px'>Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.</p>"
        "</div>"
    )
