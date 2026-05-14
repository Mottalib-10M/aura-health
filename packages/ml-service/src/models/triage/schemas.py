"""Pydantic v2 schemas for the Symptom Triage pipeline.

These schemas mirror the TypeScript interfaces defined in the Aura Health shared
types package to ensure consistent data contracts across services.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class TriageSeverity(StrEnum):
    """WHO-aligned severity classification."""

    EMERGENCY = "emergency"
    URGENT = "urgent"
    SEMI_URGENT = "semi_urgent"
    NON_URGENT = "non_urgent"
    SELF_CARE = "self_care"


class Language(StrEnum):
    """Supported input languages for triage."""

    EN = "en"
    RU = "ru"
    UZ = "uz"
    KG = "kg"
    TJ = "tj"


class VitalSigns(BaseModel):
    """Patient vital signs at time of triage."""

    heart_rate_bpm: float | None = Field(None, ge=0, le=300, description="Heart rate in BPM.")
    blood_pressure_systolic: float | None = Field(None, ge=0, le=300)
    blood_pressure_diastolic: float | None = Field(None, ge=0, le=200)
    temperature_celsius: float | None = Field(None, ge=25.0, le=45.0)
    respiratory_rate: float | None = Field(None, ge=0, le=80)
    spo2_percent: float | None = Field(None, ge=0, le=100)
    blood_glucose_mmol: float | None = Field(None, ge=0, le=50.0)


class Symptom(BaseModel):
    """Individual symptom entry."""

    description: str = Field(..., min_length=1, max_length=1000)
    onset_hours_ago: float | None = Field(None, ge=0, description="Hours since onset.")
    severity_self_reported: int | None = Field(None, ge=1, le=10)
    body_region: str | None = Field(None, max_length=100)


class SeverityScale(int):
    """Severity scale reported by the patient (1-5)."""

    pass


class PatientDemographic(BaseModel):
    """Patient demographic information (mirrors TypeScript PatientDemographic)."""

    age: int = Field(..., ge=0, le=150)
    sex: str = Field(..., pattern=r"^(male|female|other)$")
    pregnancy_status: bool | None = None
    bmi: float | None = None


class PatientLocation(BaseModel):
    """Geographic location for a patient (mirrors TypeScript PatientLocation)."""

    region: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=100)
    district: str | None = None
    coordinates: dict[str, float] | None = None


class TriageInput(BaseModel):
    """Input payload for a single triage request.

    Matches ``TriageInput`` from ``@aura/shared-types``.
    """

    patient_id: str = Field(..., min_length=1, max_length=64)
    symptom_description: str = Field(default="", max_length=5000, description="Free-text symptom description.")
    symptom_duration_hours: float | None = Field(None, ge=0, description="Duration of symptoms in hours.")
    severity_scale: int | None = Field(None, ge=1, le=5, description="Patient-reported severity (1-5).")
    symptoms: list[Symptom] = Field(default_factory=list, max_length=20)
    vital_signs: VitalSigns | None = None
    language: Language = Language.EN
    age_years: int | None = Field(None, ge=0, le=150)
    sex: str | None = Field(None, pattern=r"^(male|female|other)$")
    pregnant: bool | None = None
    historical_conditions: list[str] = Field(default_factory=list, description="Historical/chronic conditions.")
    chronic_conditions: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    demographic: PatientDemographic | None = Field(None, description="Patient demographics.")
    location: PatientLocation | None = Field(None, description="Patient location.")
    region: str | None = Field(None, max_length=100, description="Geographic region for endemic disease context.")
    request_id: str | None = Field(None, max_length=128)

    @field_validator("symptoms")
    @classmethod
    def deduplicate_symptoms(cls, v: list[Symptom]) -> list[Symptom]:
        """Remove exact duplicate symptom descriptions."""
        seen: set[str] = set()
        unique: list[Symptom] = []
        for s in v:
            key = s.description.strip().lower()
            if key not in seen:
                seen.add(key)
                unique.append(s)
        return unique

    @model_validator(mode="after")
    def pregnancy_requires_sex(self) -> TriageInput:
        if self.pregnant and self.sex == "male":
            raise ValueError("Pregnancy flag cannot be set for male patients.")
        return self


class RedFlag(BaseModel):
    """A critical clinical finding that demands immediate attention."""

    flag: str = Field(..., description="Short label, e.g. 'chest_pain_with_dyspnea'.")
    description: str
    references: list[str] = Field(default_factory=list, description="WHO / clinical guideline references.")


class DifferentialDiagnosis(BaseModel):
    """A candidate diagnosis with probability estimate."""

    condition: str = Field(..., description="Human-readable condition name.")
    snomed_code: str | None = Field(None, description="SNOMED CT concept ID.")
    icd10_code: str | None = Field(None, description="ICD-10 code.")
    probability: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(..., max_length=2000)


class UrgencyLevel(StrEnum):
    """Urgency level aligned with Manchester Triage System (mirrors TypeScript)."""

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class RecommendedAction(BaseModel):
    """Actionable next step for the patient or provider."""

    action: str
    urgency: TriageSeverity
    timeframe_hours: float | None = Field(None, ge=0)
    facility_type: str | None = Field(None, description="e.g. 'emergency_department', 'primary_care'.")


class SpecialtyRecommendation(BaseModel):
    """A single specialty recommendation (mirrors TypeScript)."""

    specialty: str
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    rationale: str
    estimated_wait_time_minutes: float = Field(default=0, ge=0)


class FollowUpProtocol(BaseModel):
    """Follow-up protocol attached to every triage result (mirrors TypeScript)."""

    timeframe_hours: float = Field(..., ge=0)
    escalation_triggers: list[str] = Field(default_factory=list)


class TriageOutput(BaseModel):
    """Output payload from the triage engine.

    Matches ``TriageOutput`` from ``@aura/shared-types``.
    """

    request_id: str | None = None
    patient_id: str
    severity: TriageSeverity
    urgency_level: UrgencyLevel | None = Field(None, description="Manchester Triage urgency level.")
    confidence: float = Field(..., ge=0.0, le=1.0)
    confidence_score: float | None = Field(None, ge=0.0, le=1.0, description="Alias for confidence (TypeScript compat).")
    red_flags: list[RedFlag] = Field(default_factory=list)
    differential_diagnoses: list[DifferentialDiagnosis] = Field(default_factory=list)
    recommended_specializations: list[SpecialtyRecommendation] = Field(default_factory=list)
    suggested_diagnostics: list[str] = Field(default_factory=list)
    contraindications: list[str] = Field(default_factory=list)
    follow_up_protocol: FollowUpProtocol | None = None
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)
    reasoning_summary: str = Field(..., max_length=5000)
    model_used: str = Field(..., description="Model identifier used for inference.")
    processing_time_ms: float = Field(..., ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def emergency_must_have_red_flags(self) -> TriageOutput:
        """Emergency severity must include at least one red flag."""
        if self.severity == TriageSeverity.EMERGENCY and not self.red_flags:
            raise ValueError(
                "Emergency-severity triage must include at least one red flag."
            )
        return self


class TriageBatchInput(BaseModel):
    """Batch triage request."""

    cases: list[TriageInput] = Field(..., min_length=1, max_length=50)


class TriageBatchOutput(BaseModel):
    """Batch triage response."""

    results: list[TriageOutput]
    total_processing_time_ms: float
    failed_count: int = 0
    errors: list[dict[str, Any]] = Field(default_factory=list)


class TriageHistoryEntry(BaseModel):
    """Historical triage record."""

    triage_id: str
    severity: TriageSeverity
    confidence: float
    primary_diagnosis: str | None = None
    created_at: datetime
    model_used: str
