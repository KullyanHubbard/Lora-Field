from pydantic import BaseModel, Field


class SensorReadingIn(BaseModel):
    soil_moisture: float = Field(..., ge=0, le=100)
    soil_temp: float = Field(..., ge=-20, le=80)
    air_temp: float = Field(..., ge=-20, le=80)
    air_humidity: float = Field(..., ge=0, le=100)


class WeatherUpdate(BaseModel):
    location: str = Field(default="Bantul, D.I. Yogyakarta", min_length=3)
    condition: str = Field(default="Berawan", min_length=3)
    code: int = Field(default=3, ge=0)
    temperature: float = Field(default=29, ge=-20, le=80)
    humidity: int = Field(default=80, ge=0, le=100)
    rain_next_3h: bool = False


class ThresholdConfig(BaseModel):
    lower: float = Field(default=40, ge=0, le=100)
    upper: float = Field(default=70, ge=0, le=100)
