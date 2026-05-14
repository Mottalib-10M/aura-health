"""Epidemiological forecasting and supply chain API endpoints."""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.auth import require_auth
from src.models.forecasting.schemas import (
    OutbreakInput,
    OutbreakResult,
    SupplyForecast,
    SupplyForecastInput,
    SurveillanceSummary,
)
from src.utils.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/forecast", tags=["Forecasting"], dependencies=[Depends(require_auth)])


def _get_outbreak_detector() -> Any:
    """Dependency to retrieve the OutbreakDetector singleton."""
    from src.api.main import _app_state

    detector = _app_state.get("outbreak_detector")
    if detector is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Outbreak detector is not loaded.",
        )
    return detector


def _get_supply_forecaster() -> Any:
    """Dependency to retrieve the SupplyForecaster singleton."""
    from src.api.main import _app_state

    forecaster = _app_state.get("supply_forecaster")
    if forecaster is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supply forecaster is not loaded.",
        )
    return forecaster


@router.post(
    "/outbreak",
    response_model=OutbreakResult,
    status_code=status.HTTP_200_OK,
    summary="Run outbreak detection for a region",
    description=(
        "Analyzes case count data using EWMA, CUSUM, and Bayesian change-point "
        "detection methods. Returns alert level, ensemble score, and recommended actions."
    ),
)
async def detect_outbreak(
    input_data: OutbreakInput,
    detector: Any = Depends(_get_outbreak_detector),
) -> OutbreakResult:
    """Execute the outbreak detection ensemble."""
    start = time.monotonic()
    log = logger.bind(
        region=input_data.region,
        disease_code=input_data.disease_code,
        request_id=input_data.request_id,
    )

    try:
        result = await detector.detect(input_data)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/outbreak", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/outbreak").observe(elapsed)

        log.info(
            "outbreak_detection_success",
            alert_level=result.alert_level,
            sigma_deviation=result.sigma_deviation,
            elapsed_s=round(elapsed, 3),
        )
        return result

    except ValueError as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/outbreak", status_code=422).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/outbreak").observe(elapsed)

        log.warning("outbreak_validation_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "message": str(exc)},
        ) from exc

    except Exception as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/outbreak", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/outbreak").observe(elapsed)

        log.exception("outbreak_detection_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during outbreak detection.",
        ) from exc


@router.post(
    "/supply",
    response_model=SupplyForecast,
    status_code=status.HTTP_200_OK,
    summary="Run supply chain demand forecast",
    description=(
        "Forecasts pharmaceutical demand using an ensemble of ARIMA, Prophet, "
        "and LSTM models. Includes stockout risk assessment and order recommendations."
    ),
)
async def forecast_supply(
    input_data: SupplyForecastInput,
    forecaster: Any = Depends(_get_supply_forecaster),
) -> SupplyForecast:
    """Execute the supply chain forecasting pipeline."""
    start = time.monotonic()
    log = logger.bind(
        pharmaceutical_id=input_data.pharmaceutical_id,
        horizon_months=input_data.horizon_months,
        request_id=input_data.request_id,
    )

    try:
        # Fetch current stock from database if available
        current_stock = 0
        from src.api.main import _app_state

        db_pool = _app_state.get("db_pool")
        if db_pool is not None:
            try:
                async with db_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        SELECT current_stock_units
                        FROM pharmaceutical_inventory
                        WHERE pharmaceutical_id = $1
                        """,
                        input_data.pharmaceutical_id,
                    )
                    if row:
                        current_stock = int(row["current_stock_units"])
            except Exception:
                log.warning("stock_fetch_failed", pharmaceutical_id=input_data.pharmaceutical_id)

        result = await forecaster.forecast(input_data, current_stock=current_stock)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/supply", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/supply").observe(elapsed)

        log.info(
            "supply_forecast_success",
            risk_criticality=result.risk.criticality,
            stockout_probability=result.risk.probability,
            elapsed_s=round(elapsed, 3),
        )
        return result

    except ValueError as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/supply", status_code=422).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/supply").observe(elapsed)

        log.warning("supply_forecast_validation_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "message": str(exc)},
        ) from exc

    except Exception as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/forecast/supply", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/forecast/supply").observe(elapsed)

        log.exception("supply_forecast_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during supply chain forecasting.",
        ) from exc


@router.get(
    "/surveillance/{region}",
    response_model=SurveillanceSummary,
    status_code=status.HTTP_200_OK,
    summary="Get surveillance summary for a region",
    description="Retrieve the current epidemiological surveillance summary including active alerts.",
)
async def get_surveillance_summary(region: str) -> SurveillanceSummary:
    """Fetch surveillance summary from the database."""
    from src.api.main import _app_state

    db_pool = _app_state.get("db_pool")
    if db_pool is None:
        # Return minimal summary when DB is not available
        return SurveillanceSummary(
            region=region,
            active_alerts=[],
            diseases_monitored=[],
            total_cases_7d=0,
            total_cases_30d=0,
        )

    try:
        async with db_pool.acquire() as conn:
            # Fetch monitored diseases
            disease_rows = await conn.fetch(
                """
                SELECT DISTINCT disease_code
                FROM surveillance_config
                WHERE region = $1 AND active = true
                """,
                region,
            )
            diseases_monitored = [r["disease_code"] for r in disease_rows]

            # Fetch case counts
            case_stats = await conn.fetchrow(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN reported_date >= CURRENT_DATE - INTERVAL '7 days'
                        THEN case_count ELSE 0 END), 0) AS cases_7d,
                    COALESCE(SUM(CASE WHEN reported_date >= CURRENT_DATE - INTERVAL '30 days'
                        THEN case_count ELSE 0 END), 0) AS cases_30d
                FROM surveillance_cases
                WHERE region = $1
                """,
                region,
            )

            # Fetch active outbreak alerts
            alert_rows = await conn.fetch(
                """
                SELECT alert_data
                FROM outbreak_alerts
                WHERE region = $1 AND resolved_at IS NULL
                ORDER BY created_at DESC
                LIMIT 10
                """,
                region,
            )

        return SurveillanceSummary(
            region=region,
            active_alerts=[],  # Would deserialize alert_data in production
            diseases_monitored=diseases_monitored,
            total_cases_7d=int(case_stats["cases_7d"]) if case_stats else 0,
            total_cases_30d=int(case_stats["cases_30d"]) if case_stats else 0,
        )

    except Exception as exc:
        logger.exception("surveillance_summary_error", region=region)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve surveillance summary.",
        ) from exc
