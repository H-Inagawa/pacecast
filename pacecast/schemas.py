"""JSON API の入出力。"""

from pydantic import BaseModel, Field


class WeatherBrief(BaseModel):
    """走行に付いた気象の要約。"""

    temperature_c: float
    humidity_pct: float
    observed_at: str


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


class RunWrite(BaseModel):
    """走行記録の作成・更新。"""

    started_at: str
    distance_km: float = Field(gt=0)
    hours: int = Field(ge=0, le=23)
    minutes: int = Field(ge=0, le=59)
    seconds: int = Field(ge=0, le=59)
    avg_heart_rate: int | None = None
    notes: str | None = None


class HomeOut(BaseModel):
    """ホーム画面用。"""

    run_count: int
    total_distance: float
    recent_runs: list[RunOut]
    display_name: str | None = None
    color_rows: bool = False


class WeatherRow(BaseModel):
    """1時間の観測。"""

    observed_at: str
    temperature_c: float
    humidity_pct: float
    temperature_quality: int | None
    humidity_quality: int | None


class WeatherSummary(BaseModel):
    """気象データの概要。"""

    count: int
    first: str | None
    last: str | None
    location: str
    default_csv: str


class WeatherPageOut(BaseModel):
    """気象画面用。"""

    summary: WeatherSummary
    selected_date: str
    rows: list[WeatherRow]


class ImportOut(BaseModel):
    """取り込み結果。"""

    notice: str


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


class ProfileWrite(BaseModel):
    """設定の保存。確認ダイアログ後の確定値を送る。"""

    display_name: str | None = None
    birthday: str | None = None
    max_heart_rate: int | None = None
    color_rows: bool = True
    intensities: IntensityHrs = IntensityHrs()


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
    weather_distance: float


class ForecastOut(BaseModel):
    """使った予報。"""

    observed_at: str
    temperature_c: float
    humidity_pct: float
    location_label: str


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
