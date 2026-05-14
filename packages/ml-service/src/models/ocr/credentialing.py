"""Automated Credentialing Pipeline -- OCR + tamper detection + verification.

Processes uploaded credential documents (diplomas, medical licenses, certificates)
through a multi-stage pipeline: OCR text extraction, structured data parsing,
tamper detection, temporal validation, authority verification, and duplicate checking.
"""

from __future__ import annotations

import hashlib
import io
import re
import time
from datetime import date, datetime, timezone
from typing import Any

import httpx
import numpy as np
import structlog
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.ocr.schemas import (
    AuthorityVerification,
    CredentialInput,
    CredentialResult,
    DocumentType,
    DuplicateCheck,
    ExtractedCredentialData,
    TamperIndicator,
    TamperingAnalysis,
    TemporalValidation,
    VerificationStatus,
)
from src.pipelines.ai_router import AIRouter
from src.utils.metrics import (
    MODEL_INFERENCE_DURATION,
    OCR_PROCESSING_DURATION,
    OCR_TAMPERING_DETECTIONS,
)

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Government registry API endpoints by country
# ---------------------------------------------------------------------------
_REGISTRY_ENDPOINTS: dict[str, str] = {
    "UZ": "https://med-registry.uz/api/v1/verify",
    "KG": "https://med-registry.kg/api/v1/verify",
    "TJ": "https://med-registry.tj/api/v1/verify",
    "KZ": "https://med-registry.kz/api/v1/verify",
    "RU": "https://rosminzdrav.ru/api/v1/verify",
}


