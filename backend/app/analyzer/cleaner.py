from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
import re
from io import BytesIO
from .quality_scanner import scan_data_quality, NUMBER_WITH_COMMA_REGEX, NUMBER_WITH_UNIT_REGEX
from .column_types import classify_all_columns


_df_cache: Dict[str, pd.DataFrame] = {}


def cache_dataframe(task_id: str, df: pd.DataFrame) -> None:
    _df_cache[task_id] = df.copy()


def get_cached_dataframe(task_id: str) -> Optional[pd.DataFrame]:
    return _df_cache.get(task_id)


def clear_cached_dataframe(task_id: str) -> None:
    _df_cache.pop(task_id, None)


def apply_deduplicate(df: pd.DataFrame, row_indices: List[int]) -> Tuple[pd.DataFrame, int]:
    if not row_indices:
        return df, 0
    keep_first = set()
    dup_masks: Dict[tuple, int] = {}
    original_index = df.index.tolist()
    rows_to_drop = set()
    for idx, pos in enumerate(original_index):
        row_key = tuple(str(v) if not pd.isna(v) else None for v in df.iloc[idx])
        if row_key in dup_masks:
            rows_to_drop.add(idx)
        else:
            dup_masks[row_key] = idx
    if not rows_to_drop:
        return df, 0
    new_df = df.drop(df.index[list(rows_to_drop)]).reset_index(drop=True)
    return new_df, len(rows_to_drop)


def apply_fill_missing(
    df: pd.DataFrame,
    column: str,
    strategy: str,
    fill_value: Optional[Any] = None,
) -> Tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    series = df[column]
    missing_count = int(series.isna().sum())
    if missing_count == 0:
        return df, 0
    df = df.copy()
    if strategy == "mean":
        if pd.api.types.is_numeric_dtype(series):
            value = float(series.mean())
        else:
            value = fill_value if fill_value is not None else ""
    elif strategy == "median":
        if pd.api.types.is_numeric_dtype(series):
            value = float(series.median())
        else:
            value = fill_value if fill_value is not None else ""
    elif strategy == "mode":
        modes = series.mode()
        if len(modes) > 0 and not pd.isna(modes.iloc[0]):
            value = modes.iloc[0]
        else:
            value = fill_value if fill_value is not None else ""
    elif strategy == "empty":
        value = ""
    else:
        value = fill_value if fill_value is not None else ""
    df[column] = df[column].fillna(value)
    return df, missing_count


def apply_parse_date(df: pd.DataFrame, column: str) -> Tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    df = df.copy()
    original = df[column]
    parsed = pd.to_datetime(original, errors="coerce")
    bad_count = int(original.notna().sum() - parsed.notna().sum())
    was_str = df[column].dtype == object or df[column].dtype == str
    if was_str:
        df.loc[original.notna(), column] = parsed[original.notna()].dt.strftime("%Y-%m-%d %H:%M:%S").where(parsed.notna(), None)
    else:
        df[column] = parsed
    fixed_count = int(original.notna().sum()) - bad_count
    return df, max(fixed_count, 0)


def apply_parse_numeric(df: pd.DataFrame, column: str) -> Tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    df = df.copy()
    series = df[column].astype(str)
    fixed_count = 0

    def clean_value(v: str) -> Optional[float]:
        nonlocal fixed_count
        if v is None or v.lower() == "nan" or v.strip() == "":
            return None
        original = v
        v = v.strip()
        if NUMBER_WITH_COMMA_REGEX.match(v):
            v = v.replace(",", "")
        m = NUMBER_WITH_UNIT_REGEX.match(v)
        if m:
            v = m.group(1)
        try:
            result = float(v)
            if original != v:
                fixed_count += 1
            return result
        except ValueError:
            return None

    cleaned = series.map(clean_value)
    df[column] = cleaned
    actual_fixed = int((series.notna() & cleaned.notna() & (series.astype(str) != cleaned.astype(str))).sum())
    return df, max(fixed_count, actual_fixed)


def apply_normalize_case(df: pd.DataFrame, column: str) -> Tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    series = df[column].dropna()
    if len(series) == 0:
        return df, 0
    str_vals = series.astype(str)
    lower_map: Dict[str, Dict[str, int]] = {}
    for v in str_vals:
        key = v.lower()
        if key not in lower_map:
            lower_map[key] = {}
        lower_map[key][v] = lower_map[key].get(v, 0) + 1
    canonical_map: Dict[str, str] = {}
    for key, variants in lower_map.items():
        if len(variants) > 1:
            canonical = max(variants, key=variants.get)
            for v in variants:
                if v != canonical:
                    canonical_map[v] = canonical
    if not canonical_map:
        return df, 0
    df = df.copy()
    df[column] = df[column].map(lambda x: canonical_map.get(str(x), x) if pd.notna(x) else x)
    fixed_count = sum(1 for v in str_vals if v in canonical_map)
    return df, fixed_count


def apply_winsorize(df: pd.DataFrame, column: str) -> Tuple[pd.DataFrame, int]:
    if column not in df.columns:
        return df, 0
    series = df[column].dropna()
    if len(series) < 4:
        return df, 0
    if not pd.api.types.is_numeric_dtype(series):
        return df, 0
    q1 = float(series.quantile(0.25))
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1
    if iqr == 0:
        return df, 0
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    mask = (df[column] < lower) | (df[column] > upper)
    fixed_count = int(mask.sum())
    if fixed_count == 0:
        return df, 0
    df = df.copy()
    df[column] = df[column].clip(lower=lower, upper=upper)
    return df, fixed_count


FIX_HANDLERS = {
    "deduplicate": lambda df, issue: apply_deduplicate(df, issue.row_indices),
    "fill_missing": lambda df, issue: apply_fill_missing(
        df,
        issue.suggestion.column or issue.column,
        issue.suggestion.fill_strategy or "mean",
        issue.suggestion.fill_value,
    ),
    "parse_date": lambda df, issue: apply_parse_date(df, issue.column),
    "parse_numeric": lambda df, issue: apply_parse_numeric(df, issue.column),
    "normalize_case": lambda df, issue: apply_normalize_case(df, issue.column),
    "winsorize": lambda df, issue: apply_winsorize(df, issue.column),
}


def apply_fix(df: pd.DataFrame, issue: Any) -> Tuple[pd.DataFrame, int, bool]:
    fix_type = issue.suggestion.fix_type if issue.suggestion else None
    if not fix_type or fix_type not in FIX_HANDLERS:
        return df, 0, False
    try:
        new_df, count = FIX_HANDLERS[fix_type](df, issue)
        return new_df, count, True
    except Exception:
        return df, 0, False
