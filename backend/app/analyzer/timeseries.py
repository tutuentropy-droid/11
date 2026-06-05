from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np

from ..models.schemas import TimeSeriesResult


def _try_parse_datetime(series: pd.Series) -> Optional[pd.Series]:
    try:
        parsed = pd.to_datetime(series, errors="coerce")
        if parsed.notna().sum() / max(len(parsed), 1) > 0.5:
            return parsed
    except Exception:
        pass
    return None


def _moving_average(values: np.ndarray, window: int = 5) -> np.ndarray:
    if len(values) < window:
        return values.copy()
    kernel = np.ones(window) / window
    padded = np.pad(values, (window // 2, window - 1 - window // 2), mode="edge")
    return np.convolve(padded, kernel, mode="valid")


def _linear_forecast(x: np.ndarray, y: np.ndarray, steps: int = 10) -> Dict[str, Any]:
    if len(x) < 3:
        return {"values": [], "upper": [], "lower": []}
    x_n = np.arange(len(x), dtype=float)
    mask = ~np.isnan(y)
    if mask.sum() < 3:
        return {"values": [], "upper": [], "lower": []}
    x_valid = x_n[mask]
    y_valid = y[mask]
    try:
        coeffs = np.polyfit(x_valid, y_valid, 1)
        slope, intercept = coeffs
        future_x = np.arange(len(x), len(x) + steps, dtype=float)
        pred = slope * future_x + intercept
        residuals = y_valid - (slope * x_valid + intercept)
        std = float(np.std(residuals)) if len(residuals) > 1 else 0.0
        return {
            "values": [round(float(v), 4) for v in pred.tolist()],
            "upper": [round(float(v + 1.96 * std), 4) for v in pred.tolist()],
            "lower": [round(float(v - 1.96 * std), 4) for v in pred.tolist()],
        }
    except Exception:
        return {"values": [], "upper": [], "lower": []}


def analyze_timeseries(df: pd.DataFrame, datetime_cols: List[str], numeric_cols: List[str]) -> Optional[TimeSeriesResult]:
    if not datetime_cols or not numeric_cols:
        return None

    time_col = datetime_cols[0]
    value_col = numeric_cols[0]

    parsed_time = _try_parse_datetime(df[time_col])
    if parsed_time is None:
        return None

    temp_df = pd.DataFrame({
        "time": parsed_time,
        "value": pd.to_numeric(df[value_col], errors="coerce"),
    }).dropna()

    if len(temp_df) < 10:
        return None

    temp_df = temp_df.sort_values("time")
    temp_df = temp_df.groupby("time")["value"].mean().reset_index()
    temp_df = temp_df.sort_values("time")

    values = temp_df["value"].values.astype(float)
    times = temp_df["time"].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()

    data_points: List[Dict[str, Any]] = []
    for t, v in zip(times, values):
        if not np.isnan(v):
            data_points.append({"time": t, "value": round(float(v), 4)})

    trend_vals = _moving_average(values, window=max(3, min(15, len(values) // 10)))
    seasonal = values - trend_vals

    trend_points: List[Dict[str, Any]] = []
    seasonal_points: List[Dict[str, Any]] = []
    for i, t in enumerate(times):
        if not np.isnan(trend_vals[i]):
            trend_points.append({"time": t, "value": round(float(trend_vals[i]), 4)})
        if not np.isnan(seasonal[i]):
            seasonal_points.append({"time": t, "value": round(float(seasonal[i]), 4)})

    forecast = _linear_forecast(np.arange(len(values)), values, steps=max(3, min(20, len(values) // 5)))

    last_time = pd.Timestamp(times[-1])
    if len(times) > 1:
        delta = pd.Timestamp(times[-1]) - pd.Timestamp(times[-2])
    else:
        delta = pd.Timedelta(days=1)
    forecast_times = [(last_time + delta * (i + 1)).strftime("%Y-%m-%d %H:%M:%S") for i in range(len(forecast["values"]))]
    forecast["times"] = forecast_times

    return TimeSeriesResult(
        time_column=time_col,
        value_column=value_col,
        data_points=data_points,
        trend=trend_points,
        seasonal=seasonal_points,
        forecast=forecast,
    )
