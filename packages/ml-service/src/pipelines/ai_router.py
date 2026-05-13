"""Multi-Model Orchestration Layer -- Python equivalent of ai-router.ts.

Provides centralized model selection, routing, fallback chains, and cost
estimation for all AI/ML model calls in the Aura Health platform.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

import litellm
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.utils.metrics import (
    LLM_COST_USD,
    LLM_TOKEN_USAGE,
    MODEL_FALLBACK_COUNT,
    MODEL_INFERENCE_COUNT,
    MODEL_INFERENCE_DURATION,
    MODEL_INFERENCE_ERRORS,
)

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Routing matrix -- mirrors TypeScript routingMatrix exactly
# ---------------------------------------------------------------------------

ROUTING_MATRIX: dict[str, dict[str, Any]] = {
    "symptom_triage": {
        "primary": "deepseek/deepseek-chat",
        "fallback": "openai/gpt-4.1-nano",
        "critical": "anthropic/claude-sonnet-4-5-20241022",
        "max_tokens": 4096,
        "temperature": 0.1,
        "description": "Symptom triage with multilingual support",
        "phi_safe_models": ["deepseek/deepseek-chat", "anthropic/claude-sonnet-4-5-20241022"],
    },
    "longitudinal_analysis": {
        "primary": "openai/gpt-4.1-nano",
        "fallback": "deepseek/deepseek-chat",
        "critical": "deepseek/deepseek-reasoner",
        "max_tokens": 4096,
        "temperature": 0.2,
        "description": "Longitudinal health data analysis and trend detection",
        "phi_safe_models": ["openai/gpt-4.1-nano", "deepseek/deepseek-chat"],
    },
    "credential_ocr": {
        "primary": "paddleocr",
        "fallback": "qwen/qwen2.5-vl-72b-instruct",
        "critical": "deepseek/deepseek-vl2",
        "max_tokens": 2048,
        "temperature": 0.05,
        "description": "Credential document OCR and verification",
        "phi_safe_models": ["paddleocr"],
    },
    "outbreak_detection": {
        "primary": "statistical_ensemble",
        "fallback": "deepseek/deepseek-chat",
        "critical": "anthropic/claude-sonnet-4-5-20241022",
        "max_tokens": 4096,
        "temperature": 0.1,
        "description": "Epidemiological outbreak detection and surveillance",
        "phi_safe_models": ["statistical_ensemble"],
    },
    "supply_forecast": {
        "primary": "statistical_ensemble",
        "fallback": "openai/gpt-4.1-nano",
        "critical": "deepseek/deepseek-reasoner",
        "max_tokens": 4096,
        "temperature": 0.1,
        "description": "Pharmaceutical supply chain demand forecasting",
        "phi_safe_models": ["statistical_ensemble"],
    },
    "clinical_summary": {
        "primary": "deepseek/deepseek-chat",
        "fallback": "openai/gpt-4.1-nano",
        "critical": "anthropic/claude-sonnet-4-5-20241022",
        "max_tokens": 8192,
        "temperature": 0.3,
        "description": "Clinical summary generation from structured data",
        "phi_safe_models": ["deepseek/deepseek-chat", "anthropic/claude-sonnet-4-5-20241022"],
    },
    "translation": {
        "primary": "deepseek/deepseek-chat",
        "fallback": "openai/gpt-4.1-nano",
        "critical": "openai/gpt-4.1-nano",
        "max_tokens": 4096,
        "temperature": 0.1,
        "description": "Medical terminology translation (UZ/KG/TJ/RU/EN)",
        "phi_safe_models": ["deepseek/deepseek-chat"],
    },
}

# ---------------------------------------------------------------------------
# Cost estimates per model (USD per 1M tokens)
# ---------------------------------------------------------------------------

_COST_PER_MILLION_TOKENS: dict[str, dict[str, float]] = {
    "deepseek/deepseek-chat": {"input": 0.27, "output": 1.10},
    "deepseek/deepseek-reasoner": {"input": 0.55, "output": 2.19},
    "deepseek/deepseek-vl2": {"input": 0.27, "output": 1.10},
    "openai/gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "openai/gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "openai/gpt-4.1": {"input": 2.00, "output": 8.00},
    "anthropic/claude-sonnet-4-5-20241022": {"input": 3.00, "output": 15.00},
    "qwen/qwen2.5-vl-72b-instruct": {"input": 0.40, "output": 1.20},
}


class AIRouter:
    """Centralized AI model orchestration with routing, fallback, and monitoring.

    Routes requests to the appropriate model based on task type, complexity,
    PHI exposure risk, and latency requirements. Provides automatic fallback
    chains and cost tracking.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._log = logger.bind(component="ai_router")
        self._latency_history: dict[str, list[float]] = defaultdict(list)

        # Configure LiteLLM
        litellm.api_base = self._settings.LITELLM_PROXY_URL
        if self._settings.LITELLM_API_KEY:
            litellm.api_key = self._settings.LITELLM_API_KEY
        if self._settings.DEEPSEEK_API_KEY:
            litellm.deepseek_key = self._settings.DEEPSEEK_API_KEY
        if self._settings.OPENAI_API_KEY:
            litellm.openai_key = self._settings.OPENAI_API_KEY
        if self._settings.ANTHROPIC_API_KEY:
            litellm.anthropic_key = self._settings.ANTHROPIC_API_KEY

        # Disable LiteLLM telemetry
        litellm.telemetry = False

    # ------------------------------------------------------------------
    # Model Selection
    # ------------------------------------------------------------------

    def select_model(
        self,
        task: str,
        complexity: str = "normal",
        phi_exposure: bool = False,
        latency_req: str = "normal",
    ) -> str:
        """Select the optimal model for a given task.

        Args:
            task: Task identifier matching a key in ``ROUTING_MATRIX``.
            complexity: 'simple', 'normal', or 'complex'.
            phi_exposure: Whether the prompt contains PHI data.
            latency_req: 'low', 'normal', or 'high' (tolerance for latency).

        Returns:
            Model identifier string for LiteLLM.

        Raises:
            ValueError: If task is not found in the routing matrix.
        """
        config = ROUTING_MATRIX.get(task)
        if config is None:
            raise ValueError(
                f"Unknown task '{task}'. Available tasks: {list(ROUTING_MATRIX.keys())}"
            )

        # PHI safety check: prefer PHI-safe models when handling patient data
        phi_safe = config.get("phi_safe_models", [])

        if complexity == "complex":
            model = config["critical"]
        elif complexity == "simple" or latency_req == "low":
            model = config["fallback"]
        else:
            model = config["primary"]

        # Override if PHI is present and selected model isn't PHI-safe
        if phi_exposure and phi_safe and model not in phi_safe:
            # Try to find a PHI-safe alternative
            for candidate in [config["primary"], config["fallback"], config["critical"]]:
                if candidate in phi_safe:
                    self._log.info(
                        "phi_model_override",
                        original=model,
                        override=candidate,
                        task=task,
                    )
                    model = candidate
                    break

        self._log.debug(
            "model_selected",
            task=task,
            model=model,
            complexity=complexity,
            phi_exposure=phi_exposure,
        )

        return model

    # ------------------------------------------------------------------
    # Model Calling
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def call_model(
        self,
        model: str,
        prompt: str | list[dict[str, str]],
        response_schema: dict[str, Any] | None = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        """Call an LLM model via LiteLLM.

        Args:
            model: Model identifier (e.g., 'deepseek/deepseek-chat').
            prompt: Either a string or a list of message dicts.
            response_schema: Optional JSON schema for structured output.
            temperature: Sampling temperature (0.0-2.0).
            max_tokens: Maximum tokens in the response.

        Returns:
            Parsed response as a dictionary.

        Raises:
            Exception: If the model call fails after retries.
        """
        start_time = time.monotonic()

        # Build messages
        if isinstance(prompt, str):
            messages = [{"role": "user", "content": prompt}]
        else:
            messages = prompt

        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # Add response format for structured output
        if response_schema:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await litellm.acompletion(**kwargs)

            duration_ms = (time.monotonic() - start_time) * 1000
            self.monitor_latency(model, duration_ms)

            # Track token usage
            usage = getattr(response, "usage", None)
            if usage:
                input_tokens = getattr(usage, "prompt_tokens", 0)
                output_tokens = getattr(usage, "completion_tokens", 0)

                LLM_TOKEN_USAGE.labels(model_name=model, token_type="input").inc(input_tokens)
                LLM_TOKEN_USAGE.labels(model_name=model, token_type="output").inc(output_tokens)

                cost = self.get_cost_estimate(model, input_tokens, output_tokens)
                LLM_COST_USD.labels(model_name=model, task_type="inference").inc(cost)

            MODEL_INFERENCE_COUNT.labels(
                model_name=model, task_type="llm_call", status="success"
            ).inc()
            MODEL_INFERENCE_DURATION.labels(
                model_name=model, task_type="llm_call"
            ).observe(duration_ms / 1000)

            # Parse response content
            content = response.choices[0].message.content

            # Try to parse as JSON
            if content:
                import json

                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return {"content": content, "text": content}

            return {"content": "", "text": ""}

        except Exception as exc:
            duration_ms = (time.monotonic() - start_time) * 1000

            MODEL_INFERENCE_COUNT.labels(
                model_name=model, task_type="llm_call", status="error"
            ).inc()
            MODEL_INFERENCE_ERRORS.labels(
                model_name=model,
                task_type="llm_call",
                error_type=type(exc).__name__,
            ).inc()

            self._log.error(
                "model_call_failed",
                model=model,
                error=str(exc),
                duration_ms=duration_ms,
            )
            raise

    # ------------------------------------------------------------------
    # Fallback Chain
    # ------------------------------------------------------------------

    async def call_with_fallback(
        self,
        task: str,
        prompt: str | list[dict[str, str]],
        schema: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Call a model with automatic fallback chain.

        Tries primary -> fallback -> critical model, stopping at the
        first successful response.

        Args:
            task: Task identifier.
            prompt: User prompt or message list.
            schema: Optional response schema.

        Returns:
            Model response as dictionary.

        Raises:
            RuntimeError: If all models in the chain fail.
        """
        config = ROUTING_MATRIX.get(task)
        if config is None:
            raise ValueError(f"Unknown task '{task}'.")

        chain = [config["primary"], config["fallback"], config["critical"]]
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique_chain: list[str] = []
        for m in chain:
            if m not in seen:
                seen.add(m)
                unique_chain.append(m)

        temperature = config.get("temperature", 0.1)
        max_tokens = config.get("max_tokens", 4096)

        last_error: Exception | None = None

        for i, model in enumerate(unique_chain):
            # Skip non-LLM models (e.g., paddleocr, statistical_ensemble)
            if model in {"paddleocr", "statistical_ensemble"}:
                continue

            try:
                self._log.info(
                    "attempting_model",
                    task=task,
                    model=model,
                    attempt=i + 1,
                    chain_length=len(unique_chain),
                )

                result = await self.call_model(
                    model=model,
                    prompt=prompt,
                    response_schema=schema,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                if i > 0:
                    MODEL_FALLBACK_COUNT.labels(
                        primary_model=unique_chain[0],
                        fallback_model=model,
                        task_type=task,
                    ).inc()

                return result

            except Exception as exc:
                last_error = exc
                self._log.warning(
                    "model_failed_trying_next",
                    task=task,
                    failed_model=model,
                    error=str(exc),
                )
                continue

        raise RuntimeError(
            f"All models in fallback chain failed for task '{task}'. "
            f"Last error: {last_error}"
        )

    # ------------------------------------------------------------------
    # Latency Monitoring
    # ------------------------------------------------------------------

    def monitor_latency(self, model: str, duration_ms: float) -> None:
        """Track model call latency for routing decisions.

        Maintains a rolling window of the last 100 latency observations
        per model.

        Args:
            model: Model identifier.
            duration_ms: Call duration in milliseconds.
        """
        history = self._latency_history[model]
        history.append(duration_ms)

        # Keep only last 100 observations
        if len(history) > 100:
            self._latency_history[model] = history[-100:]

    def get_average_latency(self, model: str) -> float | None:
        """Get average latency for a model.

        Returns:
            Average latency in ms, or None if no data.
        """
        history = self._latency_history.get(model)
        if not history:
            return None
        return sum(history) / len(history)

    def get_p95_latency(self, model: str) -> float | None:
        """Get p95 latency for a model.

        Returns:
            95th percentile latency in ms, or None if no data.
        """
        history = self._latency_history.get(model)
        if not history or len(history) < 5:
            return None
        sorted_history = sorted(history)
        idx = int(len(sorted_history) * 0.95)
        return sorted_history[min(idx, len(sorted_history) - 1)]

    # ------------------------------------------------------------------
    # Cost Estimation
    # ------------------------------------------------------------------

    def get_cost_estimate(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Estimate the cost of a model call in USD.

        Args:
            model: Model identifier.
            input_tokens: Number of input tokens.
            output_tokens: Number of output tokens.

        Returns:
            Estimated cost in USD.
        """
        costs = _COST_PER_MILLION_TOKENS.get(model)
        if costs is None:
            return 0.0

        input_cost = (input_tokens / 1_000_000) * costs["input"]
        output_cost = (output_tokens / 1_000_000) * costs["output"]

        return round(input_cost + output_cost, 6)
