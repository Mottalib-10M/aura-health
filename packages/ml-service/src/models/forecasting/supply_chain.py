"""Supply Chain Forecasting -- multi-model ensemble for pharmaceutical demand.

Implements ARIMA, Prophet, and LSTM-based demand forecasting with weighted
ensemble combination, stockout risk assessment, and automated order
recommendations.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config.settings import get_settings
from src.models.forecasting.schemas import (
    ForecastMethod,
    ForecastPoint,
    MethodForecast,
    OrderRecommendation,
    StockoutRisk,
    SupplyForecast,
    SupplyForecastInput,
    SupplyHistoryPoint,
)
from src.utils.metrics import FORECAST_PROCESSING_DURATION

logger = structlog.get_logger(__name__)


class SupplyForecaster:
    """Multi-model supply chain demand forecaster.

    Combines ARIMA, Prophet, and LSTM models into a weighted ensemble
    forecast. Includes stockout risk assessment and automated order
    recommendations based on criticality and supplier availability.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._log = logger.bind(component="supply_forecaster")
        self._prophet_model: Any = None
        self._lstm_model: Any = None

    # ------------------------------------------------------------------
    # ARIMA Forecast
    # ------------------------------------------------------------------

    def arima_forecast(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int = 6,
    ) -> MethodForecast:
        """Generate demand forecast using ARIMA-like approach.

        Uses a simplified autoregressive model when statsmodels is not
        available, falling back to exponential smoothing.

        Args:
            history: Historical supply/demand data.
            horizon_months: Number of months to forecast.

        Returns:
            ARIMA method forecast with confidence intervals.
        """
        demands = np.array([h.demand_units for h in history], dtype=np.float64)
        dates = [h.date for h in history]

        if len(demands) < 12:
            # Insufficient data: use simple moving average
            avg = float(np.mean(demands))
            std = float(np.std(demands)) if len(demands) > 1 else avg * 0.2
            forecast_points = self._generate_forecast_points(
                start_date=dates[-1],
                horizon_months=horizon_months,
                values=np.full(horizon_months * 30, avg),
                stds=np.full(horizon_months * 30, std),
            )
            return MethodForecast(
                method=ForecastMethod.ARIMA,
                points=forecast_points,
                mape=None,
                weight=0.2,
            )

        # Exponential smoothing (Holt-Winters-like without seasonality library)
        alpha = 0.3  # Level smoothing
        beta = 0.1   # Trend smoothing

        level = demands[0]
        trend = float(np.mean(np.diff(demands[:12])))

        fitted: list[float] = []
        for d in demands:
            forecast_val = level + trend
            fitted.append(forecast_val)
            level = alpha * d + (1 - alpha) * (level + trend)
            trend = beta * (level - (level - trend)) + (1 - beta) * trend

        # Calculate MAPE on last 20% of data
        val_size = max(3, len(demands) // 5)
        actual = demands[-val_size:]
        predicted = np.array(fitted[-val_size:])
        mape = float(np.mean(np.abs((actual - predicted) / np.maximum(actual, 1))) * 100)

        # Generate future forecasts
        future_values: list[float] = []
        for i in range(horizon_months * 30):
            forecast_val = level + trend * (i + 1)
            future_values.append(max(0, forecast_val))

        residuals = demands - np.array(fitted)
        residual_std = float(np.std(residuals))

        forecast_points = self._generate_forecast_points(
            start_date=dates[-1],
            horizon_months=horizon_months,
            values=np.array(future_values),
            stds=np.full(len(future_values), residual_std * np.sqrt(np.arange(1, len(future_values) + 1) * 0.1 + 1)),
        )

        return MethodForecast(
            method=ForecastMethod.ARIMA,
            points=forecast_points,
            mape=round(mape, 2),
            weight=0.35,
        )

    # ------------------------------------------------------------------
    # Prophet Forecast
    # ------------------------------------------------------------------

    def prophet_forecast(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int = 6,
    ) -> MethodForecast:
        """Generate demand forecast using Facebook Prophet for seasonal patterns.

        Args:
            history: Historical supply/demand data.
            horizon_months: Number of months to forecast.

        Returns:
            Prophet method forecast with uncertainty intervals.
        """
        demands = np.array([h.demand_units for h in history], dtype=np.float64)
        dates = [h.date for h in history]

        try:
            from prophet import Prophet
            import pandas as pd

            df = pd.DataFrame({
                "ds": [datetime.combine(d, datetime.min.time()) for d in dates],
                "y": demands,
            })

            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
                interval_width=0.95,
            )
            model.fit(df)

            future = model.make_future_dataframe(periods=horizon_months * 30)
            prediction = model.predict(future)

            # Extract forecast period only
            forecast_rows = prediction.iloc[len(dates):]

            points: list[ForecastPoint] = []
            for _, row in forecast_rows.iterrows():
                points.append(ForecastPoint(
                    date=row["ds"].date(),
                    predicted_demand=max(0, round(float(row["yhat"]), 1)),
                    lower_bound=max(0, round(float(row["yhat_lower"]), 1)),
                    upper_bound=max(0, round(float(row["yhat_upper"]), 1)),
                    confidence=0.95,
                ))

            # MAPE on training data
            in_sample = prediction.iloc[: len(dates)]
            mape = float(np.mean(
                np.abs((demands - in_sample["yhat"].values) / np.maximum(demands, 1))
            ) * 100)

            return MethodForecast(
                method=ForecastMethod.PROPHET,
                points=points,
                mape=round(mape, 2),
                weight=0.40,
            )

        except ImportError:
            self._log.warning("prophet_not_available", fallback="seasonal_decomposition")
            return self._seasonal_fallback(history, horizon_months)

    def _seasonal_fallback(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int,
    ) -> MethodForecast:
        """Fallback seasonal forecast when Prophet is unavailable."""
        demands = np.array([h.demand_units for h in history], dtype=np.float64)
        dates = [h.date for h in history]

        # Simple seasonal decomposition (monthly patterns)
        monthly_avgs: dict[int, list[float]] = {}
        for d, demand_val in zip(dates, demands, strict=False):
            monthly_avgs.setdefault(d.month, []).append(demand_val)

        seasonal_pattern = {
            m: float(np.mean(vals)) for m, vals in monthly_avgs.items()
        }
        overall_avg = float(np.mean(demands))
        std = float(np.std(demands))

        points: list[ForecastPoint] = []
        current_date = dates[-1] + timedelta(days=1)
        for _ in range(horizon_months * 30):
            month_avg = seasonal_pattern.get(current_date.month, overall_avg)
            points.append(ForecastPoint(
                date=current_date,
                predicted_demand=max(0, round(month_avg, 1)),
                lower_bound=max(0, round(month_avg - 1.96 * std, 1)),
                upper_bound=max(0, round(month_avg + 1.96 * std, 1)),
                confidence=0.80,
            ))
            current_date += timedelta(days=1)

        return MethodForecast(
            method=ForecastMethod.PROPHET,
            points=points,
            mape=None,
            weight=0.30,
        )

    # ------------------------------------------------------------------
    # LSTM Forecast
    # ------------------------------------------------------------------

    def lstm_forecast(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int = 6,
    ) -> MethodForecast:
        """Generate demand forecast using LSTM neural network.

        Uses a simple LSTM architecture for sequential demand prediction.
        Falls back to autoregressive approach if PyTorch is unavailable.

        Args:
            history: Historical supply/demand data.
            horizon_months: Number of months to forecast.

        Returns:
            LSTM method forecast.
        """
        demands = np.array([h.demand_units for h in history], dtype=np.float64)
        dates = [h.date for h in history]

        try:
            import torch
            import torch.nn as nn

            # Normalise
            mean_val = float(np.mean(demands))
            std_val = float(np.std(demands)) if np.std(demands) > 0 else 1.0
            normalised = (demands - mean_val) / std_val

            # Prepare sequences
            seq_length = min(30, len(normalised) // 3)
            if seq_length < 5:
                return self._ar_fallback(history, horizon_months)

            sequences: list[np.ndarray] = []
            targets: list[float] = []
            for i in range(len(normalised) - seq_length):
                sequences.append(normalised[i : i + seq_length])
                targets.append(normalised[i + seq_length])

            X = torch.FloatTensor(np.array(sequences)).unsqueeze(-1)
            y = torch.FloatTensor(np.array(targets))

            # Simple LSTM model
            class DemandLSTM(nn.Module):
                def __init__(self, input_size: int = 1, hidden_size: int = 32, num_layers: int = 1) -> None:
                    super().__init__()
                    self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
                    self.fc = nn.Linear(hidden_size, 1)

                def forward(self, x: torch.Tensor) -> torch.Tensor:
                    lstm_out, _ = self.lstm(x)
                    return self.fc(lstm_out[:, -1, :]).squeeze(-1)

            model = DemandLSTM()
            optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
            criterion = nn.MSELoss()

            # Train
            model.train()
            for epoch in range(100):
                optimizer.zero_grad()
                output = model(X)
                loss = criterion(output, y)
                loss.backward()
                optimizer.step()

            # Forecast
            model.eval()
            last_seq = torch.FloatTensor(normalised[-seq_length:]).unsqueeze(0).unsqueeze(-1)
            future_values: list[float] = []

            with torch.no_grad():
                current_seq = last_seq.clone()
                for _ in range(horizon_months * 30):
                    pred = model(current_seq)
                    pred_val = float(pred.item())
                    future_values.append(pred_val * std_val + mean_val)
                    # Shift sequence
                    new_point = torch.FloatTensor([[[pred_val]]])
                    current_seq = torch.cat([current_seq[:, 1:, :], new_point], dim=1)

            # MAPE on validation
            val_size = max(3, len(y) // 5)
            with torch.no_grad():
                val_pred = model(X[-val_size:])
            val_actual = y[-val_size:].numpy() * std_val + mean_val
            val_predicted = val_pred.numpy() * std_val + mean_val
            mape = float(np.mean(np.abs((val_actual - val_predicted) / np.maximum(np.abs(val_actual), 1))) * 100)

            # Generate forecast points with uncertainty
            residual_std = std_val * 0.5
            forecast_points = self._generate_forecast_points(
                start_date=dates[-1],
                horizon_months=horizon_months,
                values=np.array([max(0, v) for v in future_values]),
                stds=np.full(len(future_values), residual_std) * np.sqrt(
                    np.arange(1, len(future_values) + 1) * 0.05 + 1
                ),
            )

            return MethodForecast(
                method=ForecastMethod.LSTM,
                points=forecast_points,
                mape=round(mape, 2),
                weight=0.25,
            )

        except ImportError:
            self._log.warning("pytorch_not_available", fallback="autoregressive")
            return self._ar_fallback(history, horizon_months)

    def _ar_fallback(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int,
    ) -> MethodForecast:
        """Autoregressive fallback when PyTorch is unavailable."""
        demands = np.array([h.demand_units for h in history], dtype=np.float64)
        dates = [h.date for h in history]

        # AR(1) model
        if len(demands) < 3:
            avg = float(np.mean(demands))
            std = float(np.std(demands)) if len(demands) > 1 else avg * 0.2
            forecast_points = self._generate_forecast_points(
                start_date=dates[-1],
                horizon_months=horizon_months,
                values=np.full(horizon_months * 30, avg),
                stds=np.full(horizon_months * 30, std),
            )
            return MethodForecast(
                method=ForecastMethod.LSTM,
                points=forecast_points,
                mape=None,
                weight=0.15,
            )

        # Compute AR(1) coefficient
        y = demands[1:]
        x = demands[:-1]
        mean_x = np.mean(x)
        phi = float(np.sum((x - mean_x) * (y - np.mean(y))) / np.sum((x - mean_x) ** 2)) if np.sum((x - mean_x) ** 2) > 0 else 0.5
        intercept = float(np.mean(y) - phi * mean_x)

        # Generate forecast
        future_values: list[float] = []
        last_val = float(demands[-1])
        for _ in range(horizon_months * 30):
            next_val = intercept + phi * last_val
            future_values.append(max(0, next_val))
            last_val = next_val

        residuals = y - (intercept + phi * x)
        residual_std = float(np.std(residuals))

        forecast_points = self._generate_forecast_points(
            start_date=dates[-1],
            horizon_months=horizon_months,
            values=np.array(future_values),
            stds=np.full(len(future_values), residual_std),
        )

        return MethodForecast(
            method=ForecastMethod.LSTM,
            points=forecast_points,
            mape=None,
            weight=0.15,
        )

    # ------------------------------------------------------------------
    # Ensemble Forecast
    # ------------------------------------------------------------------

    def ensemble_forecast(
        self,
        history: list[SupplyHistoryPoint],
        horizon_months: int = 6,
    ) -> tuple[list[ForecastPoint], list[MethodForecast]]:
        """Compute weighted ensemble of ARIMA, Prophet, and LSTM forecasts.

        Weights are based on each method's MAPE performance. Methods with
        lower MAPE get higher weights.

        Args:
            history: Historical supply/demand data.
            horizon_months: Forecast horizon.

        Returns:
            Tuple of (ensemble forecast points, individual method forecasts).
        """
        arima = self.arima_forecast(history, horizon_months)
        prophet = self.prophet_forecast(history, horizon_months)
        lstm = self.lstm_forecast(history, horizon_months)

        methods = [arima, prophet, lstm]

        # Recalculate weights based on MAPE (lower MAPE = higher weight)
        mapes = []
        for m in methods:
            if m.mape is not None and m.mape > 0:
                mapes.append(1.0 / m.mape)
            else:
                mapes.append(m.weight)

        total_weight = sum(mapes) if sum(mapes) > 0 else 1.0
        normalised_weights = [w / total_weight for w in mapes]

        for m, w in zip(methods, normalised_weights, strict=False):
            m.weight = round(w, 3)

        # Combine forecasts
        min_points = min(len(m.points) for m in methods)
        ensemble_points: list[ForecastPoint] = []

        for i in range(min_points):
            weighted_demand = sum(
                m.points[i].predicted_demand * m.weight
                for m in methods
            )
            weighted_lower = sum(
                m.points[i].lower_bound * m.weight
                for m in methods
            )
            weighted_upper = sum(
                m.points[i].upper_bound * m.weight
                for m in methods
            )
            avg_confidence = sum(
                m.points[i].confidence * m.weight
                for m in methods
            )

            ensemble_points.append(ForecastPoint(
                date=methods[0].points[i].date,
                predicted_demand=round(weighted_demand, 1),
                lower_bound=round(max(0, weighted_lower), 1),
                upper_bound=round(weighted_upper, 1),
                confidence=round(avg_confidence, 3),
            ))

        return ensemble_points, methods

    # ------------------------------------------------------------------
    # Risk Assessment
    # ------------------------------------------------------------------

    def assess_risk(
        self,
        current_stock: int,
        forecast: list[ForecastPoint],
        daily_consumption: float | None = None,
    ) -> StockoutRisk:
        """Assess probability and timing of pharmaceutical stockout.

        Args:
            current_stock: Current inventory in units.
            forecast: Demand forecast points.
            daily_consumption: Current daily consumption rate. If None,
                estimated from first forecast week.

        Returns:
            Stockout risk assessment.
        """
        if not forecast:
            return StockoutRisk(
                probability=0.0,
                days_until_stockout=None,
                criticality="low",
                current_stock_units=current_stock,
                current_stock_days=0.0,
            )

        if daily_consumption is None:
            daily_consumption = float(np.mean([
                fp.predicted_demand for fp in forecast[:7]
            ]))

        daily_consumption = max(daily_consumption, 0.01)  # Avoid division by zero
        stock_days = current_stock / daily_consumption

        # Simulate cumulative demand vs stock
        cumulative_demand = 0.0
        days_until_stockout: int | None = None

        for i, fp in enumerate(forecast):
            cumulative_demand += fp.predicted_demand
            if cumulative_demand >= current_stock:
                days_until_stockout = i + 1
                break

        # Stockout probability based on upper bound scenario
        cumulative_upper = 0.0
        for fp in forecast[:90]:
            cumulative_upper += fp.upper_bound
        prob_upper = min(1.0, cumulative_upper / max(current_stock, 1))

        # Determine criticality
        if days_until_stockout is not None and days_until_stockout <= 14:
            criticality = "critical"
        elif days_until_stockout is not None and days_until_stockout <= 30:
            criticality = "high"
        elif days_until_stockout is not None and days_until_stockout <= 90:
            criticality = "medium"
        else:
            criticality = "low"

        stockout_prob = min(1.0, max(0.0, prob_upper))
        if days_until_stockout is None:
            stockout_prob = max(0.0, stockout_prob - 0.3)

        return StockoutRisk(
            probability=round(stockout_prob, 3),
            days_until_stockout=days_until_stockout,
            criticality=criticality,
            current_stock_units=current_stock,
            current_stock_days=round(stock_days, 1),
        )

    # ------------------------------------------------------------------
    # Order Recommendations
    # ------------------------------------------------------------------

    def recommend_orders(
        self,
        risk: StockoutRisk,
        forecast: list[ForecastPoint],
        suppliers: list[dict[str, Any]] | None = None,
    ) -> list[OrderRecommendation]:
        """Generate procurement order recommendations.

        Args:
            risk: Stockout risk assessment.
            forecast: Demand forecast.
            suppliers: Optional list of supplier info dicts.

        Returns:
            List of order recommendations sorted by priority.
        """
        if risk.criticality == "low":
            return []

        # Calculate 3-month demand
        three_month_demand = sum(fp.predicted_demand for fp in forecast[:90])
        six_month_demand = sum(fp.predicted_demand for fp in forecast[:180])

        recommendations: list[OrderRecommendation] = []

        if risk.criticality == "critical":
            order_quantity = int(three_month_demand * 1.2)
            order_by = date.today() + timedelta(days=3)
            priority = "emergency"
            rationale = (
                f"Critical stockout risk: only {risk.current_stock_days:.0f} days "
                f"of stock remaining. Estimated stockout in "
                f"{risk.days_until_stockout or 'N/A'} days."
            )
        elif risk.criticality == "high":
            order_quantity = int(three_month_demand)
            order_by = date.today() + timedelta(days=14)
            priority = "urgent"
            rationale = (
                f"High stockout risk: {risk.current_stock_days:.0f} days remaining. "
                f"Order needed within 2 weeks to prevent stockout."
            )
        else:
            order_quantity = int(six_month_demand * 0.5)
            order_by = date.today() + timedelta(days=30)
            priority = "routine"
            rationale = (
                f"Medium stockout risk: {risk.current_stock_days:.0f} days remaining. "
                f"Routine order recommended."
            )

        # Create recommendations for each supplier or a generic one
        if suppliers:
            for supplier in suppliers:
                recommendations.append(OrderRecommendation(
                    supplier=supplier.get("name"),
                    quantity_units=order_quantity,
                    order_by_date=order_by,
                    estimated_cost_usd=supplier.get("unit_cost", 0) * order_quantity,
                    priority=priority,
                    rationale=rationale,
                ))
        else:
            recommendations.append(OrderRecommendation(
                supplier=None,
                quantity_units=order_quantity,
                order_by_date=order_by,
                estimated_cost_usd=None,
                priority=priority,
                rationale=rationale,
            ))

        return recommendations

    # ------------------------------------------------------------------
    # Full Pipeline
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def forecast(
        self,
        input_data: SupplyForecastInput,
        current_stock: int = 0,
        suppliers: list[dict[str, Any]] | None = None,
    ) -> SupplyForecast:
        """Execute the full supply chain forecasting pipeline.

        Args:
            input_data: Supply forecast input parameters.
            current_stock: Current inventory level.
            suppliers: Optional supplier info list.

        Returns:
            Complete ``SupplyForecast`` with ensemble predictions and recommendations.
        """
        start_time = time.monotonic()
        self._log.info(
            "supply_forecast_started",
            pharmaceutical_id=input_data.pharmaceutical_id,
            horizon_months=input_data.horizon_months,
        )

        if not input_data.history:
            raise ValueError("Historical supply data is required for forecasting.")

        # Run ensemble forecast
        ensemble_points, method_forecasts = self.ensemble_forecast(
            history=input_data.history,
            horizon_months=input_data.horizon_months,
        )

        # Assess risk
        risk = self.assess_risk(current_stock, ensemble_points)

        # Generate recommendations
        recommendations = self.recommend_orders(risk, ensemble_points, suppliers)

        elapsed_ms = (time.monotonic() - start_time) * 1000

        FORECAST_PROCESSING_DURATION.labels(
            forecast_type="supply_chain",
        ).observe(elapsed_ms / 1000)

        result = SupplyForecast(
            request_id=input_data.request_id,
            pharmaceutical_id=input_data.pharmaceutical_id,
            pharmaceutical_name=input_data.pharmaceutical_name,
            ensemble_forecast=ensemble_points,
            method_forecasts=method_forecasts,
            risk=risk,
            recommendations=recommendations,
            processing_time_ms=round(elapsed_ms, 1),
        )

        self._log.info(
            "supply_forecast_completed",
            pharmaceutical_id=input_data.pharmaceutical_id,
            risk_criticality=risk.criticality,
            stockout_probability=risk.probability,
            recommendation_count=len(recommendations),
            elapsed_ms=round(elapsed_ms, 1),
        )

        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _generate_forecast_points(
        self,
        start_date: date,
        horizon_months: int,
        values: np.ndarray,
        stds: np.ndarray,
    ) -> list[ForecastPoint]:
        """Generate forecast points from value and std arrays."""
        points: list[ForecastPoint] = []
        current_date = start_date + timedelta(days=1)

        for i in range(min(len(values), horizon_months * 30)):
            val = float(values[i])
            std = float(stds[i]) if i < len(stds) else float(stds[-1])

            points.append(ForecastPoint(
                date=current_date,
                predicted_demand=round(max(0, val), 1),
                lower_bound=round(max(0, val - 1.96 * std), 1),
                upper_bound=round(max(0, val + 1.96 * std), 1),
                confidence=round(max(0.5, min(1.0, 0.95 - i * 0.001)), 3),
            ))
            current_date += timedelta(days=1)

        return points
