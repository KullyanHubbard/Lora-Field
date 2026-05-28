from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Wajib diisi via .env di production — kosong = startup akan gagal dengan error jelas.
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120

    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"

    frontend_url: str = "http://localhost:8000/static"

    # Origins yang diizinkan untuk CORS. Pisah dengan koma di .env:
    #   ALLOWED_ORIGINS=https://app.lorafield.com,https://www.lorafield.com
    allowed_origins: str = ""

    # Saat True, /api/auth/forgot-password akan mengembalikan token di response body
    # bila email provider belum dikonfigurasi (memudahkan pengujian lokal).
    # WAJIB False di production — default False untuk fail-secure.
    expose_dev_tokens: bool = False


settings = Settings()
