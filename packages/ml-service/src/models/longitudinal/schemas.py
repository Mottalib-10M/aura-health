"""Pydantic v2 schemas for longitudinal health analysis."""

from __future__ import annotations

from datetime import datetime, timezone
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


class BiometricMetrics(BaseModel):
    """Structured biometric data container (mirrors TypeScript BiometricMetrics)."""

    heart_rate: list[DataPoint] = Field(default_factory=list)
    blood_pressure_systolic: list[DataPoint] = Field(default_factory=list)
    blood_pressure_diastolic: list[DataPoint] = Field(default_factory=list)
    spo2: list[DataPoint] = Field(default_factory=list)
    blood_glucose: list[DataPoint] = Field(default_factory=list)
    temperature: list[DataPoint] = Field(default_factory=list)
    respiratory_rate: list[DataPoint] = Field(default_factory=list)
    steps: list[DataPoint] = Field(default_factory=list)
    sleep_hours: list[DataPoint] = Field(default_factory=list)
    weight_kg: list[DataPoint] = Field(default_factory=list)
    hrv_ms: list[DataPoint] = Field(default_factory=list)

    def to_flat_list(self) -> list[DataPoint]:
        """Flatten all metric lists into a single sorted list."""
        all_points: list[DataPoint] = []
        for field_name in self.model_fields:
            points = getattr(self, field_name)
            if isinstance(points, list):
                all_points.extend(points)
        return sorted(all_points, key=lambda dp: dp.timestamp)


class LongitudinalInput(BaseModel):
    """Input for longitudinal health analysis."""

    patient_id: str = Field(..., min_length=1, max_length=64)
    metrics: list[DataPoint] | BiometricMetrics = Field(..., min_length=1)
    analysis_window_days: int = Field(default=30, ge=1, le=365)
    include_forecasts: bool = Field(default=True)
    chronic_conditions: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    age_years: int | None = Field(None, ge=0, le=150)
    sex: str | None = Field(None, pattern=r"^(male|female|other)$")
    request_id: str | None = None

    @field_validator("metrics")
    @classmethod
    def sort_metrics_by_timestamp(cls, v: list[DataPoint] | BiometricMetrics) -> list[DataPoint] | BiometricMetrics:
        """Ensure metrics are sorted chronologically."""
        if isinstance(v, BiometricMetrics):
            return v
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Anomaly(BaseModel):
    """Detected anomaly in a metric time-series (mirrors TypeScript)."""

    metric: MetricType
    timestamp: datetime
    value: float
    expected_range_low: float
    expected_range_high: float
    severity: AlertSeverity
    description: str


class RiskAssessment(BaseModel):
    """Risk assessment for a health condition (mirrors TypeScript)."""

    condition: str
    risk_level: str = Field(..., description="'low', 'moderate', 'high', 'critical'.")
    probability: float = Field(..., ge=0.0, le=1.0)
    contributing_factors: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class LongitudinalOutput(BaseModel):
    """Output from the longitudinal health analyzer."""

    request_id: str | None = None
    patient_id: str
    analysis_window_days: int
    trends: list[TrendResult] = Field(default_factory=list)
    anomalies: list[Anomaly] = Field(default_factory=list, description="Detected anomalies.")
    risk_assessments: list[RiskAssessment] = Field(default_factory=list, description="Risk assessments.")
    forecasts: dict[str, list[ForecastPoint]] = Field(default_factory=dict)
    alerts: list[HealthAlert] = Field(default_factory=list)
    overall_health_score: float | None = Field(None, ge=0.0, le=100.0)
    confidence_score: float | None = Field(None, ge=0.0, le=1.0, description="Overall analysis confidence.")
    summary: str = Field(..., max_length=5000)
    model_used: str
    processing_time_ms: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class TrendRequest(BaseModel):
    """Request body for trend analysis endpoint."""

    metrics: list[MetricType] = Field(default_factory=list, description="Specific metrics to analyze; empty = all.")
    window_days: int = Field(default=30, ge=1, le=365)
    include_forecasts: bool = True
