"""Longitudinal health analysis API endpoints."""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.auth import require_auth
from src.models.longitudinal.schemas import (
    AlertSeverity,
    HealthAlert,
    LongitudinalInput,
    LongitudinalOutput,
    TrendRequest,
)
from src.utils.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/longitudinal", tags=["Longitudinal Analysis"], dependencies=[Depends(require_auth)])


def _get_analyzer() -> Any:
    """Dependency to retrieve the LongitudinalAnalyzer singleton."""
    from src.api.main import _app_state

    analyzer = _app_state.get("longitudinal_analyzer")
    if analyzer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Longitudinal analyzer is not loaded.",
        )
    return analyzer


@router.post(
    "/analyze",
    response_model=LongitudinalOutput,
    status_code=status.HTTP_200_OK,
    summary="Run longitudinal health analysis",
    description=(
        "Accepts wearable and clinical time-series data for a patient. "
        "Returns trends, alerts, forecasts, and an overall health score."
    ),
)
async def analyze_health_data(
    input_data: LongitudinalInput,
    analyzer: Any = Depends(_get_analyzer),
) -> LongitudinalOutput:
    """Execute longitudinal analysis pipeline."""
    start = time.monotonic()
    log = logger.bind(
        patient_id=input_data.patient_id,
        request_id=input_data.request_id,
        metric_count=len(input_data.metrics),
    )

    try:
        result = await analyzer.analyze(input_data)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/longitudinal/analyze", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/longitudinal/analyze").observe(elapsed)

        log.info(
            "longitudinal_analyze_success",
            trend_count=len(result.trends),
            alert_count=len(result.alerts),
            health_score=result.overall_health_score,
            elapsed_s=round(elapsed, 3),
        )
        return result

    except ValueError as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/longitudinal/analyze", status_code=422).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/longitudinal/analyze").observe(elapsed)

        log.warning("longitudinal_validation_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "message": str(exc)},
        ) from exc

    except Exception as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/longitudinal/analyze", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/longitudinal/analyze").observe(elapsed)

        log.exception("longitudinal_analyze_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during longitudinal analysis.",
        ) from exc


@router.post(
    "/trends/{patient_id}",
    response_model=LongitudinalOutput,
    status_code=status.HTTP_200_OK,
    summary="Get trend analysis for a patient",
    description="Analyze trends for specific metrics over a given time window.",
)
async def get_trends(
    patient_id: str,
    trend_request: TrendRequest,
    analyzer: Any = Depends(_get_analyzer),
) -> LongitudinalOutput:
    """Run trend analysis for a specific patient and time window."""
    from src.api.main import _app_state

    start = time.monotonic()
    log = logger.bind(patient_id=patient_id)

    db_pool = _app_state.get("db_pool")
    if db_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available.",
        )

    try:
        # Fetch patient metrics from database
        async with db_pool.acquire() as conn:
            query = """
                SELECT timestamp, value, metric_type, source, quality
                FROM health_metrics
                WHERE patient_id = $1
                  AND timestamp >= NOW() - $2::interval
            """
            params: list[Any] = [patient_id, f"{trend_request.window_days} days"]

            if trend_request.metrics:
                query += " AND metric_type = ANY($3)"
                params.append([m.value for m in trend_request.metrics])

            query += " ORDER BY timestamp ASC"
            rows = await conn.fetch(query, *params)

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No health metrics found for patient {patient_id}.",
            )

        from src.models.longitudinal.schemas import DataPoint, MetricType

        metrics = [
            DataPoint(
                timestamp=row["timestamp"],
                value=float(row["value"]),
                metric=MetricType(row["metric_type"]),
                source=row.get("source"),
                quality=float(row.get("quality", 1.0)),
            )
            for row in rows
        ]

        input_data = LongitudinalInput(
            patient_id=patient_id,
            metrics=metrics,
            analysis_window_days=trend_request.window_days,
            include_forecasts=trend_request.include_forecasts,
        )

        result = await analyzer.analyze(input_data)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/longitudinal/trends", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/longitudinal/trends").observe(elapsed)

        log.info("trend_analysis_success", elapsed_s=round(elapsed, 3))
        return result

    except HTTPException:
        raise
    except Exception as exc:
        log.exception("trend_analysis_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute trend analysis.",
        ) from exc


@router.get(
    "/alerts/{patient_id}",
    response_model=list[HealthAlert],
    status_code=status.HTTP_200_OK,
    summary="Get active health alerts for a patient",
    description="Retrieve all active health alerts from longitudinal monitoring.",
)
async def get_active_alerts(
    patient_id: str,
    severity: AlertSeverity | None = None,
) -> list[HealthAlert]:
    """Fetch active alerts from the database."""
    from src.api.main import _app_state

    db_pool = _app_state.get("db_pool")
    if db_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available.",
        )

    try:
        async with db_pool.acquire() as conn:
            query = """
                SELECT alert_id, severity, metric_type, title, description,
                       threshold_value, actual_value, guideline_reference,
                       recommended_action, created_at
                FROM health_alerts
                WHERE patient_id = $1 AND resolved_at IS NULL
            """
            params: list[Any] = [patient_id]

            if severity:
                query += " AND severity = $2"
                params.append(severity.value)

            query += " ORDER BY created_at DESC LIMIT 50"
            rows = await conn.fetch(query, *params)

        return [
            HealthAlert(
                alert_id=str(row["alert_id"]),
                severity=AlertSeverity(row["severity"]),
                metric=row["metric_type"],
                title=row["title"],
                description=row["description"],
                threshold_value=row.get("threshold_value"),
                actual_value=row.get("actual_value"),
                guideline_reference=row.get("guideline_reference"),
                recommended_action=row.get("recommended_action"),
                created_at=row["created_at"],
            )
            for row in rows
        ]

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("alerts_fetch_error", patient_id=patient_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve health alerts.",
        ) from exc
