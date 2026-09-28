from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]

APP_VERSION = "1.3.0"


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
    # Alamat pengirim dari domain yang sudah diverifikasi di Resend. Kosong = email
    # tidak dikirim (sengaja tanpa default, pengirim uji Resend hanya sampai ke pemilik akun).
    resend_from_email: str = ""

    # URL publik frontend untuk link di email reset. Kosong = email tanpa tombol link.
    frontend_url: str = ""

    # Node dianggap offline kalau tidak mengirim data selama ini.
    node_offline_after_minutes: int = 15

    # Valve yang dibuka manual ditutup otomatis setelah selama ini, kalau lupa dihentikan.
    manual_irrigation_max_minutes: int = 30

    # Cache cuaca lama masih dipakai sebagai cadangan selama umurnya <= ini, kalau BMKG gangguan.
    weather_stale_max_hours: int = 12

    # Siram bertahap mode otomatis: valve buka satu pulsa, lalu tutup menunggu air meresap.
    auto_pulse_minutes: int = 10
    auto_soak_minutes: int = 30
    # Batas pulsa per siklus. Kalau tanah belum juga cukup basah, siklus baru ditunda selama jeda.
    auto_max_pulses: int = 4
    auto_limit_cooldown_hours: int = 3
    # Siklus berhenti di batas atas dikurangi ini, supaya air sisa resapan tidak membuat tanah kelewat basah.
    auto_target_margin: float = 5
    # Di bawah batas bawah dikurangi ini, tanah dianggap darurat dan prediksi hujan diabaikan.
    rain_emergency_margin: float = 15
    # Total prakiraan hujan (mm, jumlah tp di jendela cek hujan) minimal untuk menunda siram.
    rain_delay_min_mm: float = 5

    # Origins yang diizinkan untuk CORS. Pisah dengan koma di .env:
    #   ALLOWED_ORIGINS=https://app.lorafield.com,https://www.lorafield.com
    allowed_origins: str = ""

    # Broker MQTT untuk gateway (docs/kontrak-mqtt.md). Kosong = jembatan MQTT nonaktif.
    mqtt_host: str = ""
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    # Alat masih melapor posisi valve lain selama ini sejak perintah terakhir dikirim: kirim ulang perintahnya.
    valve_resend_minutes: int = 5

    # Saat True, forgot-password mengembalikan OTP di response kalau email belum terkirim.
    # Hanya untuk pengujian lokal, jangan pernah aktif di production.
    expose_dev_tokens: bool = False


settings = Settings()
