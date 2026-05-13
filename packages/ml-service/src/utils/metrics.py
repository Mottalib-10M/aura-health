"""Prometheus metrics for the Aura ML Service."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, Info

# ---------------------------------------------------------------------------
# Service info
# ---------------------------------------------------------------------------
SERVICE_INFO = Info(
    "aura_ml_service",
    "Aura Health ML Service build information",
)

# ---------------------------------------------------------------------------
# HTTP request metrics
# ---------------------------------------------------------------------------
REQUEST_COUNT = Counter(
    "aura_ml_http_requests_total",
    "Total HTTP requests received",
    labelnames=["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "aura_ml_http_request_duration_seconds",
    "HTTP request latency in seconds",
    labelnames=["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

REQUESTS_IN_PROGRESS = Gauge(
    "aura_ml_http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    labelnames=["method", "endpoint"],
)

# ---------------------------------------------------------------------------
# Model inference metrics
# ---------------------------------------------------------------------------
MODEL_INFERENCE_DURATION = Histogram(
    "aura_ml_model_inference_duration_seconds",
    "Model inference latency in seconds",
    labelnames=["model_name", "task_type"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)

MODEL_INFERENCE_COUNT = Counter(
    "aura_ml_model_inference_total",
    "Total model inference calls",
    labelnames=["model_name", "task_type", "status"],
)

MODEL_INFERENCE_ERRORS = Counter(
    "aura_ml_model_inference_errors_total",
    "Total model inference errors",
    labelnames=["model_name", "task_type", "error_type"],
)

MODEL_FALLBACK_COUNT = Counter(
    "aura_ml_model_fallback_total",
    "Number of times a fallback model was used",
    labelnames=["primary_model", "fallback_model", "task_type"],
)

# ---------------------------------------------------------------------------
# Triage-specific metrics
# ---------------------------------------------------------------------------
TRIAGE_CONFIDENCE = Histogram(
    "aura_ml_triage_confidence_score",
    "Distribution of triage confidence scores",
    labelnames=["severity", "model_name"],
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9, 0.95, 1.0),
)

TRIAGE_SEVERITY_COUNT = Counter(
    "aura_ml_triage_severity_total",
    "Triage outcomes by severity level",
    labelnames=["severity"],
)

TRIAGE_REJECTIONS = Counter(
    "aura_ml_triage_rejections_total",
    "Triage outputs rejected due to low confidence",
    labelnames=["reason"],
)

# ---------------------------------------------------------------------------
# OCR / credentialing metrics
# ---------------------------------------------------------------------------
OCR_PROCESSING_DURATION = Histogram(
    "aura_ml_ocr_processing_duration_seconds",
    "OCR document processing latency",
    labelnames=["document_type", "model_name"],
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

OCR_TAMPERING_DETECTIONS = Counter(
    "aura_ml_ocr_tampering_detections_total",
    "Documents flagged for potential tampering",
    labelnames=["document_type", "detection_method"],
)

# ---------------------------------------------------------------------------
# Forecasting metrics
# ---------------------------------------------------------------------------
FORECAST_ALERTS = Counter(
    "aura_ml_forecast_alerts_total",
    "Forecasting alerts generated",
    labelnames=["alert_level", "region", "disease_code"],
)

FORECAST_PROCESSING_DURATION = Histogram(
    "aura_ml_forecast_processing_duration_seconds",
    "Forecasting pipeline processing latency",
    labelnames=["forecast_type"],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
)

# ---------------------------------------------------------------------------
# LLM cost tracking
# ---------------------------------------------------------------------------
LLM_TOKEN_USAGE = Counter(
    "aura_ml_llm_token_usage_total",
    "Total tokens consumed by LLM calls",
    labelnames=["model_name", "token_type"],
)

LLM_COST_USD = Counter(
    "aura_ml_llm_cost_usd_total",
    "Estimated LLM inference cost in USD",
    labelnames=["model_name", "task_type"],
)

# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------
ACTIVE_MODELS = Gauge(
    "aura_ml_active_models",
    "Number of models currently loaded in memory",
)

CACHE_HIT_RATE = Counter(
    "aura_ml_cache_hits_total",
    "Cache hit/miss counts",
    labelnames=["cache_name", "result"],
)
