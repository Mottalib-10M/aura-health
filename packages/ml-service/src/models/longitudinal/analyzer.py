"""Longitudinal Health Analyzer -- trend detection and predictive alerting.

Processes irregular time-series data from wearable devices and clinical records,
computes rolling statistics, detects anomalies against clinical guidelines, and
generates health alerts.
"""

from __future__ import annotations

import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.longitudinal.schemas import (
    AlertSeverity,
    DataPoint,
    ForecastPoint,
    HealthAlert,
    LongitudinalInput,
    LongitudinalOutput,
    MetricType,
    TrendResult,
)
from src.pipelines.ai_router import AIRouter
from src.utils.metrics import MODEL_INFERENCE_DURATION

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Clinical threshold definitions (AHA, WHO, ADA guidelines)
# ---------------------------------------------------------------------------

CRITICAL_THRESHOLDS: dict[MetricType, dict[str, Any]] = {
    MetricType.HEART_RATE: {
        "low_critical": 40,
        "low_warning": 50,
        "high_warning": 100,
        "high_critical": 130,
        "unit": "bpm",
        "guideline": "AHA Heart Rate Guidelines",
    },
    MetricType.BLOOD_PRESSURE_SYSTOLIC: {
        "low_critical": 80,
        "low_warning": 90,
        "high_warning": 130,
        "high_critical": 180,
        "unit": "mmHg",
        "guideline": "AHA/ACC 2017 Hypertension Guidelines",
    },
    MetricType.BLOOD_PRESSURE_DIASTOLIC: {
        "low_critical": 50,
        "low_warning": 60,
        "high_warning": 80,
        "high_critical": 120,
        "unit": "mmHg",
        "guideline": "AHA/ACC 2017 Hypertension Guidelines",
    },
    MetricType.SPO2: {
        "low_critical": 90,
        "low_warning": 94,
        "high_warning": None,
        "high_critical": None,
        "unit": "%",
        "guideline": "WHO Pulse Oximetry Screening",
    },
    MetricType.BLOOD_GLUCOSE: {
        "low_critical": 3.0,
        "low_warning": 3.9,
        "high_warning": 10.0,
        "high_critical": 16.7,
        "unit": "mmol/L",
        "guideline": "WHO/ADA Diabetes Diagnostic Criteria",
    },
    MetricType.TEMPERATURE: {
        "low_critical": 34.0,
        "low_warning": 35.5,
        "high_warning": 37.8,
        "high_critical": 40.0,
        "unit": "C",
        "guideline": "WHO ETAT+ Temperature Thresholds",
    },
    MetricType.RESPIRATORY_RATE: {
        "low_critical": 8,
        "low_warning": 12,
        "high_warning": 20,
        "high_critical": 30,
        "unit": "breaths/min",
        "guideline": "WHO Emergency Respiratory Assessment",
    },
}


