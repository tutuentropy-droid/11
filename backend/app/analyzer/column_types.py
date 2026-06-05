from __future__ import annotations
import re
from typing import Dict, List
import pandas as pd
import numpy as np


DATE_PATTERNS = [
    r"^\d{4}-\d{2}-\d{2}",
    r"^\d{4}/\d{2}/\d{2}",
    r"^\d{2}-\d{2}-\d{4}",
    r"^\d{2}/\d{2}/\d{4}",
    r"^\d{4}年\d{1,2}月",
]


def _is_datetime_series(series: pd.Series) -> bool:
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    if pd.api.types.is_numeric_dtype(series):
        return False
    non_null = series.dropna().head(50)
    if len(non_null) == 0:
        return False
    str_vals = non_null.astype(str)
    avg_len = float(str_vals.str.len().mean())
    if avg_len < 6 or avg_len > 40:
        return False
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            parsed = pd.to_datetime(non_null, errors="coerce")
        ratio = parsed.notna().sum() / len(non_null)
        if ratio > 0.8:
            parsed_all = pd.to_datetime(series.dropna(), errors="coerce")
            return parsed_all.notna().sum() / max(len(series.dropna()), 1) > 0.7
    except Exception:
        pass
    match_count = 0
    for val in str_vals:
        for pat in DATE_PATTERNS:
            if re.match(pat, str(val)):
                match_count += 1
                break
    return match_count / len(str_vals) > 0.75


def _is_boolean_series(series: pd.Series) -> bool:
    if pd.api.types.is_bool_dtype(series):
        return True
    non_null = series.dropna()
    if len(non_null) == 0:
        return False
    unique = set(non_null.astype(str).str.lower().unique())
    return unique.issubset({"true", "false", "1", "0", "yes", "no", "y", "n", "是", "否"})


def _is_numeric_series(series: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(series)


def classify_column(series: pd.Series, name: str) -> str:
    non_null = series.dropna()
    total = len(series)
    if total == 0 or len(non_null) == 0:
        return "text"

    if _is_boolean_series(series):
        return "boolean"

    if _is_datetime_series(series):
        return "datetime"

    if _is_numeric_series(series):
        unique_ratio = non_null.nunique() / len(non_null)
        if unique_ratio < 0.05 and non_null.nunique() <= 20:
            return "categorical"
        return "numeric"

    unique_ratio = non_null.nunique() / max(len(non_null), 1)
    avg_len = non_null.astype(str).str.len().mean()

    if unique_ratio < 0.05 and non_null.nunique() <= 50:
        return "categorical"

    if avg_len > 50 or unique_ratio > 0.8:
        return "text"

    return "categorical"


def classify_all_columns(df: pd.DataFrame) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for col in df.columns:
        result[col] = classify_column(df[col], col)
    return result
