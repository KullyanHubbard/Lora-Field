from pydantic import BaseModel, EmailStr, Field


class SensorReadingIn(BaseModel):
    soil_moisture: float = Field(..., ge=0, le=100)
    soil_temp: float = Field(..., ge=-20, le=80)
    air_temp: float = Field(..., ge=-20, le=80)
    air_humidity: float = Field(..., ge=0, le=100)
    farm_id: str | None = Field(default=None, description="Required for first-time node self-registration")


class NodeLocationUpdate(BaseModel):
    location: str = Field(..., min_length=3)
    region: str = Field(default="", max_length=80)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ThresholdConfig(BaseModel):
    lower: float = Field(default=40, ge=0, le=100)
    upper: float = Field(default=70, ge=0, le=100)


class GatewayLogIn(BaseModel):
    event: str = Field(..., min_length=1, max_length=50)
    detail: str = Field(default="", max_length=300)


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    owner: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    crop_type: str = Field(default="", max_length=100)
    area_ha: float | None = Field(default=None, ge=0)
    bmkg_adm4_code: str = Field(default="", max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


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


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetCodeVerifyRequest(BaseModel):
    token: str = Field(..., pattern=r"^\d{6}$")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class UpdateProfileRequest(BaseModel):
    phone: str = Field(default="", max_length=20)


# ---------------------------------------------------------------------------
# Auto Node Discovery - Gateway Registration Models
# ---------------------------------------------------------------------------

class NodeRegistrationItem(BaseModel):
    """Single node to register via gateway batch endpoint."""
    node_id: str
    name: str
    region: str = ""
    latitude: float | None = None
    longitude: float | None = None


class GatewayRegisterPayload(BaseModel):
    """Request body for gateway batch node registration."""
    farm_id: str
    nodes: list[NodeRegistrationItem]


class RegisteredNode(BaseModel):
    """Response for a single registered node."""
    id: str
    name: str
    status: str  # "pending" | "active"
    created: bool


class GatewayRegisterResponse(BaseModel):
    """Response for gateway batch registration."""
    gateway_id: str
    farm_id: str
    status: str  # "registered"
    nodes: list[RegisteredNode]
    created_count: int


class NodeSelfRegistrationResponse(BaseModel):
    """Response for node self-registration via readings."""
    node_created: bool
    node_id: str
    node_status: str  # "pending" | "active"
