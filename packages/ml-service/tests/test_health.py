"""Smoke tests for ML service."""


def test_import_settings():
    """Verify the settings module can be imported."""
    from src.config.settings import get_settings

    settings = get_settings()
    assert settings.SERVICE_NAME == "uzavita-ml-service"


def test_import_schemas():
    """Verify the triage schema module can be imported."""
    from src.models.triage.schemas import TriageRequest

    assert TriageRequest is not None
