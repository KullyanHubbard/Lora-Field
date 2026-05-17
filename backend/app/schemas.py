from pydantic import BaseModel, Field


class SensorReadingIn(BaseModel):
    soil_moisture: float = Field(..., ge=0, le=100)
    soil_temp: float = Field(..., ge=-20, le=80)
    air_temp: float = Field(..., ge=-20, le=80)
    air_humidity: float = Field(..., ge=0, le=100)


class NodeLocationUpdate(BaseModel):
    location: str = Field(..., min_length=3)
    region: str = Field(default="", max_length=80)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class ThresholdConfig(BaseModel):
    lower: float = Field(default=40, ge=0, le=100)
    upper: float = Field(default=70, ge=0, le=100)


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    user_id: str = Field(..., min_length=1, max_length=50)
    owner: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=200)
    crop_type: str = Field(default="", max_length=100)
    area_ha: float | None = Field(default=None, ge=0)
    bmkg_adm4_code: str = Field(..., min_length=2, max_length=20)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
