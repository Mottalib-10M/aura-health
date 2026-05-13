"""Outbreak Detection -- multi-method ensemble for epidemiological surveillance.

Implements EWMA, CUSUM, and Bayesian change-point detection to identify
disease outbreaks from case count time series. Combines methods into a
weighted ensemble and maps scores to alert levels with automated response actions.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.forecasting.schemas import (
    AlertLevel,
    CaseDataPoint,
    DetectionMethod,
    MethodResult,
    OutbreakInput,
    OutbreakResult,
    ResponseAction,
)
from src.utils.metrics import FORECAST_ALERTS, FORECAST_PROCESSING_DURATION

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Alert level sigma thresholds
# ---------------------------------------------------------------------------
_SIGMA_THRESHOLDS = {
    AlertLevel.GREEN: 1.0,    # < 1 sigma -- normal
    AlertLevel.YELLOW: 2.0,   # 1-2 sigma -- watch
    AlertLevel.ORANGE: 3.0,   # 2-3 sigma -- warning
    AlertLevel.RED: float("inf"),  # >= 3 sigma -- critical
}

# ---------------------------------------------------------------------------
# Automated response action templates per alert level
# ---------------------------------------------------------------------------
_RESPONSE_ACTIONS: dict[AlertLevel, list[dict[str, Any]]] = {
    AlertLevel.GREEN: [],
    AlertLevel.YELLOW: [
        {
            "action": "Increase surveillance frequency to daily reporting.",
            "priority": 3,
            "responsible_entity": "District Epidemiologist",
            "deadline_hours": 72,
        },
        {
            "action": "Review case definitions and ensure laboratory confirmation.",
            "priority": 4,
            "responsible_entity": "Laboratory Services",
            "deadline_hours": 120,
        },
    ],
    AlertLevel.ORANGE: [
        {
            "action": "Activate rapid response team for field investigation.",
            "priority": 2,
            "responsible_entity": "Regional Rapid Response Team",
            "deadline_hours": 24,
        },
        {
            "action": "Establish active case finding in affected area.",
            "priority": 2,
            "responsible_entity": "District Health Office",
            "deadline_hours": 48,
        },
        {
            "action": "Pre-position essential medical supplies (antibiotics, PPE, test kits).",
            "priority": 2,
            "responsible_entity": "Supply Chain Unit",
            "deadline_hours": 48,
        },
        {
            "action": "Issue health advisory to healthcare facilities in the region.",
            "priority": 3,
            "responsible_entity": "Communications Unit",
            "deadline_hours": 24,
        },
    ],
    AlertLevel.RED: [
        {
            "action": "Declare outbreak and notify WHO/IHR focal point.",
            "priority": 1,
            "responsible_entity": "National IHR Focal Point",
            "deadline_hours": 6,
        },
        {
            "action": "Activate Emergency Operations Center (EOC).",
            "priority": 1,
            "responsible_entity": "Ministry of Health",
            "deadline_hours": 12,
        },
        {
            "action": "Deploy mobile investigation and treatment teams.",
            "priority": 1,
            "responsible_entity": "National Rapid Response Team",
            "deadline_hours": 12,
        },
        {
            "action": "Implement contact tracing and quarantine measures.",
            "priority": 1,
            "responsible_entity": "District Health Office",
            "deadline_hours": 24,
        },
        {
            "action": "Request international assistance if capacity exceeded.",
            "priority": 2,
            "responsible_entity": "Ministry of Health / WHO Country Office",
            "deadline_hours": 48,
        },
        {
            "action": "Issue public health alert with prevention guidance.",
            "priority": 1,
            "responsible_entity": "Communications Unit",
            "deadline_hours": 6,
        },
    ],
}


class OutbreakDetector:
    """Multi-method outbreak detection engine.

    Combines three statistical methods (EWMA, CUSUM, Bayesian change-point)
    into a weighted ensemble to detect disease outbreaks from case count
    time series data.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._log = logger.bind(component="outbreak_detector")

    # ------------------------------------------------------------------
    # EWMA (Exponentially Weighted Moving Average)
    # ------------------------------------------------------------------

    def ewma(
        self,
        data: np.ndarray,
        span: int = 7,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Compute EWMA control chart for outbreak detection.

        Args:
            data: Array of daily case counts.
            span: EWMA smoothing span in days.

        Returns:
            Tuple of (ewma_values, upper_control_limit, lower_control_limit).
        """
        alpha = 2.0 / (span + 1)
        n = len(data)

        ewma_values = np.zeros(n)
        ewma_values[0] = data[0]

        for i in range(1, n):
            ewma_values[i] = alpha * data[i] + (1 - alpha) * ewma_values[i - 1]

        # Control limits (3-sigma equivalent)
        overall_std = np.std(data)
        sigma_ewma = overall_std * np.sqrt(
            alpha / (2 - alpha) * (1 - (1 - alpha) ** (2 * np.arange(1, n + 1)))
        )

        center = np.mean(data)
        ucl = center + 3 * sigma_ewma
        lcl = center - 3 * sigma_ewma

        return ewma_values, ucl, lcl

    # ------------------------------------------------------------------
    # CUSUM (Cumulative Sum)
    # ------------------------------------------------------------------

    def cusum(
        self,
        data: np.ndarray,
        threshold: float = 5.0,
        drift: float = 1.0,
    ) -> tuple[np.ndarray, np.ndarray, bool]:
        """Run CUSUM algorithm for change-point detection.

        Args:
            data: Array of daily case counts.
            threshold: Decision interval (h), alarm triggered when exceeded.
            drift: Allowable drift (k), typically 0.5-1.0 sigma.

        Returns:
            Tuple of (cumsum_high, cumsum_low, alarm_triggered).
        """
        mean = np.mean(data)
        std = np.std(data)

        if std == 0:
            return np.zeros_like(data), np.zeros_like(data), False

        # Normalise data
        z = (data - mean) / std

        n = len(z)
        s_high = np.zeros(n)
        s_low = np.zeros(n)
        alarm = False

        for i in range(1, n):
            s_high[i] = max(0, s_high[i - 1] + z[i] - drift)
            s_low[i] = min(0, s_low[i - 1] + z[i] + drift)

            if s_high[i] > threshold or s_low[i] < -threshold:
                alarm = True

        return s_high, s_low, alarm

    # ------------------------------------------------------------------
    # Bayesian Change-Point Detection
    # ------------------------------------------------------------------

    def bayesian_detection(
        self,
        data: np.ndarray,
        prior_rate: float | None = None,
    ) -> tuple[float, int | None]:
        """Simple Bayesian change-point detection.

        Models data as a Poisson process and looks for the most likely
        change point where the rate parameter shifts.

        Args:
            data: Array of daily case counts.
            prior_rate: Prior expected rate. If None, uses the first-half mean.

        Returns:
            Tuple of (bayes_factor, most_likely_change_point_index).
        """
        n = len(data)
        if n < 10:
            return 0.0, None

        if prior_rate is None:
            prior_rate = float(np.mean(data[: n // 2]))

        if prior_rate <= 0:
            prior_rate = 0.1

        # Log-likelihood for no change model (single Poisson rate)
        total_sum = np.sum(data)
        rate_no_change = total_sum / n
        if rate_no_change <= 0:
            rate_no_change = 0.1

        ll_no_change = np.sum(data * np.log(rate_no_change) - rate_no_change)

        # Log-likelihood for each possible change point
        best_ll_change = -np.inf
        best_cp: int | None = None

        for cp in range(5, n - 5):
            sum_before = np.sum(data[:cp])
            sum_after = np.sum(data[cp:])

            rate_before = sum_before / cp if cp > 0 else 0.1
            rate_after = sum_after / (n - cp) if (n - cp) > 0 else 0.1

            rate_before = max(rate_before, 0.01)
            rate_after = max(rate_after, 0.01)

            ll_change = (
                np.sum(data[:cp] * np.log(rate_before) - rate_before)
                + np.sum(data[cp:] * np.log(rate_after) - rate_after)
            )

            if ll_change > best_ll_change:
                best_ll_change = ll_change
                best_cp = cp

        # Bayes factor approximation (log scale)
        bayes_factor = best_ll_change - ll_no_change
        # Convert to a 0-1 score
        score = float(1.0 / (1.0 + np.exp(-bayes_factor / 10.0)))

        return score, best_cp

    # ------------------------------------------------------------------
    # Alert Level Classification
    # ------------------------------------------------------------------

    def classify_alert_level(self, sigma_deviation: float) -> AlertLevel:
        """Classify alert level based on sigma deviation from baseline.

        Thresholds:
        - < 1 sigma: GREEN (normal variation)
        - 1-2 sigma: YELLOW (watch)
        - 2-3 sigma: ORANGE (warning)
        - >= 3 sigma: RED (critical)

        Args:
            sigma_deviation: Number of standard deviations above baseline.

        Returns:
            Alert level classification.
        """
        if sigma_deviation < 1.0:
            return AlertLevel.GREEN
        if sigma_deviation < 2.0:
            return AlertLevel.YELLOW
        if sigma_deviation < 3.0:
            return AlertLevel.ORANGE
        return AlertLevel.RED

    # ------------------------------------------------------------------
    # Response Action Generation
    # ------------------------------------------------------------------

    def generate_actions(self, alert_level: AlertLevel) -> list[ResponseAction]:
        """Generate automated response actions based on alert level.

        Args:
            alert_level: Classified alert level.

        Returns:
            List of recommended response actions.
        """
        action_templates = _RESPONSE_ACTIONS.get(alert_level, [])
        return [ResponseAction(**template) for template in action_templates]

    # ------------------------------------------------------------------
    # Main Detection Pipeline
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def detect(
        self,
        input_data: OutbreakInput,
        case_counts: np.ndarray | None = None,
    ) -> OutbreakResult:
        """Run the full outbreak detection ensemble.

        Combines EWMA, CUSUM, and Bayesian change-point detection into
        a weighted ensemble score and maps to alert levels with automated
        response actions.

        Args:
            input_data: Outbreak detection input parameters.
            case_counts: Optional pre-loaded case count array. If None,
                extracts from input_data.case_data.

        Returns:
            Complete ``OutbreakResult``.
        """
        start_time = time.monotonic()
        self._log.info(
            "outbreak_detection_started",
            region=input_data.region,
            disease_code=input_data.disease_code,
            window_days=input_data.window_days,
        )

        # Prepare case count array
        if case_counts is not None:
            data = case_counts.astype(np.float64)
        elif input_data.case_data:
            data = np.array(
                [dp.count for dp in input_data.case_data], dtype=np.float64
            )
        else:
            raise ValueError(
                "Either case_counts array or input_data.case_data must be provided."
            )

        if len(data) < 14:
            raise ValueError(
                f"Insufficient data: {len(data)} days provided, minimum 14 required."
            )

        # Compute baseline statistics
        baseline_data = data[: -input_data.window_days] if len(data) > input_data.window_days else data[: len(data) // 2]
        recent_data = data[-input_data.window_days :]

        baseline_mean = float(np.mean(baseline_data)) if len(baseline_data) > 0 else float(np.mean(data))
        baseline_std = float(np.std(baseline_data)) if len(baseline_data) > 0 else float(np.std(data))
        recent_mean = float(np.mean(recent_data))

        # Sigma deviation
        sigma_deviation = (
            (recent_mean - baseline_mean) / baseline_std
            if baseline_std > 0
            else 0.0
        )

        # Percent change
        percent_change = (
            ((recent_mean - baseline_mean) / baseline_mean) * 100
            if baseline_mean > 0
            else 0.0
        )

        # Method 1: EWMA
        ewma_values, ucl, _lcl = self.ewma(data)
        ewma_violations = int(np.sum(ewma_values[-input_data.window_days :] > ucl[-input_data.window_days :]))
        ewma_score = min(1.0, ewma_violations / max(1, input_data.window_days // 7))
        ewma_anomaly = ewma_violations > 0

        # Method 2: CUSUM
        s_high, _s_low, cusum_alarm = self.cusum(data)
        cusum_max = float(np.max(s_high[-input_data.window_days :]))
        cusum_score = min(1.0, cusum_max / 10.0)

        # Method 3: Bayesian
        bayes_score, change_point = self.bayesian_detection(data)
        bayes_anomaly = bayes_score > 0.7

        # Ensemble score (weighted average)
        weights = {"ewma": 0.35, "cusum": 0.35, "bayesian": 0.30}
        ensemble_score = (
            weights["ewma"] * ewma_score
            + weights["cusum"] * cusum_score
            + weights["bayesian"] * bayes_score
        )

        # Classify alert level
        alert_level = self.classify_alert_level(sigma_deviation)

        # If ensemble score is high but sigma is low, escalate
        if ensemble_score > 0.7 and alert_level == AlertLevel.GREEN:
            alert_level = AlertLevel.YELLOW

        # Generate response actions
        actions = self.generate_actions(alert_level)

        # Compute confidence
        method_agreement = sum([ewma_anomaly, cusum_alarm, bayes_anomaly])
        confidence = min(1.0, 0.5 + method_agreement * 0.15 + abs(sigma_deviation) * 0.05)

        elapsed_ms = (time.monotonic() - start_time) * 1000

        # Record metrics
        FORECAST_ALERTS.labels(
            alert_level=alert_level.value,
            region=input_data.region,
            disease_code=input_data.disease_code,
        ).inc()
        FORECAST_PROCESSING_DURATION.labels(
            forecast_type="outbreak_detection",
        ).observe(elapsed_ms / 1000)

        method_results = [
            MethodResult(
                method=DetectionMethod.EWMA,
                score=round(ewma_score, 4),
                is_anomaly=ewma_anomaly,
                details={
                    "violations": ewma_violations,
                    "span": 7,
                    "recent_ewma": round(float(ewma_values[-1]), 2),
                },
            ),
            MethodResult(
                method=DetectionMethod.CUSUM,
                score=round(cusum_score, 4),
                is_anomaly=cusum_alarm,
                details={
                    "max_cusum": round(cusum_max, 2),
                    "threshold": 5.0,
                    "drift": 1.0,
                },
            ),
            MethodResult(
                method=DetectionMethod.BAYESIAN,
                score=round(bayes_score, 4),
                is_anomaly=bayes_anomaly,
                details={
                    "change_point_index": change_point,
                    "change_point_date": (
                        str(input_data.case_data[change_point].date)
                        if change_point is not None and input_data.case_data and change_point < len(input_data.case_data)
                        else None
                    ),
                },
            ),
        ]

        result = OutbreakResult(
            request_id=input_data.request_id,
            region=input_data.region,
            disease_code=input_data.disease_code,
            alert_level=alert_level,
            ensemble_score=round(ensemble_score, 4),
            sigma_deviation=round(sigma_deviation, 2),
            method_results=method_results,
            case_count_current=int(np.sum(recent_data[-7:])),
            case_count_baseline_avg=round(baseline_mean * 7, 1),
            percent_change=round(percent_change, 1),
            recommended_actions=actions,
            confidence=round(confidence, 3),
            processing_time_ms=round(elapsed_ms, 1),
        )

        self._log.info(
            "outbreak_detection_completed",
            region=input_data.region,
            disease_code=input_data.disease_code,
            alert_level=alert_level,
            sigma_deviation=round(sigma_deviation, 2),
            ensemble_score=round(ensemble_score, 4),
            elapsed_ms=round(elapsed_ms, 1),
        )

        return result
