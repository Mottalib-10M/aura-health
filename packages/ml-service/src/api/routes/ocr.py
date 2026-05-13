"""Document OCR and credentialing API endpoints."""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.models.ocr.schemas import (
    BatchCredentialInput,
    BatchCredentialResult,
    CredentialInput,
    CredentialResult,
    DocumentType,
    TamperingAnalysis,
    VerifyInput,
)
from src.utils.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR / Credentialing"])

# Maximum file size: 20 MB
_MAX_FILE_SIZE = 20 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
    "application/pdf",
}


def _get_pipeline() -> Any:
    """Dependency to retrieve the CredentialingPipeline singleton."""
    from src.api.main import _app_state

    pipeline = _app_state.get("credentialing_pipeline")
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Credentialing pipeline is not loaded.",
        )
    return pipeline


async def _validate_and_read_file(file: UploadFile) -> bytes:
    """Validate uploaded file and read its contents.

    Args:
        file: Uploaded file from the request.

    Returns:
        Raw file bytes.

    Raises:
        HTTPException: If file type or size is invalid.
    """
    if file.content_type and file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "error": "unsupported_media_type",
                "message": f"File type '{file.content_type}' is not supported. "
                f"Allowed types: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}.",
            },
        )

    contents = await file.read()

    if len(contents) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "file_too_large",
                "message": f"File size ({len(contents)} bytes) exceeds maximum "
                f"({_MAX_FILE_SIZE} bytes / {_MAX_FILE_SIZE // 1024 // 1024} MB).",
            },
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "empty_file", "message": "Uploaded file is empty."},
        )

    return contents


@router.post(
    "/credential",
    response_model=CredentialResult,
    status_code=status.HTTP_200_OK,
    summary="Process a credential document",
    description=(
        "Upload a diploma, medical license, or certificate image. "
        "Returns extracted data, tamper analysis, and verification status."
    ),
)
async def process_credential(
    file: UploadFile = File(..., description="Document image file (JPEG, PNG, TIFF, WebP, PDF)."),
    document_type: DocumentType = Form(..., description="Type of credential document."),
    practitioner_id: str = Form(..., description="Unique practitioner identifier."),
    issuing_country: str = Form(default="UZ", description="ISO 3166-1 alpha-2 country code."),
    expected_name: str | None = Form(default=None, description="Expected practitioner name for cross-check."),
    request_id: str | None = Form(default=None, description="Optional request tracking ID."),
    pipeline: Any = Depends(_get_pipeline),
) -> CredentialResult:
    """Process a single credential document through the full pipeline."""
    start = time.monotonic()
    log = logger.bind(
        practitioner_id=practitioner_id,
        document_type=document_type,
        request_id=request_id,
    )

    image_bytes = await _validate_and_read_file(file)

    credential_input = CredentialInput(
        document_type=document_type,
        practitioner_id=practitioner_id,
        issuing_country=issuing_country,
        expected_name=expected_name,
        request_id=request_id,
    )

    try:
        result = await pipeline.process(image_bytes, credential_input)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/ocr/credential", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/ocr/credential").observe(elapsed)

        log.info(
            "credential_processed",
            status=result.status,
            confidence=result.overall_confidence,
            elapsed_s=round(elapsed, 3),
        )
        return result

    except Exception as exc:
        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/ocr/credential", status_code=500).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/ocr/credential").observe(elapsed)

        log.exception("credential_processing_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during credential processing.",
        ) from exc


