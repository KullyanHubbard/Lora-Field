from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Wajib diisi via .env di production. Kalau kosong, startup gagal dengan error jelas.
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120

    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"

    frontend_url: str = "http://localhost:8000"

    # Origins yang diizinkan untuk CORS. Pisah dengan koma di .env:
    #   ALLOWED_ORIGINS=https://app.lorafield.com,https://www.lorafield.com
    allowed_origins: str = ""

    # Saat True, forgot-password mengembalikan OTP di response kalau email belum terkirim.
    # Hanya untuk pengujian lokal, jangan pernah aktif di production.
    expose_dev_tokens: bool = False


settings = Settings()