class LongitudinalAnalyzer:
    """Longitudinal health data analysis engine.

    Processes irregular wearable and clinical time-series data to compute
    rolling statistics, detect trends, check against clinical thresholds,
    and generate predictive health alerts.
    """

    def __init__(self, ai_router: AIRouter) -> None:
        self._router = ai_router
        self._settings = get_settings()
        self._log = logger.bind(component="longitudinal_analyzer")

    # ------------------------------------------------------------------
    # Data Resampling
    # ------------------------------------------------------------------

    def resample_data(
        self,
        metrics: list[DataPoint],
        interval_hours: float = 1.0,
    ) -> dict[MetricType, list[tuple[datetime, float]]]:
        """Normalize irregular wearable data to fixed-interval time series
        using linear interpolation.

        Args:
            metrics: Raw data points (must be pre-sorted by timestamp).
            interval_hours: Target interval in hours for resampling.

        Returns:
            Dict mapping each metric type to a list of (timestamp, value) tuples
            at the target interval.
        """
        grouped: dict[MetricType, list[tuple[datetime, float]]] = defaultdict(list)
        for dp in metrics:
            grouped[dp.metric].append((dp.timestamp, dp.value))

        resampled: dict[MetricType, list[tuple[datetime, float]]] = {}

        for metric_type, points in grouped.items():
            if len(points) < 2:
                resampled[metric_type] = points
                continue

            points.sort(key=lambda x: x[0])
            start_time = points[0][0]
            end_time = points[-1][0]
            interval = timedelta(hours=interval_hours)

            timestamps = [p[0] for p in points]
            values = [p[1] for p in points]

            # Build resampled timeline
            current = start_time
            result: list[tuple[datetime, float]] = []

            while current <= end_time:
                # Find bracketing points for interpolation
                idx = 0
                while idx < len(timestamps) - 1 and timestamps[idx + 1] < current:
                    idx += 1

                if idx >= len(timestamps) - 1:
                    result.append((current, values[-1]))
                elif timestamps[idx] == current:
                    result.append((current, values[idx]))
                else:
                    # Linear interpolation
                    t0, v0 = timestamps[idx], values[idx]
                    t1, v1 = timestamps[idx + 1], values[idx + 1]
                    dt_total = (t1 - t0).total_seconds()
                    dt_current = (current - t0).total_seconds()
                    if dt_total > 0:
                        ratio = dt_current / dt_total
                        interpolated = v0 + ratio * (v1 - v0)
                    else:
                        interpolated = v0
                    result.append((current, interpolated))

                current += interval

            resampled[metric_type] = result

        return resampled

    # ------------------------------------------------------------------
    # Feature Calculation
    # ------------------------------------------------------------------

    def calculate_features(
        self,
        metrics: dict[MetricType, list[tuple[datetime, float]]],
    ) -> dict[MetricType, TrendResult]:
        """Compute rolling 7-day averages, volatility index, circadian rhythm
        scores, and linear trend for each metric.

        Args:
            metrics: Resampled time-series data keyed by metric type.

        Returns:
            Dict mapping metric type to computed ``TrendResult``.
        """
        results: dict[MetricType, TrendResult] = {}

        for metric_type, series in metrics.items():
            if len(series) < 3:
                results[metric_type] = TrendResult(
                    metric=metric_type,
                    direction="insufficient_data",
                    slope=0.0,
                    r_squared=0.0,
                    min_value=series[0][1] if series else 0.0,
                    max_value=series[0][1] if series else 0.0,
                    current_value=series[-1][1] if series else 0.0,
                    sample_count=len(series),
                )
                continue

            values = np.array([v for _, v in series])
            timestamps_seconds = np.array(
                [(t - series[0][0]).total_seconds() for t, _ in series]
            )

            # Linear regression for trend direction
            if len(timestamps_seconds) >= 2:
                coeffs = np.polyfit(timestamps_seconds, values, 1)
                slope = float(coeffs[0])
                predicted = np.polyval(coeffs, timestamps_seconds)
                ss_res = np.sum((values - predicted) ** 2)
                ss_tot = np.sum((values - np.mean(values)) ** 2)
                r_squared = float(1.0 - ss_res / ss_tot) if ss_tot > 0 else 0.0
            else:
                slope = 0.0
                r_squared = 0.0

            # Determine direction from slope significance
            if abs(slope) < 1e-8 or r_squared < 0.1:
                direction = "stable"
            elif slope > 0:
                # For metrics where higher is worse (HR, BP, glucose, temp, RR)
                worsening_metrics = {
                    MetricType.HEART_RATE,
                    MetricType.BLOOD_PRESSURE_SYSTOLIC,
                    MetricType.BLOOD_PRESSURE_DIASTOLIC,
                    MetricType.BLOOD_GLUCOSE,
                    MetricType.TEMPERATURE,
                    MetricType.RESPIRATORY_RATE,
                }
                direction = "worsening" if metric_type in worsening_metrics else "improving"
            else:
                improving_metrics = {MetricType.SPO2, MetricType.HRV_MS, MetricType.SLEEP_HOURS}
                direction = "worsening" if metric_type in improving_metrics else "improving"

            # Rolling 7-day statistics
            window_size = min(168, len(values))  # 168 hours = 7 days at 1h interval
            if len(values) >= window_size:
                rolling_values = values[-window_size:]
                rolling_mean = float(np.mean(rolling_values))
                rolling_std = float(np.std(rolling_values))
            else:
                rolling_mean = float(np.mean(values))
                rolling_std = float(np.std(values))

            # Volatility index (coefficient of variation)
            volatility = float(rolling_std / rolling_mean) if rolling_mean != 0 else 0.0

            # Circadian rhythm score (regularity of 24h pattern)
            circadian_score = self._compute_circadian_score(series)

            results[metric_type] = TrendResult(
                metric=metric_type,
                direction=direction,
                slope=round(slope, 8),
                r_squared=round(r_squared, 4),
                rolling_mean_7d=round(rolling_mean, 2),
                rolling_std_7d=round(rolling_std, 2),
                volatility_index=round(volatility, 4),
                circadian_score=circadian_score,
                min_value=round(float(np.min(values)), 2),
                max_value=round(float(np.max(values)), 2),
                current_value=round(float(values[-1]), 2),
                sample_count=len(values),
            )

        return results

    def _compute_circadian_score(
        self,
        series: list[tuple[datetime, float]],
    ) -> float | None:
        """Compute a circadian rhythm regularity score (0-1).

        Measures how consistently the metric follows a 24-hour pattern by
        comparing hour-of-day averages across days.

        Returns:
            Score between 0 (no pattern) and 1 (perfectly regular), or None
            if insufficient data (< 48h).
        """
        if len(series) < 48:
            return None

        hourly_values: dict[int, list[float]] = defaultdict(list)
        for ts, val in series:
            hourly_values[ts.hour].append(val)

        # Need at least 12 hours with data
        if len(hourly_values) < 12:
            return None

        # Compute variance of hourly means vs overall variance
        hourly_means = [np.mean(vals) for vals in hourly_values.values() if len(vals) >= 2]
        if len(hourly_means) < 12:
            return None

        all_values = [v for _, v in series]
        total_variance = np.var(all_values)
        between_hour_variance = np.var(hourly_means)

        if total_variance == 0:
            return 1.0

        # Ratio of between-hour variance to total variance
        score = float(min(1.0, between_hour_variance / total_variance))
        return round(score, 3)

    # ------------------------------------------------------------------
    # Clinical Threshold Checking
    # ------------------------------------------------------------------

    def check_critical_thresholds(
        self,
        trends: dict[MetricType, TrendResult],
    ) -> list[HealthAlert]:
        """Compare current values and trends against clinical guidelines.

        Checks against AHA cardiovascular guidelines, WHO diabetes criteria,
        and other established thresholds.

        Args:
            trends: Computed trend results for each metric.

        Returns:
            List of health alerts for threshold violations.
        """
        alerts: list[HealthAlert] = []

        for metric_type, trend in trends.items():
            thresholds = CRITICAL_THRESHOLDS.get(metric_type)
            if thresholds is None:
                continue

            current = trend.current_value

            # Critical low
            if thresholds["low_critical"] is not None and current <= thresholds["low_critical"]:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.CRITICAL,
                    metric=metric_type,
                    title=f"Critically low {metric_type.value}",
                    description=(
                        f"Current {metric_type.value} is {current} {thresholds['unit']}, "
                        f"which is below the critical threshold of "
                        f"{thresholds['low_critical']} {thresholds['unit']}."
                    ),
                    threshold_value=thresholds["low_critical"],
                    actual_value=current,
                    guideline_reference=thresholds["guideline"],
                    recommended_action="Seek immediate medical attention.",
                ))
            # Warning low
            elif thresholds["low_warning"] is not None and current <= thresholds["low_warning"]:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.WARNING,
                    metric=metric_type,
                    title=f"Low {metric_type.value}",
                    description=(
                        f"Current {metric_type.value} is {current} {thresholds['unit']}, "
                        f"below the warning threshold of {thresholds['low_warning']} {thresholds['unit']}."
                    ),
                    threshold_value=thresholds["low_warning"],
                    actual_value=current,
                    guideline_reference=thresholds["guideline"],
                    recommended_action="Monitor closely and consult healthcare provider if persists.",
                ))

            # Critical high
            if thresholds["high_critical"] is not None and current >= thresholds["high_critical"]:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.CRITICAL,
                    metric=metric_type,
                    title=f"Critically high {metric_type.value}",
                    description=(
                        f"Current {metric_type.value} is {current} {thresholds['unit']}, "
                        f"which exceeds the critical threshold of "
                        f"{thresholds['high_critical']} {thresholds['unit']}."
                    ),
                    threshold_value=thresholds["high_critical"],
                    actual_value=current,
                    guideline_reference=thresholds["guideline"],
                    recommended_action="Seek immediate medical attention.",
                ))
            # Warning high
            elif thresholds["high_warning"] is not None and current >= thresholds["high_warning"]:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.WARNING,
                    metric=metric_type,
                    title=f"Elevated {metric_type.value}",
                    description=(
                        f"Current {metric_type.value} is {current} {thresholds['unit']}, "
                        f"above the warning threshold of {thresholds['high_warning']} {thresholds['unit']}."
                    ),
                    threshold_value=thresholds["high_warning"],
                    actual_value=current,
                    guideline_reference=thresholds["guideline"],
                    recommended_action="Consult healthcare provider for evaluation.",
                ))

            # Trend-based alerts
            if trend.direction == "worsening" and trend.r_squared >= 0.5:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.WARNING,
                    metric=metric_type,
                    title=f"Worsening trend in {metric_type.value}",
                    description=(
                        f"{metric_type.value} shows a statistically significant worsening trend "
                        f"(slope={trend.slope:.6f}, R²={trend.r_squared:.2f})."
                    ),
                    threshold_value=None,
                    actual_value=current,
                    guideline_reference=thresholds.get("guideline"),
                    recommended_action="Review trend with healthcare provider at next visit.",
                ))

            # High volatility alert
            if trend.volatility_index is not None and trend.volatility_index > 0.3:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.INFO,
                    metric=metric_type,
                    title=f"High variability in {metric_type.value}",
                    description=(
                        f"{metric_type.value} shows high variability "
                        f"(volatility index={trend.volatility_index:.2f}). "
                        f"This may indicate measurement issues or unstable physiological state."
                    ),
                    threshold_value=None,
                    actual_value=current,
                    guideline_reference=None,
                    recommended_action="Verify measurement technique and sensor placement.",
                ))

        return alerts

    # ------------------------------------------------------------------
    # Alert Generation
    # ------------------------------------------------------------------

    def generate_alerts(
        self,
        trends: dict[MetricType, TrendResult],
        chronic_conditions: list[str] | None = None,
    ) -> list[HealthAlert]:
        """Generate all applicable health alerts from analysis results.

        Combines threshold-based alerts with condition-specific rules.

        Args:
            trends: Computed trend results.
            chronic_conditions: Patient's active chronic conditions.

        Returns:
            Deduplicated, priority-sorted list of health alerts.
        """
        alerts = self.check_critical_thresholds(trends)

        # Condition-specific checks
        conditions_lower = {c.lower() for c in (chronic_conditions or [])}

        # Diabetes-specific: tighter glucose monitoring
        if any("diabet" in c for c in conditions_lower):
            glucose_trend = trends.get(MetricType.BLOOD_GLUCOSE)
            if glucose_trend and glucose_trend.volatility_index is not None:
                if glucose_trend.volatility_index > 0.2:
                    alerts.append(HealthAlert(
                        alert_id=str(uuid.uuid4()),
                        severity=AlertSeverity.WARNING,
                        metric=MetricType.BLOOD_GLUCOSE,
                        title="Glucose variability concern (diabetic patient)",
                        description=(
                            f"Blood glucose shows elevated variability "
                            f"(CV={glucose_trend.volatility_index:.2f}) in a diabetic patient. "
                            f"Target CV is < 0.36 per ADA guidelines."
                        ),
                        threshold_value=0.2,
                        actual_value=glucose_trend.volatility_index,
                        guideline_reference="ADA Standards of Medical Care in Diabetes 2024",
                        recommended_action="Review insulin dosing and meal timing with endocrinologist.",
                    ))

        # Hypertension-specific: stricter BP targets
        if any("hypertens" in c for c in conditions_lower):
            sbp_trend = trends.get(MetricType.BLOOD_PRESSURE_SYSTOLIC)
            if sbp_trend and sbp_trend.current_value >= 120:
                alerts.append(HealthAlert(
                    alert_id=str(uuid.uuid4()),
                    severity=AlertSeverity.WARNING,
                    metric=MetricType.BLOOD_PRESSURE_SYSTOLIC,
                    title="Above target BP for hypertensive patient",
                    description=(
                        f"Current SBP is {sbp_trend.current_value} mmHg. "
                        f"Target for managed hypertension is < 120/80 mmHg per AHA/ACC."
                    ),
                    threshold_value=120.0,
                    actual_value=sbp_trend.current_value,
                    guideline_reference="AHA/ACC 2017 Hypertension Guidelines",
                    recommended_action="Review antihypertensive regimen with cardiologist.",
                ))

        # Sort by severity (critical first)
        severity_order = {AlertSeverity.CRITICAL: 0, AlertSeverity.WARNING: 1, AlertSeverity.INFO: 2}
        alerts.sort(key=lambda a: severity_order.get(a.severity, 3))

        return alerts

    # ------------------------------------------------------------------
    # Model Selection
    # ------------------------------------------------------------------

    def _select_model(self, data_complexity: str) -> str:
        """Select model based on data complexity.

        Args:
            data_complexity: One of 'simple', 'moderate', 'complex'.

        Returns:
            Model identifier for LiteLLM.
        """
        if data_complexity == "complex":
            return "deepseek/deepseek-reasoner"
        return "openai/gpt-4.1-nano"

    def _assess_complexity(self, metrics: dict[MetricType, list[tuple[datetime, float]]]) -> str:
        """Assess data complexity for model routing.

        Returns:
            'simple', 'moderate', or 'complex'.
        """
        metric_count = len(metrics)
        total_points = sum(len(v) for v in metrics.values())

        if metric_count >= 5 or total_points >= 5000:
            return "complex"
        if metric_count >= 3 or total_points >= 1000:
            return "moderate"
        return "simple"

    # ------------------------------------------------------------------
    # Main Analysis Pipeline
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def analyze(self, input_data: LongitudinalInput) -> LongitudinalOutput:
        """Execute the full longitudinal analysis pipeline.

        Steps:
        1. Resample irregular data to fixed intervals
        2. Compute features (trends, rolling stats, circadian scores)
        3. Check clinical thresholds and generate alerts
        4. Optionally generate forecasts via LLM
        5. Produce summary

        Args:
            input_data: Validated ``LongitudinalInput``.

        Returns:
            Complete ``LongitudinalOutput`` with trends, alerts, and summary.
        """
        start_time = time.monotonic()
        self._log.info(
            "longitudinal_analysis_started",
            patient_id=input_data.patient_id,
            metric_count=len(input_data.metrics),
            window_days=input_data.analysis_window_days,
        )

        # Step 1: Resample
        resampled = self.resample_data(input_data.metrics, interval_hours=1.0)

        # Step 2: Feature calculation
        trends = self.calculate_features(resampled)

        # Step 3: Alert generation
        alerts = self.generate_alerts(
            trends,
            chronic_conditions=input_data.chronic_conditions,
        )

        # Step 4: Model-based summary and forecasts
        complexity = self._assess_complexity(resampled)
        model = self._select_model(complexity)

        trend_summary_parts = []
        for mt, tr in trends.items():
            trend_summary_parts.append(
                f"- {mt.value}: current={tr.current_value}, direction={tr.direction}, "
                f"7d_mean={tr.rolling_mean_7d}, volatility={tr.volatility_index}"
            )

        alert_summary_parts = [f"- [{a.severity}] {a.title}" for a in alerts]

        prompt = [
            {
                "role": "system",
                "content": (
                    "You are a clinical health data analyst. Summarize the patient's "
                    "health trends and alerts in 3-5 sentences. Focus on actionable insights "
                    "and clinical significance. Be concise and professional."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Patient ID: {input_data.patient_id}\n"
                    f"Analysis window: {input_data.analysis_window_days} days\n"
                    f"Chronic conditions: {', '.join(input_data.chronic_conditions) or 'None'}\n"
                    f"Medications: {', '.join(input_data.medications) or 'None'}\n\n"
                    f"Trends:\n{'chr(10)'.join(trend_summary_parts)}\n\n"
                    f"Alerts ({len(alerts)}):\n{'chr(10)'.join(alert_summary_parts) or 'None'}"
                ),
            },
        ]

        try:
            summary_response = await self._router.call_model(
                model=model,
                prompt=prompt,
                temperature=0.2,
            )
            summary = summary_response.get("content", summary_response.get("text", "Analysis complete."))
            if isinstance(summary, dict):
                summary = str(summary)
        except Exception:
            self._log.warning("summary_generation_failed", model=model)
            summary = (
                f"Longitudinal analysis of {len(trends)} metrics over "
                f"{input_data.analysis_window_days} days. "
                f"{len(alerts)} alert(s) generated."
            )

        # Compute overall health score (0-100)
        health_score = self._compute_health_score(trends, alerts)

        elapsed_ms = (time.monotonic() - start_time) * 1000
        MODEL_INFERENCE_DURATION.labels(
            model_name=model, task_type="longitudinal"
        ).observe(elapsed_ms / 1000)

        output = LongitudinalOutput(
            request_id=input_data.request_id,
            patient_id=input_data.patient_id,
            analysis_window_days=input_data.analysis_window_days,
            trends=list(trends.values()),
            forecasts={},
            alerts=alerts,
            overall_health_score=health_score,
            summary=summary if isinstance(summary, str) else str(summary),
            model_used=model,
            processing_time_ms=elapsed_ms,
        )

        self._log.info(
            "longitudinal_analysis_completed",
            patient_id=input_data.patient_id,
            trend_count=len(output.trends),
            alert_count=len(output.alerts),
            health_score=health_score,
            elapsed_ms=elapsed_ms,
        )

        return output

    # ------------------------------------------------------------------
    # Health Score
    # ------------------------------------------------------------------

    def _compute_health_score(
        self,
        trends: dict[MetricType, TrendResult],
        alerts: list[HealthAlert],
    ) -> float:
        """Compute an overall health score (0-100) based on trends and alerts.

        Starts at 100 and deducts points for:
        - Worsening trends (-5 per metric)
        - Warning alerts (-3 each)
        - Critical alerts (-10 each)
        - High volatility (-2 per metric)
        """
        score = 100.0

        for _mt, trend in trends.items():
            if trend.direction == "worsening":
                score -= 5.0
            if trend.volatility_index is not None and trend.volatility_index > 0.3:
                score -= 2.0

        for alert in alerts:
            if alert.severity == AlertSeverity.CRITICAL:
                score -= 10.0
            elif alert.severity == AlertSeverity.WARNING:
                score -= 3.0
            else:
                score -= 1.0

        return round(max(0.0, min(100.0, score)), 1)
