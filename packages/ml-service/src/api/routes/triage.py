"""Triage API endpoints for symptom analysis and clinical decision support."""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from src.models.triage.schemas import (
    TriageBatchInput,
    TriageBatchOutput,
    TriageHistoryEntry,
    TriageInput,
    TriageOutput,
)
from src.utils.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/triage", tags=["Triage"])


def _get_triage_engine() -> Any:
    """Dependency to retrieve the TriageEngine singleton from app state.

    In production this is populated during the lifespan startup event.
    """
    from src.api.main import _app_state

    engine = _app_state.get("triage_engine")
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Triage engine is not loaded. Service is starting up.",
        )
    return engine


@router.post(
    "/analyze",
    response_model=TriageOutput,
    status_code=status.HTTP_200_OK,
    summary="Analyze symptoms for a single patient",
    description=(
        "Accepts a TriageInput payload with patient symptoms, vitals, and context. "
        "Returns severity classification, differential diagnoses, red flags, and "
        "recommended actions."
    ),
)
async def analyze_symptoms(
    input_data: TriageInput,
    engine: Any = Depends(_get_triage_engine),
) -> TriageOutput:
    """Run the full triage pipeline for a single patient."""
    start = time.monotonic()
    log = logger.bind(
        patient_id=input_data.patient_id,
        request_id=input_data.request_id,
    )

    try:
        result = await engine.execute(input_data)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/triage/analyze", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/triage/analyze").observe(elapsed)

        log.info(
            "triage_analyze_success",
            severity=result.severity,
            confidence=result.confidence,
            elapsed_s=round(elapsed, 3),
        )
        return result

    except ValueError as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/triage/analyze", status_code=422).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/triage/analyze").observe(elapsed)

        log.warning("triage_analyze_validation_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "triage_validation_failed",
                "message": str(exc),
                "patient_id": input_data.patient_id,
            },
        ) from exc

    except Exception as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/triage/analyze", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/triage/analyze").observe(elapsed)

        log.exception("triage_analyze_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "triage_engine_error",
                "message": "An internal error occurred during triage analysis.",
            },
        ) from exc


@router.post(
    "/batch",
    response_model=TriageBatchOutput,
    status_code=status.HTTP_200_OK,
    summary="Batch triage for multiple patients",
    description="Process up to 50 triage cases concurrently.",
)
async def batch_triage(
    input_data: TriageBatchInput,
    engine: Any = Depends(_get_triage_engine),
) -> TriageBatchOutput:
    """Run triage for a batch of patients concurrently."""
    import asyncio

    start = time.monotonic()
    log = logger.bind(batch_size=len(input_data.cases))

    results: list[TriageOutput] = []
    errors: list[dict[str, Any]] = []

    # Process cases concurrently with limited concurrency
    semaphore = asyncio.Semaphore(10)

    async def _process_case(case: TriageInput) -> TriageOutput | None:
        async with semaphore:
            try:
                return await engine.execute(case)
            except Exception as exc:
                errors.append({
                    "patient_id": case.patient_id,
                    "error": type(exc).__name__,
                    "message": str(exc),
                })
                return None

    tasks = [_process_case(case) for case in input_data.cases]
    completed = await asyncio.gather(*tasks)

    for result in completed:
        if result is not None:
            results.append(result)

    total_elapsed = (time.monotonic() - start) * 1000

    REQUEST_COUNT.labels(method="POST", endpoint="/triage/batch", status_code=200).inc()
    REQUEST_LATENCY.labels(method="POST", endpoint="/triage/batch").observe(total_elapsed / 1000)

    log.info(
        "batch_triage_completed",
        success_count=len(results),
        failed_count=len(errors),
        total_ms=round(total_elapsed, 1),
    )

    return TriageBatchOutput(
        results=results,
        total_processing_time_ms=total_elapsed,
        failed_count=len(errors),
        errors=errors,
    )


@router.get(
    "/history/{patient_id}",
    response_model=list[TriageHistoryEntry],
    status_code=status.HTTP_200_OK,
    summary="Get triage history for a patient",
    description="Retrieve the most recent triage assessments for a given patient.",
)
async def get_triage_history(
    patient_id: str,
    limit: int = 10,
) -> list[TriageHistoryEntry]:
    """Fetch historical triage results from the database."""
    from src.api.main import _app_state

    db_pool = _app_state.get("db_pool")
    if db_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection not available.",
        )

    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT triage_id, severity, confidence, primary_diagnosis,
                       created_at, model_used
                FROM triage_results
                WHERE patient_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                patient_id,
                min(limit, 50),
            )

        return [
            TriageHistoryEntry(
                triage_id=str(row["triage_id"]),
                severity=row["severity"],
                confidence=float(row["confidence"]),
                primary_diagnosis=row.get("primary_diagnosis"),
                created_at=row["created_at"],
                model_used=row["model_used"],
            )
            for row in rows
        ]

    except Exception as exc:
        logger.exception("triage_history_fetch_error", patient_id=patient_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve triage history.",
        ) from exc
