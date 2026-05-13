"""Structured logging with PHI redaction for HIPAA compliance."""

from __future__ import annotations

import re
from typing import Any

import structlog

# ---------------------------------------------------------------------------
# PHI patterns to redact from log output
# ---------------------------------------------------------------------------
_PHI_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Social Security Numbers (US)
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED-SSN]"),
    # Phone numbers (various formats)
    (re.compile(r"\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b"), "[REDACTED-PHONE]"),
    # Email addresses
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED-EMAIL]"),
    # Date of birth patterns (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
    (re.compile(r"\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b"), "[REDACTED-DOB]"),
    # Medical record numbers (MRN-XXXXXX pattern)
    (re.compile(r"\bMRN[-:]?\s*\d{4,12}\b", re.IGNORECASE), "[REDACTED-MRN]"),
    # Passport numbers
    (re.compile(r"\b[A-Z]{1,2}\d{6,9}\b"), "[REDACTED-ID]"),
]


def _redact_phi_value(value: Any) -> Any:
    """Recursively redact PHI from a value."""
    if isinstance(value, str):
        result = value
        for pattern, replacement in _PHI_PATTERNS:
            result = pattern.sub(replacement, result)
        return result
    if isinstance(value, dict):
        return {k: _redact_phi_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_redact_phi_value(item) for item in value)
    return value


def phi_redaction_processor(
    _logger: Any,
    _method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """Structlog processor that scrubs PHI from every log event.

    Applies regex-based redaction to all string values in the event dictionary,
    including nested dicts and lists.
    """
    # Redact the event message itself
    if "event" in event_dict:
        event_dict["event"] = _redact_phi_value(event_dict["event"])

    # Redact all other keys
    for key in list(event_dict.keys()):
        if key in {"event", "timestamp", "level", "logger"}:
            continue
        event_dict[key] = _redact_phi_value(event_dict[key])

    return event_dict


def _drop_sensitive_keys(
    _logger: Any,
    _method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """Drop keys that should never appear in logs regardless of redaction."""
    sensitive_keys = {
        "password", "secret", "api_key", "token", "authorization",
        "credit_card", "ssn", "social_security",
    }
    for key in list(event_dict.keys()):
        if key.lower() in sensitive_keys:
            event_dict[key] = "[REDACTED]"
    return event_dict


def configure_logging(log_level: str = "INFO", environment: str = "development") -> None:
    """Configure structlog with PHI-safe processors.

    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        environment: Deployment environment -- controls renderer choice.
    """
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        _drop_sensitive_keys,
        phi_redaction_processor,
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if environment == "production":
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    import logging

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore", "kafka"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger.

    Args:
        name: Optional logger name. Defaults to the calling module.

    Returns:
        A bound logger instance with PHI redaction enabled.
    """
    return structlog.get_logger(name)
