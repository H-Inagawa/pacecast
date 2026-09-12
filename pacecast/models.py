"""永続化するエンティティ定義。"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pacecast.db import Base


class WeatherObservation(Base):
    """1時間ごとの気象観測。"""

    __tablename__ = "weather_observations"
    __table_args__ = (
        UniqueConstraint("observed_at", "station_id", name="uq_weather_observed_station"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(64), nullable=False)
    temperature_c: Mapped[float] = mapped_column(Float, nullable=False)
    humidity_pct: Mapped[float] = mapped_column(Float, nullable=False)
    temperature_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    humidity_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wind_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    solar_wm2: Mapped[float | None] = mapped_column(Float, nullable=True)
    wbgt_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    wbgt_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    station_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="open-meteo")
    imported_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    running_records: Mapped[list["RunningRecord"]] = relationship(back_populates="weather")


class RunningRecord(Base):
    """1回のランニング記録。"""

    __tablename__ = "running_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    duration_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    amedas_station_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    amedas_station_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    weather_observation_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("weather_observations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    weather: Mapped[WeatherObservation | None] = relationship(back_populates="running_records")

    @property
    def pace_sec_per_km(self) -> float:
        """
        キロあたり秒数を返す。

        Returns:
            走行時間を距離で割ったペース（秒/km）。
        """
        return self.duration_sec / self.distance_km


class UserProfile(Base):
    """単一ユーザーの設定。"""

    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color_rows: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    row_color_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="hr")
    hr_low: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_medium: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_high: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_race_5k: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_race_10k: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_race_half: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hr_race_full: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amedas_station_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    amedas_station_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class AuthUser(Base):
    """ログイン用のアカウント。走行データは user_profiles の単一行を共有する。"""

    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    verifications: Mapped[list["EmailVerification"]] = relationship(back_populates="user")


class EmailVerification(Base):
    """新規登録のメール確認トークン。"""

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("auth_users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped[AuthUser] = relationship(back_populates="verifications")
