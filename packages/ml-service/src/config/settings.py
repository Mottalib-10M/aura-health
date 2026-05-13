"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Aura ML Service.

    All values are loaded from environment variables or a `.env` file located at the
    project root.  Secrets should **never** be committed to source control.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Infrastructure ------------------------------------------------------------
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://aura:aura@localhost:5432/aura",
        description="Async PostgreSQL connection string (asyncpg dialect).",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection string for caching and pub/sub.",
    )
    KAFKA_BROKERS: str = Field(
        default="localhost:9092",
        description="Comma-separated list of Kafka broker addresses.",
    )

    # -- LLM / AI Providers -------------------------------------------------------
    LITELLM_PROXY_URL: str = Field(
        default="http://localhost:4000",
        description="URL of the LiteLLM proxy gateway.",
    )
    LITELLM_API_KEY: str = Field(
        default="",
        description="API key for the LiteLLM proxy.",
    )
    DEEPSEEK_API_KEY: str = Field(
        default="",
        description="API key for DeepSeek models.",
    )
    OPENAI_API_KEY: str = Field(
        default="",
        description="API key for OpenAI models.",
    )
    ANTHROPIC_API_KEY: str = Field(
        default="",
        description="API key for Anthropic models.",
    )

    # -- Model Serving -------------------------------------------------------------
    MODEL_CACHE_DIR: str = Field(
        default="/tmp/aura-models",
        description="Local directory for caching downloaded model weights.",
    )
    VLLM_HOST: str = Field(
        default="http://localhost:8000",
        description="vLLM inference server base URL.",
    )

    # -- Application ---------------------------------------------------------------
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Minimum log level for structured logging output.",
    )
    ENVIRONMENT: Literal["development", "staging", "production"] = Field(
        default="development",
        description="Deployment environment identifier.",
    )
    SERVICE_NAME: str = Field(
        default="aura-ml-service",
        description="Logical service name for tracing and metrics.",
    )
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated allowed CORS origins.",
    )

    # -- Triage Tuning -------------------------------------------------------------
    TRIAGE_CONFIDENCE_THRESHOLD: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="Minimum confidence score to accept triage output.",
    )
    TRIAGE_MAX_RETRIES: int = Field(
        default=2,
        ge=0,
        le=5,
        description="Maximum retries on LLM call failure during triage.",
    )

    # -- Forecasting ---------------------------------------------------------------
    FORECAST_HORIZON_MONTHS: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Default forecast horizon in months for supply chain predictions.",
    )

    @field_validator("KAFKA_BROKERS")
    @classmethod
    def validate_kafka_brokers(cls, v: str) -> str:
        """Ensure at least one broker is specified."""
        brokers = [b.strip() for b in v.split(",") if b.strip()]
        if not brokers:
            raise ValueError("At least one Kafka broker must be specified.")
        return ",".join(brokers)

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: str) -> str:
        """Normalise CORS origins list."""
        origins = [o.strip() for o in v.split(",") if o.strip()]
        return ",".join(origins)

    @property
    def kafka_broker_list(self) -> list[str]:
        """Return Kafka brokers as a list."""
        return [b.strip() for b in self.KAFKA_BROKERS.split(",")]

    @property
    def cors_origin_list(self) -> list[str]:
        """Return CORS origins as a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton of the application settings."""
    return Settings()
