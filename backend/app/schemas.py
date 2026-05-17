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
