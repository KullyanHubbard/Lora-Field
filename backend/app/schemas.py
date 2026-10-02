from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from .language_preferences import Language


class SensorReadingIn(BaseModel):
    soil_moisture: float = Field(..., ge=0, le=100)
    soil_temp: float = Field(..., ge=-20, le=80)
    air_temp: float = Field(..., ge=-20, le=80)
    air_humidity: float = Field(..., ge=0, le=100)
    battery: float | None = Field(default=None, ge=0, le=100, description="Persentase baterai node, kalau perangkat melaporkannya")
    rssi: float | None = Field(default=None, ge=-150, le=0, description="Kuat sinyal paket ini (dBm), diukur gateway saat menerima")
    farm_id: str | None = Field(default=None, description="Wajib untuk node yang belum terdaftar (self-registration)")


# Pesan MQTT dari gateway (docs/kontrak-mqtt.md). Tidak dipakai route HTTP.
DEVICE_ID_PATTERN = r"^[A-Za-z0-9_-]{4,32}$"


class MqttReadingIn(SensorReadingIn):
    valve: Literal["open", "closed"] = Field(..., description="Posisi valve sebenarnya di node")


# Batas nama node, sama untuk ganti nama di web dan nama dari gateway.
NODE_NAME_MAX_LENGTH = 40


class MqttNodeItem(BaseModel):
    node_id: str = Field(..., pattern=DEVICE_ID_PATTERN)
    # Nama lebih panjang dari NODE_NAME_MAX_LENGTH tetap diterima lalu dipotong saat disimpan,
    # supaya node tetap terdaftar.
    name: str = Field(default="", max_length=100)


class MqttNodeList(BaseModel):
    nodes: list[MqttNodeItem]


class NodeLocationUpdate(BaseModel):
    location: str = Field(..., min_length=3)
    region: str = Field(default="", max_length=80)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class NodeNameUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=NODE_NAME_MAX_LENGTH)


class ThresholdConfig(BaseModel):
    lower: float = Field(default=40, ge=0, le=100)
    upper: float = Field(default=70, ge=0, le=100)


class IrrigationModeUpdate(BaseModel):
    mode: Literal["auto", "manual"]


GroundCover = Literal["open", "mulch", "roofed"]


class ValveCommandUpdate(BaseModel):
    open: bool


class LimitedIrrigationStart(BaseModel):
    reason: Literal["flowering", "harvest", "other"]
    until: datetime = Field(..., description="Batas selesai; tanpa zona dianggap UTC")


class LimitedIrrigationUpdate(BaseModel):
    until: datetime = Field(..., description="Batas selesai baru; tanpa zona dianggap UTC")


class GatewayClaimPayload(BaseModel):
    device_id: str = Field(..., min_length=4, max_length=64)
    display_name: str = Field(default="", max_length=100)


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    owner: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    crop_type: str = Field(default="", max_length=100)
    area_ha: float | None = Field(default=None, ge=0)
    bmkg_adm4_code: str = Field(default="", max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    gateway_device_id: str = Field(..., min_length=4, max_length=64)
    gateway_display_name: str = Field(default="", max_length=100)
    ground_cover: GroundCover = "open"


class FarmUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    owner: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    crop_type: str | None = Field(default=None, max_length=100)
    area_ha: float | None = Field(default=None, ge=0)
    bmkg_adm4_code: str | None = Field(default=None, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: str | None = Field(default=None, max_length=30)
    ground_cover: GroundCover | None = None


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    language: Language = "en"


class RegisterVerifyRequest(UserRegister):
    token: str = Field(..., pattern=r"^\d{6}$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    language: Language = "en"


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: str = ""
    language: Language


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetCodeVerifyRequest(BaseModel):
    email: EmailStr
    token: str = Field(..., pattern=r"^\d{6}$")


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str = Field(..., pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class UpdateProfileRequest(BaseModel):
    phone: str | None = Field(default=None, max_length=20)


class UserResponse(BaseModel):
    user: UserPublic


class LanguagePreferenceUpdate(BaseModel):
    language: Language


class LanguagePreferenceResponse(BaseModel):
    language: Language
