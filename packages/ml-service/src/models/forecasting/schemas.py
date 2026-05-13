"""Pydantic v2 schemas for epidemiological forecasting and supply chain."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Outbreak Detection Schemas
# ---------------------------------------------------------------------------


class AlertLevel(StrEnum):
    """Outbreak alert levels based on sigma thresholds."""

    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"


class DetectionMethod(StrEnum):
    """Statistical detection methods used in ensemble."""

    EWMA = "ewma"
    CUSUM = "cusum"
    BAYESIAN = "bayesian"


class CaseDataPoint(BaseModel):
    """Single day of case count data."""

    date: date
    count: int = Field(..., ge=0)
    source: str | None = None


class OutbreakInput(BaseModel):
    """Input for outbreak detection."""

    region: str = Field(..., min_length=1, max_length=100)
    disease_code: str = Field(..., min_length=1, max_length=20, description="ICD-10 or custom disease code.")
    case_data: list[CaseDataPoint] | None = Field(
        None,
        description="Provide explicit case data; if omitted, data is fetched from the surveillance DB.",
    )
    window_days: int = Field(default=90, ge=7, le=365)
    baseline_period_days: int = Field(default=365, ge=30, le=1825)
    request_id: str | None = None

    @field_validator("case_data")
    @classmethod
    def sort_case_data(cls, v: list[CaseDataPoint] | None) -> list[CaseDataPoint] | None:
        if v is not None:
            return sorted(v, key=lambda dp: dp.date)
        return v


class MethodResult(BaseModel):
    """Result from an individual detection method."""

    method: DetectionMethod
    score: float
    is_anomaly: bool
    details: dict[str, Any] = Field(default_factory=dict)


class ResponseAction(BaseModel):
    """Automated or recommended response action."""

    action: str
    priority: int = Field(..., ge=1, le=5)
    responsible_entity: str | None = None
    deadline_hours: int | None = None


class OutbreakResult(BaseModel):
    """Output from outbreak detection pipeline."""

    request_id: str | None = None
    region: str
    disease_code: str
    alert_level: AlertLevel
    ensemble_score: float
    sigma_deviation: float
    method_results: list[MethodResult]
    case_count_current: int
    case_count_baseline_avg: float
    percent_change: float
    recommended_actions: list[ResponseAction] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    processing_time_ms: float
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SurveillanceSummary(BaseModel):
    """Regional surveillance summary."""

    region: str
    active_alerts: list[OutbreakResult] = Field(default_factory=list)
    diseases_monitored: list[str] = Field(default_factory=list)
    total_cases_7d: int = 0
    total_cases_30d: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Supply Chain Forecasting Schemas
# ---------------------------------------------------------------------------


class SupplyHistoryPoint(BaseModel):
    """Historical supply/demand data point."""

    date: date
    demand_units: int = Field(..., ge=0)
    supply_units: int = Field(..., ge=0)
    stockout_occurred: bool = False


class ForecastMethod(StrEnum):
    """Forecasting methods used in ensemble."""

    ARIMA = "arima"
    PROPHET = "prophet"
    LSTM = "lstm"


class SupplyForecastInput(BaseModel):
    """Input for supply chain forecast."""

    pharmaceutical_id: str = Field(..., min_length=1, max_length=64)
    pharmaceutical_name: str | None = None
    region: str | None = None
    history: list[SupplyHistoryPoint] | None = Field(
        None,
        description="Explicit history; if omitted, fetched from supply DB.",
    )
    horizon_months: int = Field(default=6, ge=1, le=24)
    request_id: str | None = None


class ForecastPoint(BaseModel):
    """Single point in demand forecast."""

    date: date
    predicted_demand: float
    lower_bound: float
    upper_bound: float
    confidence: float = Field(..., ge=0.0, le=1.0)


class MethodForecast(BaseModel):
    """Forecast from a single method."""

    method: ForecastMethod
    points: list[ForecastPoint]
    mape: float | None = Field(None, ge=0.0, description="Mean Absolute Percentage Error on validation set.")
    weight: float = Field(..., ge=0.0, le=1.0, description="Weight in the ensemble.")


class StockoutRisk(BaseModel):
    """Risk assessment for pharmaceutical stockout."""

    probability: float = Field(..., ge=0.0, le=1.0)
    days_until_stockout: int | None = None
    criticality: str = Field(..., description="'low', 'medium', 'high', 'critical'.")
    current_stock_units: int
    current_stock_days: float = Field(..., description="Days of supply remaining at current consumption rate.")


class OrderRecommendation(BaseModel):
    """Recommended procurement order."""

    supplier: str | None = None
    quantity_units: int = Field(..., ge=0)
    order_by_date: date
    estimated_cost_usd: float | None = None
    priority: str = Field(..., description="'routine', 'urgent', 'emergency'.")
    rationale: str


class SupplyForecast(BaseModel):
    """Complete supply chain forecast output."""

    request_id: str | None = None
    pharmaceutical_id: str
    pharmaceutical_name: str | None = None
    ensemble_forecast: list[ForecastPoint]
    method_forecasts: list[MethodForecast]
    risk: StockoutRisk
    recommendations: list[OrderRecommendation] = Field(default_factory=list)
    processing_time_ms: float
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)
