"""Pydantic v2 schemas for OCR credentialing pipeline."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class DocumentType(StrEnum):
    """Supported credential document types."""

    DIPLOMA = "diploma"
    MEDICAL_LICENSE = "medical_license"
    SPECIALIZATION_CERTIFICATE = "specialization_certificate"
    CONTINUING_EDUCATION = "continuing_education"
    GOVERNMENT_ID = "government_id"


class VerificationStatus(StrEnum):
    """Overall verification outcome."""

    VERIFIED = "verified"
    PENDING_REVIEW = "pending_review"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"


class TamperIndicator(StrEnum):
    """Types of tampering indicators."""

    NONE_DETECTED = "none_detected"
    FONT_MISMATCH = "font_mismatch"
    COPY_PASTE_REGION = "copy_paste_region"
    SHADOW_INCONSISTENCY = "shadow_inconsistency"
    METADATA_ANOMALY = "metadata_anomaly"
    RESOLUTION_MISMATCH = "resolution_mismatch"
    COMPRESSION_ARTIFACT = "compression_artifact"


class CredentialInput(BaseModel):
    """Input for single credential processing."""

    document_type: DocumentType
    practitioner_id: str = Field(..., min_length=1, max_length=64)
    issuing_country: str = Field(default="UZ", max_length=3, description="ISO 3166-1 alpha-2 country code.")
    expected_name: str | None = Field(None, max_length=200, description="Expected practitioner name for cross-check.")
    request_id: str | None = None


class ExtractedCredentialData(BaseModel):
    """Structured data extracted via OCR from a credential document."""

    full_name: str | None = None
    institution: str | None = None
    degree: str | None = None
    specialization: str | None = None
    graduation_date: date | None = None
    license_number: str | None = None
    license_issue_date: date | None = None
    license_expiry_date: date | None = None
    issuing_authority: str | None = None
    document_number: str | None = None
    raw_text: str = Field(..., description="Full OCR text output.")
    extraction_confidence: float = Field(..., ge=0.0, le=1.0)
    language_detected: str | None = None


class TamperingAnalysis(BaseModel):
    """Results of tamper detection analysis."""

    is_tampered: bool = False
    confidence: float = Field(..., ge=0.0, le=1.0)
    indicators: list[TamperIndicator] = Field(default_factory=list)
    details: list[str] = Field(default_factory=list, description="Human-readable explanations for each indicator.")
    regions_of_interest: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Bounding boxes of suspicious regions (x, y, w, h).",
    )


class TemporalValidation(BaseModel):
    """Temporal consistency checks on credential dates."""

    is_valid: bool
    graduation_to_license_years: float | None = None
    minimum_required_years: float = 5.0
    license_expired: bool | None = None
    issues: list[str] = Field(default_factory=list)


class AuthorityVerification(BaseModel):
    """Result of checking credential against government/authority registry."""

    registry_checked: bool = False
    registry_name: str | None = None
    record_found: bool = False
    record_matches: bool = False
    discrepancies: list[str] = Field(default_factory=list)
    checked_at: datetime | None = None


class DuplicateCheck(BaseModel):
    """Perceptual hash duplicate detection result."""

    is_duplicate: bool = False
    phash: str | None = None
    similar_document_ids: list[str] = Field(default_factory=list)
    max_similarity: float = Field(default=0.0, ge=0.0, le=1.0)


class CredentialResult(BaseModel):
    """Complete output from the credentialing pipeline."""

    request_id: str | None = None
    practitioner_id: str
    document_type: DocumentType
    status: VerificationStatus
    extracted_data: ExtractedCredentialData
    tampering: TamperingAnalysis
    temporal_validation: TemporalValidation
    authority_verification: AuthorityVerification
    duplicate_check: DuplicateCheck
    overall_confidence: float = Field(..., ge=0.0, le=1.0)
    review_notes: list[str] = Field(default_factory=list)
    model_used: str
    processing_time_ms: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def set_status_from_analysis(self) -> CredentialResult:
        """Auto-reject if tampering detected with high confidence."""
        if self.tampering.is_tampered and self.tampering.confidence >= 0.8:
            self.status = VerificationStatus.REJECTED
        return self


class VerifyInput(BaseModel):
    """Input for tamper-detection-only endpoint."""

    practitioner_id: str = Field(..., min_length=1, max_length=64)
    document_type: DocumentType
    request_id: str | None = None


class BatchCredentialInput(BaseModel):
    """Batch credential processing input."""

    documents: list[CredentialInput] = Field(..., min_length=1, max_length=20)

    @field_validator("documents")
    @classmethod
    def unique_request_ids(cls, v: list[CredentialInput]) -> list[CredentialInput]:
        """Ensure request IDs are unique within a batch."""
        ids = [d.request_id for d in v if d.request_id]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate request_id values in batch.")
        return v


class BatchCredentialResult(BaseModel):
    """Batch credential processing output."""

    results: list[CredentialResult]
    total_processing_time_ms: float
    failed_count: int = 0
    errors: list[dict[str, Any]] = Field(default_factory=list)
