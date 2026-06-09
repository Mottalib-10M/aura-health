"""FastAPI application entry point for the Uzavita ML Service."""

from __future__ import annotations

import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from collections import defaultdict as _defaultdict

from src.config.settings import get_settings
from src.utils.logger import configure_logging, get_logger
from src.utils.metrics import (
    REQUEST_COUNT,
    REQUEST_LATENCY,
    REQUESTS_IN_PROGRESS,
    SERVICE_INFO,
)

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Module-level application state (populated during lifespan startup)
# ---------------------------------------------------------------------------
_app_state: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Lifespan handler for model loading / resource setup and teardown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle: load models on startup, clean up on shutdown."""
    settings = get_settings()

    # Configure structured logging
    configure_logging(log_level=settings.LOG_LEVEL, environment=settings.ENVIRONMENT)
    log = get_logger("lifespan")
    log.info(
        "starting_ml_service",
        environment=settings.ENVIRONMENT,
        log_level=settings.LOG_LEVEL,
    )

    # Set build info
    SERVICE_INFO.info({
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "service": settings.SERVICE_NAME,
    })

    # -- Database connection pool -----------------------------------------
    db_pool = None
    try:
        import asyncpg

        db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        db_pool = await asyncpg.create_pool(
            db_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        _app_state["db_pool"] = db_pool
        log.info("database_pool_created")
    except Exception:
        log.warning("database_pool_creation_failed", detail="Continuing without database connection.")

    # -- AI Router --------------------------------------------------------
    from src.pipelines.ai_router import AIRouter

    ai_router = AIRouter()
    _app_state["ai_router"] = ai_router
    log.info("ai_router_initialized")

    # -- Triage Engine ----------------------------------------------------
    from src.models.triage.engine import TriageEngine

    triage_engine = TriageEngine(ai_router=ai_router, db_pool=db_pool)
    _app_state["triage_engine"] = triage_engine
    log.info("triage_engine_loaded")

    # -- Longitudinal Analyzer --------------------------------------------
    from src.models.longitudinal.analyzer import LongitudinalAnalyzer

    longitudinal_analyzer = LongitudinalAnalyzer(ai_router=ai_router)
    _app_state["longitudinal_analyzer"] = longitudinal_analyzer
    log.info("longitudinal_analyzer_loaded")

    # -- Credentialing Pipeline -------------------------------------------
    from src.models.ocr.credentialing import CredentialingPipeline

    credentialing_pipeline = CredentialingPipeline(ai_router=ai_router)
    _app_state["credentialing_pipeline"] = credentialing_pipeline
    log.info("credentialing_pipeline_loaded")

    # -- Outbreak Detector ------------------------------------------------
    from src.models.forecasting.outbreak import OutbreakDetector

    outbreak_detector = OutbreakDetector()
    _app_state["outbreak_detector"] = outbreak_detector
    log.info("outbreak_detector_loaded")

    # -- Supply Forecaster ------------------------------------------------
    from src.models.forecasting.supply_chain import SupplyForecaster

    supply_forecaster = SupplyForecaster()
    _app_state["supply_forecaster"] = supply_forecaster
    log.info("supply_forecaster_loaded")

    log.info("all_models_loaded", model_count=5)

    # -- Yield control to the application ---------------------------------
    yield

    # -- Shutdown cleanup -------------------------------------------------
    log.info("shutting_down_ml_service")

    if db_pool is not None:
        await db_pool.close()
        log.info("database_pool_closed")

    _app_state.clear()
    log.info("ml_service_shutdown_complete")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Uzavita ML Service",
        description=(
            "AI/ML model serving for the Uzavita platform. "
            "Provides symptom triage, longitudinal health analysis, "
            "credential verification, and epidemiological forecasting."
        ),
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # -- CORS Middleware --------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=600,
    )

    # -- Rate Limiting Middleware -----------------------------------------
    # In-memory rate limiter: tracks request timestamps per (user, endpoint_group)
    _rate_limit_store: dict[str, list[float]] = _defaultdict(list)

    # Rate limits per endpoint group: (max_requests, window_seconds)
    _RATE_LIMITS: dict[str, tuple[int, int]] = {
        "triage": (10, 60),
        "ocr": (5, 60),
        "default": (30, 60),
    }

    def _get_rate_limit_group(path: str) -> str:
        """Determine the rate limit group for a given path."""
        if path.startswith("/triage"):
            return "triage"
        if path.startswith("/ocr"):
            return "ocr"
        return "default"

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next: Any) -> Response:
        """Enforce per-user rate limits based on endpoint group."""
        path = request.url.path

        # Skip rate limiting for infrastructure endpoints
        if path in ("/health", "/metrics", "/ready", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Identify user from Authorization header or fall back to client IP
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # Use a hash of the token as the user key
            import hashlib as _hl
            user_key = _hl.sha256(auth_header.encode()).hexdigest()[:16]
        else:
            user_key = request.client.host if request.client else "unknown"

        group = _get_rate_limit_group(path)
        max_requests, window_seconds = _RATE_LIMITS[group]
        bucket_key = f"{user_key}:{group}"

        now = time.monotonic()
        # Clean expired entries
        _rate_limit_store[bucket_key] = [
            ts for ts in _rate_limit_store[bucket_key]
            if now - ts < window_seconds
        ]

        if len(_rate_limit_store[bucket_key]) >= max_requests:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": (
                        f"Rate limit exceeded: {max_requests} requests per "
                        f"{window_seconds}s for {group} endpoints."
                    ),
                    "retry_after_seconds": window_seconds,
                },
                headers={"Retry-After": str(window_seconds)},
            )

        _rate_limit_store[bucket_key].append(now)
        return await call_next(request)

    # -- Request/Response Middleware --------------------------------------
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next: Any) -> Response:
        """Track request count, latency, and in-progress gauges."""
        method = request.method
        path = request.url.path

        # Skip metrics for health and metrics endpoints
        if path in ("/health", "/metrics", "/ready"):
            return await call_next(request)

        REQUESTS_IN_PROGRESS.labels(method=method, endpoint=path).inc()
        start = time.monotonic()

        try:
            response = await call_next(request)
            elapsed = time.monotonic() - start

            REQUEST_COUNT.labels(
                method=method, endpoint=path, status_code=response.status_code
            ).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(elapsed)

            return response
        finally:
            REQUESTS_IN_PROGRESS.labels(method=method, endpoint=path).dec()

    # -- Error Handlers ---------------------------------------------------

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Return structured validation errors."""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "message": "Request validation failed.",
                "details": [
                    {
                        "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
                        "message": err.get("msg", ""),
                        "type": err.get("type", ""),
                    }
                    for err in exc.errors()
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    @app.exception_handler(Exception)
    async def global_error_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        """Catch-all handler for unhandled exceptions."""
        logger.exception(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred. Please try again later.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    # -- Health and Readiness Endpoints -----------------------------------

    @app.get(
        "/health",
        status_code=status.HTTP_200_OK,
        tags=["Infrastructure"],
        summary="Health check",
    )
    async def health_check() -> dict[str, Any]:
        """Return service health status."""
        return {
            "status": "healthy",
            "service": settings.SERVICE_NAME,
            "version": "1.0.0",
            "environment": settings.ENVIRONMENT,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models_loaded": {
                "triage_engine": _app_state.get("triage_engine") is not None,
                "longitudinal_analyzer": _app_state.get("longitudinal_analyzer") is not None,
                "credentialing_pipeline": _app_state.get("credentialing_pipeline") is not None,
                "outbreak_detector": _app_state.get("outbreak_detector") is not None,
                "supply_forecaster": _app_state.get("supply_forecaster") is not None,
            },
            "database_connected": _app_state.get("db_pool") is not None,
        }

    @app.get(
        "/ready",
        status_code=status.HTTP_200_OK,
        tags=["Infrastructure"],
        summary="Readiness probe",
    )
    async def readiness_check() -> dict[str, str]:
        """Return whether the service is ready to accept traffic."""
        required_components = [
            "triage_engine",
            "longitudinal_analyzer",
            "outbreak_detector",
            "supply_forecaster",
        ]
        missing = [c for c in required_components if _app_state.get(c) is None]

        if missing:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "not_ready",
                    "missing_components": missing,
                },
            )

        return {"status": "ready"}

    @app.get(
        "/metrics",
        tags=["Infrastructure"],
        summary="Prometheus metrics",
    )
    async def prometheus_metrics() -> Response:
        """Expose Prometheus metrics."""
        return PlainTextResponse(
            content=generate_latest().decode("utf-8"),
            media_type=CONTENT_TYPE_LATEST,
        )

    # -- Include Routers --------------------------------------------------
    from src.api.routes.triage import router as triage_router
    from src.api.routes.longitudinal import router as longitudinal_router
    from src.api.routes.ocr import router as ocr_router
    from src.api.routes.forecast import router as forecast_router

    app.include_router(triage_router)
    app.include_router(longitudinal_router)
    app.include_router(ocr_router)
    app.include_router(forecast_router)

    return app


# Create the application instance
app = create_app()
