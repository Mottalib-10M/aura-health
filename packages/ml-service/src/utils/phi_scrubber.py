"""PHI (Protected Health Information) scrubbing utility.

Anonymizes patient-identifiable data before sending prompts to external LLMs.
Replaces patient IDs, names, dates of birth, phone numbers, emails, and other
PII with anonymous tokens. Maintains a reversible mapping so results can be
de-anonymized after the LLM response.
"""

from __future__ import annotations

import re
from typing import Any


# Regex patterns for common PHI fields
_PATTERNS: list[tuple[str, str, re.Pattern[str]]] = [
    # Patient ID patterns (UUIDs and alphanumeric IDs)
    ("PATIENT_ID", "[PATIENT_{idx}]", re.compile(
        r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
    )),
    # Email addresses
    ("EMAIL", "[EMAIL_{idx}]", re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    )),
    # Phone numbers (international and local formats)
    ("PHONE", "[PHONE_{idx}]", re.compile(
        r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{2,4}\b"
    )),
    # Dates of birth / dates in various formats (DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY)
    ("DOB", "[DATE_{idx}]", re.compile(
        r"\b(?:\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2})\b"
    )),
    # National ID numbers (common Central Asian formats)
    ("NATIONAL_ID", "[NATID_{idx}]", re.compile(
        r"\b\d{9,14}\b"
    )),
]

# Name patterns for Cyrillic and Latin names (2-3 word patterns)
_NAME_PATTERN = re.compile(
    r"\b([A-Z\u0410-\u042F\u0401][a-z\u0430-\u044F\u0451]+"
    r"(?:\s+[A-Z\u0410-\u042F\u0401][a-z\u0430-\u044F\u0451]+){1,2})\b"
)


class PHIScrubber:
    """Scrubs PHI from text before sending to external LLMs.

    Maintains a token-to-original mapping that allows de-anonymization
    of LLM responses.
    """

    def __init__(self) -> None:
        self._token_map: dict[str, str] = {}  # token -> original
        self._reverse_map: dict[str, str] = {}  # original -> token
        self._counter: int = 0

    def _make_token(self, category: str, original: str) -> str:
        """Create or retrieve an anonymization token for a value."""
        if original in self._reverse_map:
            return self._reverse_map[original]

        self._counter += 1
        token = f"[{category}_{self._counter}]"
        self._token_map[token] = original
        self._reverse_map[original] = token
        return token

    def scrub_text(self, text: str) -> str:
        """Remove PHI from a text string, replacing with anonymous tokens.

        Args:
            text: Raw text potentially containing PHI.

        Returns:
            Scrubbed text with PHI replaced by anonymous tokens.
        """
        result = text

        # Apply regex-based patterns
        for category, _template, pattern in _PATTERNS:
            matches = pattern.findall(result)
            for match in matches:
                token = self._make_token(category, match)
                result = result.replace(match, token)

        # Scrub potential names (heuristic: capitalized multi-word sequences)
        name_matches = _NAME_PATTERN.findall(result)
        for name in name_matches:
            # Skip common medical/location terms
            lower = name.lower()
            if any(term in lower for term in [
                "patient", "doctor", "hospital", "clinic", "university",
                "ministry", "department", "region", "district", "who",
                "blood pressure", "heart rate", "respiratory",
            ]):
                continue
            token = self._make_token("NAME", name)
            result = result.replace(name, token)

        return result

    def scrub_patient_id(self, patient_id: str) -> str:
        """Anonymize a specific patient ID.

        Args:
            patient_id: Raw patient identifier.

        Returns:
            Anonymous token for the patient ID.
        """
        return self._make_token("PATIENT_ID", patient_id)

    def scrub_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Scrub PHI from known fields in a dictionary.

        Processes common PHI field names: patient_id, name, first_name,
        last_name, date_of_birth, phone, email, address.

        Args:
            data: Dictionary potentially containing PHI fields.

        Returns:
            New dictionary with PHI fields anonymized.
        """
        phi_fields = {
            "patient_id", "name", "first_name", "last_name",
            "date_of_birth", "dob", "phone", "phone_number",
            "email", "email_address", "address", "national_id",
            "ssn", "mrn", "medical_record_number",
        }

        scrubbed = {}
        for key, value in data.items():
            if key.lower() in phi_fields and isinstance(value, str):
                scrubbed[key] = self._make_token(key.upper(), value)
            elif isinstance(value, str):
                scrubbed[key] = self.scrub_text(value)
            elif isinstance(value, dict):
                scrubbed[key] = self.scrub_dict(value)
            elif isinstance(value, list):
                scrubbed[key] = [
                    self.scrub_dict(item) if isinstance(item, dict)
                    else self.scrub_text(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                scrubbed[key] = value

        return scrubbed

    def restore_text(self, text: str) -> str:
        """Restore original PHI values in a text string.

        Args:
            text: Text containing anonymous tokens.

        Returns:
            Text with tokens replaced by original values.
        """
        result = text
        for token, original in self._token_map.items():
            result = result.replace(token, original)
        return result

    def get_token_map(self) -> dict[str, str]:
        """Return the current token-to-original mapping.

        Returns:
            Dictionary mapping anonymous tokens to original PHI values.
        """
        return dict(self._token_map)

    def reset(self) -> None:
        """Clear the token mapping and reset the counter."""
        self._token_map.clear()
        self._reverse_map.clear()
        self._counter = 0
