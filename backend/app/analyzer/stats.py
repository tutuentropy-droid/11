from typing import Dict, Any, Optional
import pandas as pd
import numpy as np

from ..models.schemas import ColumnStats


def compute_numeric_stats(series: pd.Series) -> Optional[ColumnStats]:
    if not pd.api.types.is_numeric_dtype(series):
        return None
    s = series.dropna()
    if len(s) == 0:
        return None
    q25 = float(s.quantile(0.25))
    q75 = float(s.quantile(0.75))
    return ColumnStats(
        mean=round(float(s.mean()), 4),
        median=round(float(s.median()), 4),
        std=round(float(s.std()), 4),
        min=round(float(s.min()), 4),
        max=round(float(s.max()), 4),
        q25=round(q25, 4),
        q75=round(q75, 4),
        iqr=round(q75 - q25, 4),
    )


def compute_missing_rate(series: pd.Series) -> float:
    if len(series) == 0:
        return 0.0
    return round(float(series.isna().sum() / len(series)), 4)


def get_sample_values(series: pd.Series, n: int = 5) -> list:
    non_null = series.dropna()
    samples = non_null.head(n).tolist()
    result = []
    for v in samples:
        if isinstance(v, (np.integer,)):
            result.append(int(v))
        elif isinstance(v, (np.floating,)):
            result.append(round(float(v), 4))
        elif pd.isna(v):
            result.append(None)
        else:
            result.append(str(v))
    return result
