"""JSON API の入出力。"""

from pydantic import BaseModel, Field


class WeatherBrief(BaseModel):
    """走行に付いた気象の要約。"""

    temperature_c: float
    humidity_pct: float
    observed_at: str
    wbgt_c: float | None = None


class RunOut(BaseModel):
    """走行記録のレスポンス。"""

    id: int
    started_at: str
    distance_km: float
    duration_sec: int
    hours: int
    minutes: int
    seconds: int
    avg_heart_rate: int | None
    notes: str | None
    pace_sec_per_km: float
    weather: WeatherBrief | None
    hr_zone: str | None = None
    amedas_station_id: str | None = None
    amedas_station_name: str | None = None


class RunWrite(BaseModel):
    """走行記録の作成・更新。"""

    started_at: str
    distance_km: float = Field(gt=0)
    hours: int = Field(ge=0, le=23)
    minutes: int = Field(ge=0, le=59)
    seconds: int = Field(ge=0, le=59)
    avg_heart_rate: int | None = None
    notes: str | None = None
    amedas_station_id: str | None = None


class IntensityOut(BaseModel):
    """走行強度の定義。"""

    key: str
    label: str
    target_hr: int | None
    distance_km: float | None = None


class IntensityHrs(BaseModel):
    """強度別心拍。"""

    low: int | None = None
    medium: int | None = None
    high: int | None = None
    race_5k: int | None = None
    race_10k: int | None = None
    race_half: int | None = None
    race_full: int | None = None


class ProfileOut(BaseModel):
    """設定画面用。"""

    display_name: str | None
    birthday: str | None
    age: int | None
    max_heart_rate: int | None
    color_rows: bool
    color_rows_effective: bool
    intensities: IntensityHrs
    suggested: IntensityHrs
    custom_intensities: list[IntensityOut]
    race_options: list[IntensityOut]
    amedas_station_id: str
    amedas_station_name: str
    wbgt_ready_count: int = 0
    run_count: int = 0


class ProfileWrite(BaseModel):
    """設定の保存。確認ダイアログ後の確定値を送る。"""

    display_name: str | None = None
    birthday: str | None = None
    max_heart_rate: int | None = None
    color_rows: bool = True
    intensities: IntensityHrs = IntensityHrs()
    amedas_station_id: str | None = None


class AmedasStationOut(BaseModel):
    """設定用のアメダス地点。"""

    station_id: str
    name: str
    latitude: float
    longitude: float


class SimilarRunOut(BaseModel):
    """予測根拠の過去走。"""

    record_id: int
    started_at: str
    distance_km: float
    duration_sec: int
    pace_sec_per_km: float
    avg_heart_rate: int | None
    temperature_c: float
    humidity_pct: float
    wbgt_c: float
    weather_distance: float
    wbgt_delta: float


class ForecastOut(BaseModel):
    """使った予報。"""

    observed_at: str
    temperature_c: float
    humidity_pct: float
    location_label: str
    wind_ms: float | None = None
    solar_wm2: float | None = None
    wbgt_c: float | None = None


class PredictIn(BaseModel):
    """予測リクエスト。"""

    distance_km: float | None = Field(default=None, gt=0)
    distance_mode: str = "custom"
    race: str | None = None
    mode: str = "manual"
    temperature_c: float | None = None
    humidity_pct: float | None = None
    forecast_at: str | None = None
    intensity: str = "medium"
    amedas_station_id: str | None = None


class PredictOut(BaseModel):
    """予測レスポンス。"""

    predicted_pace_sec_per_km: float
    predicted_duration_sec: int
    predicted_heart_rate: float | None
    confidence: str
    sample_count: int
    near_count: int
    intensity_key: str
    intensity_label: str
    used_runs: list[SimilarRunOut]
    condition: ForecastOut | None = None
    weather_distance_help: str
