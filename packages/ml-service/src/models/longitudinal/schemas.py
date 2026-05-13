"""Pydantic v2 schemas for longitudinal health analysis."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class MetricType(StrEnum):
    """Supported wearable / clinical metric types."""

    HEART_RATE = "heart_rate"
    BLOOD_PRESSURE_SYSTOLIC = "bp_systolic"
    BLOOD_PRESSURE_DIASTOLIC = "bp_diastolic"
    SPO2 = "spo2"
    BLOOD_GLUCOSE = "blood_glucose"
    STEPS = "steps"
    SLEEP_HOURS = "sleep_hours"
    WEIGHT_KG = "weight_kg"
    TEMPERATURE = "temperature"
    RESPIRATORY_RATE = "respiratory_rate"
    HRV_MS = "hrv_ms"


class AlertSeverity(StrEnum):
    """Health alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class DataPoint(BaseModel):
    """A single time-series data point from a wearable or clinical record."""

    timestamp: datetime
    value: float
    metric: MetricType
    source: str | None = Field(None, description="Data source, e.g. 'apple_watch', 'glucometer'.")
    quality: float = Field(default=1.0, ge=0.0, le=1.0, description="Signal quality score.")


class LongitudinalInput(BaseModel):
    """Input for longitudinal health analysis."""

    patient_id: str = Field(..., min_length=1, max_length=64)
    metrics: list[DataPoint] = Field(..., min_length=1)
    analysis_window_days: int = Field(default=30, ge=1, le=365)
    include_forecasts: bool = Field(default=True)
    chronic_conditions: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    age_years: int | None = Field(None, ge=0, le=150)
    sex: str | None = Field(None, pattern=r"^(male|female|other)$")
    request_id: str | None = None

    @field_validator("metrics")
    @classmethod
    def sort_metrics_by_timestamp(cls, v: list[DataPoint]) -> list[DataPoint]:
        """Ensure metrics are sorted chronologically."""
        return sorted(v, key=lambda dp: dp.timestamp)


class TrendResult(BaseModel):
    """Trend analysis for a single metric."""

    metric: MetricType
    direction: str = Field(..., description="'improving', 'stable', 'worsening', or 'insufficient_data'.")
    slope: float = Field(..., description="Linear regression slope.")
    r_squared: float = Field(..., ge=0.0, le=1.0)
    rolling_mean_7d: float | None = None
    rolling_std_7d: float | None = None
    volatility_index: float | None = Field(None, ge=0.0, description="Coefficient of variation.")
    circadian_score: float | None = Field(None, ge=0.0, le=1.0, description="Regularity of diurnal pattern.")
    min_value: float
    max_value: float
    current_value: float
    sample_count: int


class ForecastPoint(BaseModel):
    """Predicted future value for a metric."""

    timestamp: datetime
    predicted_value: float
    lower_bound: float
    upper_bound: float
    confidence: float = Field(..., ge=0.0, le=1.0)


class HealthAlert(BaseModel):
    """Generated health alert from longitudinal analysis."""

    alert_id: str
    severity: AlertSeverity
    metric: MetricType
    title: str
    description: str
    threshold_value: float | None = None
    actual_value: float | None = None
    guideline_reference: str | None = Field(None, description="AHA, WHO, etc. guideline citation.")
    recommended_action: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LongitudinalOutput(BaseModel):
    """Output from the longitudinal health analyzer."""

    request_id: str | None = None
    patient_id: str
    analysis_window_days: int
    trends: list[TrendResult] = Field(default_factory=list)
    forecasts: dict[str, list[ForecastPoint]] = Field(default_factory=dict)
    alerts: list[HealthAlert] = Field(default_factory=list)
    overall_health_score: float | None = Field(None, ge=0.0, le=100.0)
    summary: str = Field(..., max_length=5000)
    model_used: str
    processing_time_ms: float
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TrendRequest(BaseModel):
    """Request body for trend analysis endpoint."""

    metrics: list[MetricType] = Field(default_factory=list, description="Specific metrics to analyze; empty = all.")
    window_days: int = Field(default=30, ge=1, le=365)
    include_forecasts: bool = True