@router.post(
    "/verify",
    response_model=TamperingAnalysis,
    status_code=status.HTTP_200_OK,
    summary="Run tamper detection on a document",
    description="Upload a document image to check for signs of digital tampering.",
)
async def verify_document(
    file: UploadFile = File(..., description="Document image file."),
    practitioner_id: str = Form(..., description="Practitioner identifier for logging."),
    document_type: DocumentType = Form(..., description="Document type."),
    request_id: str | None = Form(default=None),
    pipeline: Any = Depends(_get_pipeline),
) -> TamperingAnalysis:
    """Run tamper detection only (no full credentialing pipeline)."""
    start = time.monotonic()
    log = logger.bind(practitioner_id=practitioner_id, document_type=document_type)

    image_bytes = await _validate_and_read_file(file)

    try:
        result = pipeline.detect_tampering(image_bytes)

        elapsed = time.monotonic() - start
        REQUEST_COUNT.labels(method="POST", endpoint="/ocr/verify", status_code=200).inc()
        REQUEST_LATENCY.labels(method="POST", endpoint="/ocr/verify").observe(elapsed)

        log.info(
            "tamper_check_completed",
            is_tampered=result.is_tampered,
            confidence=result.confidence,
            indicator_count=len(result.indicators),
            elapsed_s=round(elapsed, 3),
        )
        return result

    except Exception as exc:
        log.exception("tamper_detection_error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during tamper detection.",
        ) from exc


@router.post(
    "/batch",
    response_model=BatchCredentialResult,
    status_code=status.HTTP_200_OK,
    summary="Batch process credential documents",
    description=(
        "Process multiple credential documents. Files must be uploaded as a "
        "multipart form with matching metadata."
    ),
)
async def batch_process_credentials(
    files: list[UploadFile] = File(..., description="Document image files."),
    document_types: list[DocumentType] = Form(..., description="Document type for each file."),
    practitioner_ids: list[str] = Form(..., description="Practitioner ID for each file."),
    issuing_country: str = Form(default="UZ", description="Country code (applied to all)."),
    pipeline: Any = Depends(_get_pipeline),
) -> BatchCredentialResult:
    """Batch process multiple credential documents."""
    import asyncio

    start = time.monotonic()

    if len(files) != len(document_types) or len(files) != len(practitioner_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "parameter_mismatch",
                "message": (
                    f"Number of files ({len(files)}), document_types ({len(document_types)}), "
                    f"and practitioner_ids ({len(practitioner_ids)}) must match."
                ),
            },
        )

    if len(files) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "batch_too_large", "message": "Maximum 20 documents per batch."},
        )

    results: list[CredentialResult] = []
    errors: list[dict[str, Any]] = []

    semaphore = asyncio.Semaphore(5)

    async def _process_single(
        idx: int,
        uploaded_file: UploadFile,
        doc_type: DocumentType,
        prac_id: str,
    ) -> CredentialResult | None:
        async with semaphore:
            try:
                image_bytes = await _validate_and_read_file(uploaded_file)
                cred_input = CredentialInput(
                    document_type=doc_type,
                    practitioner_id=prac_id,
                    issuing_country=issuing_country,
                    request_id=f"batch-{idx}",
                )
                return await pipeline.process(image_bytes, cred_input)
            except Exception as exc:
                errors.append({
                    "index": idx,
                    "practitioner_id": prac_id,
                    "error": type(exc).__name__,
                    "message": str(exc),
                })
                return None

    tasks = [
        _process_single(i, f, dt, pid)
        for i, (f, dt, pid) in enumerate(zip(files, document_types, practitioner_ids, strict=False))
    ]
    completed = await asyncio.gather(*tasks)

    for r in completed:
        if r is not None:
            results.append(r)

    total_elapsed = (time.monotonic() - start) * 1000

    REQUEST_COUNT.labels(method="POST", endpoint="/ocr/batch", status_code=200).inc()
    REQUEST_LATENCY.labels(method="POST", endpoint="/ocr/batch").observe(total_elapsed / 1000)

    logger.info(
        "batch_credential_completed",
        success_count=len(results),
        failed_count=len(errors),
        total_ms=round(total_elapsed, 1),
    )

    return BatchCredentialResult(
        results=results,
        total_processing_time_ms=total_elapsed,
        failed_count=len(errors),
        errors=errors,
    )
