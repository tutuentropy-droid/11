from typing import List
import pandas as pd
import numpy as np


def detect_outliers_iqr(series: pd.Series, k: float = 1.5) -> List[int]:
    if not pd.api.types.is_numeric_dtype(series):
        return []
    s = series.dropna()
    if len(s) < 4:
        return []
    q1 = s.quantile(0.25)
    q3 = s.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return []
    lower = q1 - k * iqr
    upper = q3 + k * iqr
    mask = (series < lower) | (series > upper)
    mask = mask.fillna(False)
    return [int(i) for i in series.index[mask].tolist()]


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> List[int]:
    if not pd.api.types.is_numeric_dtype(series):
        return []
    s = series.dropna()
    if len(s) < 4:
        return []
    mean = s.mean()
    std = s.std()
    if std == 0:
        return []
    z = (series - mean) / std
    mask = z.abs() > threshold
    mask = mask.fillna(False)
    return [int(i) for i in series.index[mask].tolist()]


def detect_outliers(series: pd.Series) -> List[int]:
    iqr_outliers = set(detect_outliers_iqr(series))
    z_outliers = set(detect_outliers_zscore(series))
    return sorted(list(iqr_outliers | z_outliers))