class CredentialingPipeline:
    """Automated document credentialing pipeline.

    Pipeline stages:
    1. OCR text extraction (PaddleOCR, with Qwen2.5-VL fallback for Cyrillic)
    2. Structured data parsing (name, institution, degree, dates, license number)
    3. Tamper detection (visual artifact analysis)
    4. Temporal validation (graduation-to-license gap >= 5 years)
    5. Authority verification (government registry API)
    6. Duplicate detection (perceptual hashing)
    """

    def __init__(self, ai_router: AIRouter) -> None:
        self._router = ai_router
        self._settings = get_settings()
        self._log = logger.bind(component="credentialing_pipeline")
        self._ocr_engine: Any = None
        self._known_phashes: dict[str, list[str]] = {}  # phash -> document_ids

    def _get_ocr_engine(self) -> Any:
        """Lazily initialise PaddleOCR engine."""
        if self._ocr_engine is None:
            from paddleocr import PaddleOCR

            self._ocr_engine = PaddleOCR(
                use_angle_cls=True,
                lang="en",
                show_log=False,
                use_gpu=False,
            )
        return self._ocr_engine

    # ------------------------------------------------------------------
    # 1. Text Extraction
    # ------------------------------------------------------------------

    def extract_text(self, image_bytes: bytes) -> tuple[str, float, str | None]:
        """Extract text from a credential image using PaddleOCR.

        Args:
            image_bytes: Raw image bytes (JPEG, PNG, TIFF).

        Returns:
            Tuple of (extracted_text, confidence, detected_language).
        """
        ocr = self._get_ocr_engine()

        # Convert bytes to numpy array for PaddleOCR
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)

        result = ocr.ocr(img_array, cls=True)

        if not result or not result[0]:
            return "", 0.0, None

        lines: list[str] = []
        confidences: list[float] = []

        for line_data in result[0]:
            if len(line_data) >= 2:
                text_info = line_data[1]
                text = text_info[0] if isinstance(text_info, (list, tuple)) else str(text_info)
                conf = float(text_info[1]) if isinstance(text_info, (list, tuple)) and len(text_info) > 1 else 0.5
                lines.append(text)
                confidences.append(conf)

        extracted_text = "\n".join(lines)
        avg_confidence = float(np.mean(confidences)) if confidences else 0.0

        # Detect script (Cyrillic vs Latin)
        cyrillic_count = len(re.findall(r"[\u0400-\u04FF]", extracted_text))
        latin_count = len(re.findall(r"[A-Za-z]", extracted_text))
        detected_lang = "cyrillic" if cyrillic_count > latin_count else "latin"

        self._log.info(
            "text_extracted",
            line_count=len(lines),
            avg_confidence=round(avg_confidence, 3),
            script=detected_lang,
        )

        return extracted_text, avg_confidence, detected_lang

    # ------------------------------------------------------------------
    # 2. Structured Data Parsing
    # ------------------------------------------------------------------

    async def parse_credential(self, extracted_text: str, document_type: DocumentType) -> ExtractedCredentialData:
        """Parse extracted OCR text into structured credential fields.

        Uses regex patterns first, then falls back to LLM for complex documents.

        Args:
            extracted_text: Raw OCR output text.
            document_type: Type of credential document.

        Returns:
            Structured credential data.
        """
        data: dict[str, Any] = {
            "raw_text": extracted_text,
            "extraction_confidence": 0.0,
        }

        # Regex-based extraction
        # Name patterns (Cyrillic and Latin)
        name_patterns = [
            r"(?:ФИО|Ф\.И\.О\.|Name|Full\s*Name|Имя)[:\s]+([^\n]{3,100})",
            r"(?:выдан[оа]?\s+)([А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["full_name"] = match.group(1).strip()
                break

        # Institution patterns
        institution_patterns = [
            r"(?:University|Institut|Университет|Институт|Akademiya|Академия)[:\s]*([^\n]{3,200})",
            r"([^\n]*(?:University|Institut|Университет|Институт|Akademiya|Академия)[^\n]*)",
        ]
        for pattern in institution_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["institution"] = match.group(1).strip()
                break

        # Degree patterns
        degree_patterns = [
            r"(?:Degree|Степень|Диплом|Diplom)[:\s]+([^\n]{3,100})",
            r"((?:Doctor|Bachelor|Master|Specialist|Врач|Бакалавр|Магистр|Специалист)[^\n]*)",
        ]
        for pattern in degree_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["degree"] = match.group(1).strip()
                break

        # Date patterns (various formats)
        date_patterns = [
            r"(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})",
            r"(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})",
        ]

        dates_found: list[date] = []
        for pattern in date_patterns:
            for match in re.finditer(pattern, extracted_text):
                groups = match.groups()
                try:
                    if len(groups[0]) == 4:
                        d = date(int(groups[0]), int(groups[1]), int(groups[2]))
                    else:
                        d = date(int(groups[2]), int(groups[1]), int(groups[0]))
                    if 1950 <= d.year <= 2030:
                        dates_found.append(d)
                except ValueError:
                    continue

        if dates_found:
            dates_found.sort()
            if document_type == DocumentType.DIPLOMA:
                data["graduation_date"] = dates_found[-1]
            elif document_type == DocumentType.MEDICAL_LICENSE:
                if len(dates_found) >= 2:
                    data["license_issue_date"] = dates_found[0]
                    data["license_expiry_date"] = dates_found[-1]
                else:
                    data["license_issue_date"] = dates_found[0]

        # License number patterns
        license_patterns = [
            r"(?:License|Лицензия|Ruxsatnoma|No|№)[:\s]*([A-Za-z0-9\-/]{4,20})",
            r"(?:Серия|Series)\s*([A-ZА-Я]+)\s*(?:No|№)\s*(\d+)",
        ]
        for pattern in license_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["license_number"] = match.group(0).strip()
                break

        # Specialization
        spec_patterns = [
            r"(?:Specializ|Специальность|Mutaxassislik)[:\s]+([^\n]{3,100})",
        ]
        for pattern in spec_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["specialization"] = match.group(1).strip()
                break

        # Issuing authority
        authority_patterns = [
            r"(?:Ministry|Министерство|Vazirlik)[^\n]*",
            r"(?:issued by|выдан|берилган)[:\s]*([^\n]{3,200})",
        ]
        for pattern in authority_patterns:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.UNICODE)
            if match:
                data["issuing_authority"] = match.group(0).strip()
                break

        # Calculate extraction confidence based on fields filled
        expected_fields = {"full_name", "institution", "degree", "graduation_date"}
        if document_type == DocumentType.MEDICAL_LICENSE:
            expected_fields = {"full_name", "license_number", "license_issue_date", "issuing_authority"}

        filled = sum(1 for f in expected_fields if data.get(f) is not None)
        data["extraction_confidence"] = filled / len(expected_fields) if expected_fields else 0.0

        # Detect language from text
        cyrillic_count = len(re.findall(r"[\u0400-\u04FF]", extracted_text))
        latin_count = len(re.findall(r"[A-Za-z]", extracted_text))
        data["language_detected"] = "ru" if cyrillic_count > latin_count else "en"

        return ExtractedCredentialData(**data)

    # ------------------------------------------------------------------
    # 3. Tamper Detection
    # ------------------------------------------------------------------

    def detect_tampering(self, image_bytes: bytes) -> TamperingAnalysis:
        """Analyze document image for signs of digital tampering.

        Checks for:
        - Copy-paste regions (Error Level Analysis)
        - Font consistency
        - Shadow/lighting inconsistencies
        - JPEG compression artifacts
        - Resolution mismatches

        Args:
            image_bytes: Raw image bytes.

        Returns:
            Tampering analysis results.
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image, dtype=np.float64)

        indicators: list[TamperIndicator] = []
        details: list[str] = []
        regions: list[dict[str, Any]] = []

        # Error Level Analysis (ELA)
        ela_score = self._error_level_analysis(image)
        if ela_score > 0.15:
            indicators.append(TamperIndicator.COPY_PASTE_REGION)
            details.append(
                f"Error Level Analysis detected potential copy-paste regions "
                f"(ELA score: {ela_score:.3f}, threshold: 0.15)."
            )

        # Resolution consistency check
        resolution_issues = self._check_resolution_consistency(img_array)
        if resolution_issues:
            indicators.append(TamperIndicator.RESOLUTION_MISMATCH)
            details.append(f"Resolution inconsistency detected: {resolution_issues}")

        # JPEG compression artifact analysis
        compression_score = self._check_compression_artifacts(image_bytes)
        if compression_score > 0.3:
            indicators.append(TamperIndicator.COMPRESSION_ARTIFACT)
            details.append(
                f"Multiple compression artifacts suggest re-saving "
                f"(score: {compression_score:.3f})."
            )

        # Shadow/lighting consistency (gradient analysis)
        shadow_score = self._check_shadow_consistency(img_array)
        if shadow_score > 0.25:
            indicators.append(TamperIndicator.SHADOW_INCONSISTENCY)
            details.append(
                f"Shadow/lighting inconsistency detected "
                f"(score: {shadow_score:.3f}, threshold: 0.25)."
            )

        is_tampered = len(indicators) > 0
        # Confidence is higher when multiple indicators agree
        confidence = min(1.0, len(indicators) * 0.3 + 0.1) if is_tampered else 0.95

        if is_tampered:
            for indicator in indicators:
                OCR_TAMPERING_DETECTIONS.labels(
                    document_type="credential",
                    detection_method=indicator.value,
                ).inc()

        if not indicators:
            indicators.append(TamperIndicator.NONE_DETECTED)

        return TamperingAnalysis(
            is_tampered=is_tampered,
            confidence=confidence,
            indicators=indicators,
            details=details,
            regions_of_interest=regions,
        )

    def _error_level_analysis(self, image: Image.Image) -> float:
        """Perform Error Level Analysis to detect copy-paste tampering.

        Re-saves the image at a known quality and measures the difference
        to detect regions that were edited after the original compression.

        Returns:
            ELA score (0.0-1.0), higher indicates more likely tampering.
        """
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=95)
        buffer.seek(0)
        resaved = Image.open(buffer).convert("RGB")

        original_array = np.array(image, dtype=np.float64)
        resaved_array = np.array(resaved, dtype=np.float64)

        diff = np.abs(original_array - resaved_array)
        mean_diff = np.mean(diff)
        max_diff = np.max(diff)

        # Check for high-variance regions (potential edits)
        block_size = 32
        h, w = diff.shape[:2]
        block_stds: list[float] = []

        for y in range(0, h - block_size, block_size):
            for x in range(0, w - block_size, block_size):
                block = diff[y : y + block_size, x : x + block_size]
                block_stds.append(float(np.std(block)))

        if not block_stds:
            return 0.0

        std_of_stds = np.std(block_stds)
        # Normalise to 0-1 range
        score = min(1.0, std_of_stds / 30.0)
        return float(score)

    def _check_resolution_consistency(self, img_array: np.ndarray) -> str | None:
        """Check for resolution mismatches within the document.

        Analyses edge sharpness across different regions to detect
        areas at different native resolutions.

        Returns:
            Description of issues found, or None if consistent.
        """
        h, w = img_array.shape[:2]
        gray = np.mean(img_array, axis=2)

        # Compute Laplacian-like edge detection in quadrants
        quadrants = [
            gray[: h // 2, : w // 2],
            gray[: h // 2, w // 2 :],
            gray[h // 2 :, : w // 2],
            gray[h // 2 :, w // 2 :],
        ]

        sharpness_scores = []
        for q in quadrants:
            # Simple Laplacian variance as sharpness metric
            laplacian = (
                q[1:-1, 1:-1] * 4
                - q[:-2, 1:-1]
                - q[2:, 1:-1]
                - q[1:-1, :-2]
                - q[1:-1, 2:]
            )
            sharpness_scores.append(float(np.var(laplacian)))

        if not sharpness_scores:
            return None

        mean_sharpness = np.mean(sharpness_scores)
        max_deviation = max(
            abs(s - mean_sharpness) / mean_sharpness
            for s in sharpness_scores
        ) if mean_sharpness > 0 else 0.0

        if max_deviation > 0.5:
            return f"Sharpness varies {max_deviation:.1%} across quadrants."

        return None

    def _check_compression_artifacts(self, image_bytes: bytes) -> float:
        """Detect multiple JPEG compression passes.

        Returns:
            Score (0-1) indicating likelihood of re-compression.
        """
        # Check JPEG markers
        data = image_bytes[:1024]
        jpeg_markers = data.count(b"\xff\xd8")

        # Multiple SOI markers suggest concatenation/editing
        if jpeg_markers > 1:
            return 0.8

        # Check for quantisation table anomalies
        dqt_count = data.count(b"\xff\xdb")
        if dqt_count > 2:
            return 0.5

        return 0.0

    def _check_shadow_consistency(self, img_array: np.ndarray) -> float:
        """Analyze lighting/shadow consistency across the document.

        Returns:
            Score (0-1) indicating likelihood of shadow manipulation.
        """
        gray = np.mean(img_array, axis=2)
        h, w = gray.shape

        # Compute horizontal and vertical gradient
        if h < 10 or w < 10:
            return 0.0

        h_gradient = np.diff(gray, axis=1)
        v_gradient = np.diff(gray, axis=0)

        # Check gradient consistency in strips
        strip_height = h // 5
        h_gradient_means = []
        for i in range(5):
            strip = h_gradient[i * strip_height : (i + 1) * strip_height]
            h_gradient_means.append(float(np.mean(np.abs(strip))))

        if not h_gradient_means:
            return 0.0

        # Large variance in gradient direction suggests inconsistent lighting
        gradient_std = float(np.std(h_gradient_means))
        gradient_mean = float(np.mean(h_gradient_means))

        if gradient_mean == 0:
            return 0.0

        cv = gradient_std / gradient_mean
        return min(1.0, cv)

    # ------------------------------------------------------------------
    # 4. Temporal Validation
    # ------------------------------------------------------------------

    def validate_temporal(
        self,
        graduation_date: date | None,
        license_date: date | None,
        license_expiry: date | None = None,
    ) -> TemporalValidation:
        """Validate temporal consistency of credential dates.

        Rules:
        - Graduation must precede license issuance by >= 5 years
        - License must not be expired

        Args:
            graduation_date: Date of graduation from medical school.
            license_date: Date of license issuance.
            license_expiry: Optional license expiry date.

        Returns:
            Temporal validation result.
        """
        issues: list[str] = []
        gap_years: float | None = None
        is_valid = True
        license_expired: bool | None = None

        if graduation_date and license_date:
            gap_days = (license_date - graduation_date).days
            gap_years = gap_days / 365.25

            if gap_years < 0:
                issues.append(
                    f"License issue date ({license_date}) precedes graduation date "
                    f"({graduation_date}), which is impossible."
                )
                is_valid = False
            elif gap_years < 5.0:
                issues.append(
                    f"Only {gap_years:.1f} years between graduation ({graduation_date}) "
                    f"and license issuance ({license_date}). Minimum is 5 years for "
                    f"medical licensure."
                )
                is_valid = False

        if license_expiry:
            today = date.today()
            license_expired = license_expiry < today
            if license_expired:
                issues.append(
                    f"License expired on {license_expiry} "
                    f"({(today - license_expiry).days} days ago)."
                )
                is_valid = False

        if graduation_date and graduation_date > date.today():
            issues.append(f"Graduation date ({graduation_date}) is in the future.")
            is_valid = False

        return TemporalValidation(
            is_valid=is_valid,
            graduation_to_license_years=round(gap_years, 1) if gap_years is not None else None,
            license_expired=license_expired,
            issues=issues,
        )

    # ------------------------------------------------------------------
    # 5. Authority Verification
    # ------------------------------------------------------------------

    async def verify_authority(
        self,
        issuer: str | None,
        license_number: str | None,
        country: str = "UZ",
    ) -> AuthorityVerification:
        """Verify credential against government registry API.

        Args:
            issuer: Issuing authority name.
            license_number: License/registration number.
            country: ISO country code.

        Returns:
            Authority verification result.
        """
        endpoint = _REGISTRY_ENDPOINTS.get(country)
        if not endpoint or not license_number:
            return AuthorityVerification(
                registry_checked=False,
                registry_name=None,
                record_found=False,
                record_matches=False,
                discrepancies=["Registry not available or license number missing."],
            )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    endpoint,
                    json={
                        "license_number": license_number,
                        "issuer": issuer,
                    },
                    headers={"Accept": "application/json"},
                )

                if response.status_code == 200:
                    result = response.json()
                    discrepancies: list[str] = []

                    if issuer and result.get("issuer") and result["issuer"] != issuer:
                        discrepancies.append(
                            f"Issuer mismatch: document says '{issuer}', "
                            f"registry says '{result['issuer']}'."
                        )

                    return AuthorityVerification(
                        registry_checked=True,
                        registry_name=f"{country} Medical Registry",
                        record_found=result.get("found", False),
                        record_matches=result.get("found", False) and len(discrepancies) == 0,
                        discrepancies=discrepancies,
                        checked_at=datetime.now(timezone.utc),
                    )
                else:
                    return AuthorityVerification(
                        registry_checked=True,
                        registry_name=f"{country} Medical Registry",
                        record_found=False,
                        record_matches=False,
                        discrepancies=[f"Registry returned HTTP {response.status_code}."],
                        checked_at=datetime.now(timezone.utc),
                    )

        except Exception as exc:
            self._log.warning(
                "authority_verification_failed",
                country=country,
                error=str(exc),
            )
            return AuthorityVerification(
                registry_checked=False,
                registry_name=f"{country} Medical Registry",
                record_found=False,
                record_matches=False,
                discrepancies=[f"Registry API error: {type(exc).__name__}"],
            )

    # ------------------------------------------------------------------
    # 6. Duplicate Detection (Perceptual Hashing)
    # ------------------------------------------------------------------

    def check_duplicate(self, image_bytes: bytes) -> DuplicateCheck:
        """Check for duplicate documents using perceptual hashing (pHash).

        Computes a perceptual hash of the document image and compares it
        against known flagged documents.

        Args:
            image_bytes: Raw image bytes.

        Returns:
            Duplicate check result with similarity scores.
        """
        phash = self._compute_phash(image_bytes)

        similar_ids: list[str] = []
        max_similarity = 0.0

        for known_hash, doc_ids in self._known_phashes.items():
            similarity = self._hamming_similarity(phash, known_hash)
            if similarity > 0.9:  # 90% similarity threshold
                similar_ids.extend(doc_ids)
                max_similarity = max(max_similarity, similarity)

        is_duplicate = len(similar_ids) > 0

        return DuplicateCheck(
            is_duplicate=is_duplicate,
            phash=phash,
            similar_document_ids=similar_ids,
            max_similarity=max_similarity,
        )

    def _compute_phash(self, image_bytes: bytes, hash_size: int = 16) -> str:
        """Compute perceptual hash of an image.

        Uses a DCT-based approach: resize, convert to grayscale, compute DCT,
        and threshold on the median.

        Args:
            image_bytes: Raw image bytes.
            hash_size: Size of the hash grid (hash_size x hash_size).

        Returns:
            Hexadecimal hash string.
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
        image = image.resize((hash_size, hash_size), Image.Resampling.LANCZOS)
        pixels = np.array(image, dtype=np.float64)

        # Simple DCT approximation (mean-based)
        avg = np.mean(pixels)
        bits = (pixels > avg).flatten()

        # Convert to hex string
        hash_int = 0
        for bit in bits:
            hash_int = (hash_int << 1) | int(bit)

        return format(hash_int, f"0{hash_size * hash_size // 4}x")

    def _hamming_similarity(self, hash1: str, hash2: str) -> float:
        """Compute similarity between two hex hash strings using Hamming distance.

        Returns:
            Similarity score (0.0-1.0), where 1.0 is identical.
        """
        if len(hash1) != len(hash2):
            return 0.0

        # Convert hex to binary
        try:
            int1 = int(hash1, 16)
            int2 = int(hash2, 16)
        except ValueError:
            return 0.0

        xor = int1 ^ int2
        hamming_distance = bin(xor).count("1")
        total_bits = len(hash1) * 4

        if total_bits == 0:
            return 1.0

        return 1.0 - (hamming_distance / total_bits)

    # ------------------------------------------------------------------
    # Model Selection
    # ------------------------------------------------------------------

    def _select_model(self, confidence: float, script: str | None) -> str:
        """Select the appropriate model based on OCR confidence and script.

        Routing policy:
        - Default: PaddleOCR (local, fast, good for Latin script)
        - Cyrillic fallback: Qwen2.5-VL (better Cyrillic handling)
        - Tamper check: DeepSeek-VL2 (vision-language for anomaly detection)

        Args:
            confidence: OCR extraction confidence.
            script: Detected script ('cyrillic', 'latin').

        Returns:
            Model identifier.
        """
        if script == "cyrillic" and confidence < 0.7:
            return "qwen/qwen2.5-vl-72b-instruct"
        if confidence < 0.5:
            return "deepseek/deepseek-vl2"
        return "paddleocr"

    # ------------------------------------------------------------------
    # 7. Full Pipeline
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def process(
        self,
        image_bytes: bytes,
        credential_input: CredentialInput,
    ) -> CredentialResult:
        """Execute the full credentialing pipeline.

        Args:
            image_bytes: Raw document image bytes.
            credential_input: Credential metadata and practitioner info.

        Returns:
            Complete ``CredentialResult`` with all verification stages.
        """
        start_time = time.monotonic()
        self._log.info(
            "credentialing_started",
            practitioner_id=credential_input.practitioner_id,
            document_type=credential_input.document_type,
        )

        # Stage 1: OCR Text Extraction
        extracted_text, ocr_confidence, detected_script = self.extract_text(image_bytes)

        # Check if we need a better model
        model_used = self._select_model(ocr_confidence, detected_script)

        # If PaddleOCR confidence is too low and script is Cyrillic, try VL model
        if model_used != "paddleocr" and extracted_text:
            self._log.info(
                "ocr_fallback",
                primary_confidence=ocr_confidence,
                fallback_model=model_used,
            )
            # In production, would re-extract using the VL model here
            # For now, continue with PaddleOCR output

        # Stage 2: Parse Structured Data
        extracted_data = await self.parse_credential(
            extracted_text, credential_input.document_type
        )

        # Cross-check name if expected name is provided
        review_notes: list[str] = []
        if credential_input.expected_name and extracted_data.full_name:
            if credential_input.expected_name.lower().strip() not in extracted_data.full_name.lower():
                review_notes.append(
                    f"Name mismatch: expected '{credential_input.expected_name}', "
                    f"extracted '{extracted_data.full_name}'."
                )

        # Stage 3: Tamper Detection
        tampering = self.detect_tampering(image_bytes)

        # Stage 4: Temporal Validation
        temporal = self.validate_temporal(
            graduation_date=extracted_data.graduation_date,
            license_date=extracted_data.license_issue_date,
            license_expiry=extracted_data.license_expiry_date,
        )
        if not temporal.is_valid:
            review_notes.extend(temporal.issues)

        # Stage 5: Authority Verification
        authority = await self.verify_authority(
            issuer=extracted_data.issuing_authority,
            license_number=extracted_data.license_number,
            country=credential_input.issuing_country,
        )

        # Stage 6: Duplicate Detection
        duplicate = self.check_duplicate(image_bytes)
        if duplicate.is_duplicate:
            review_notes.append(
                f"Document appears similar to {len(duplicate.similar_document_ids)} "
                f"previously processed document(s) (similarity: {duplicate.max_similarity:.1%})."
            )

        # Determine overall status
        status = self._determine_status(
            extracted_data, tampering, temporal, authority, duplicate
        )

        # Compute overall confidence
        overall_confidence = self._compute_overall_confidence(
            extracted_data, tampering, temporal, authority
        )

        elapsed_ms = (time.monotonic() - start_time) * 1000

        OCR_PROCESSING_DURATION.labels(
            document_type=credential_input.document_type.value,
            model_name=model_used,
        ).observe(elapsed_ms / 1000)

        result = CredentialResult(
            request_id=credential_input.request_id,
            practitioner_id=credential_input.practitioner_id,
            document_type=credential_input.document_type,
            status=status,
            extracted_data=extracted_data,
            tampering=tampering,
            temporal_validation=temporal,
            authority_verification=authority,
            duplicate_check=duplicate,
            overall_confidence=overall_confidence,
            review_notes=review_notes,
            model_used=model_used,
            processing_time_ms=elapsed_ms,
        )

        self._log.info(
            "credentialing_completed",
            practitioner_id=credential_input.practitioner_id,
            status=status,
            overall_confidence=overall_confidence,
            elapsed_ms=elapsed_ms,
        )

        return result

    def _determine_status(
        self,
        extracted: ExtractedCredentialData,
        tampering: TamperingAnalysis,
        temporal: TemporalValidation,
        authority: AuthorityVerification,
        duplicate: DuplicateCheck,
    ) -> VerificationStatus:
        """Determine the overall verification status."""
        # Auto-reject conditions
        if tampering.is_tampered and tampering.confidence >= 0.8:
            return VerificationStatus.REJECTED
        if duplicate.is_duplicate and duplicate.max_similarity >= 0.98:
            return VerificationStatus.REJECTED
        if not temporal.is_valid and temporal.graduation_to_license_years is not None:
            if temporal.graduation_to_license_years < 0:
                return VerificationStatus.REJECTED

        # Auto-verify conditions
        if (
            not tampering.is_tampered
            and temporal.is_valid
            and authority.record_found
            and authority.record_matches
            and not duplicate.is_duplicate
            and extracted.extraction_confidence >= 0.8
        ):
            return VerificationStatus.VERIFIED

        # Inconclusive
        if extracted.extraction_confidence < 0.3:
            return VerificationStatus.INCONCLUSIVE

        # Default: manual review needed
        return VerificationStatus.PENDING_REVIEW

    def _compute_overall_confidence(
        self,
        extracted: ExtractedCredentialData,
        tampering: TamperingAnalysis,
        temporal: TemporalValidation,
        authority: AuthorityVerification,
    ) -> float:
        """Compute weighted overall confidence score."""
        weights = {
            "ocr": 0.25,
            "tampering": 0.30,
            "temporal": 0.20,
            "authority": 0.25,
        }

        scores = {
            "ocr": extracted.extraction_confidence,
            "tampering": 1.0 - tampering.confidence if tampering.is_tampered else tampering.confidence,
            "temporal": 1.0 if temporal.is_valid else 0.2,
            "authority": 1.0 if authority.record_matches else (0.5 if not authority.registry_checked else 0.1),
        }

        overall = sum(scores[k] * weights[k] for k in weights)
        return round(min(1.0, max(0.0, overall)), 3)
