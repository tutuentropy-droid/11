from __future__ import annotations
from typing import Optional, Dict, Any
import pandas as pd
import numpy as np

from ..models.schemas import (
    AnalysisResult,
    DatasetInfo,
    ColumnInfo,
    CategoricalFrequency,
    SummaryResult,
)
from .column_types import classify_all_columns
from .stats import compute_numeric_stats, compute_missing_rate, get_sample_values
from .outliers import detect_outliers, generate_outlier_stories
from .correlation import compute_correlation
from .categorical import compute_categorical_freq
from .timeseries import analyze_timeseries
from .summarizer import generate_summary


def _sample_for_visualization(df: pd.DataFrame, max_rows: int = 5000) -> pd.DataFrame:
    if len(df) <= max_rows:
        return df.copy()
    return df.sample(n=max_rows, random_state=42).reset_index(drop=True)


def _df_to_records(df: pd.DataFrame) -> list:
    records = []
    for _, row in df.iterrows():
        rec: Dict[str, Any] = {}
        for col in df.columns:
            val = row[col]
            if pd.isna(val):
                rec[col] = None
            elif isinstance(val, (np.integer,)):
                rec[col] = int(val)
            elif isinstance(val, (np.floating,)):
                rec[col] = round(float(val), 4)
            elif isinstance(val, pd.Timestamp):
                rec[col] = val.strftime("%Y-%m-%d %H:%M:%S")
            else:
                rec[col] = str(val)
        records.append(rec)
    return records


class AnalysisEngine:
    def __init__(self):
        pass

    def analyze(self, df: pd.DataFrame, filename: str = "dataset") -> AnalysisResult:
        df = df.copy()
        df.columns = [str(c) for c in df.columns]

        col_types = classify_all_columns(df)
        numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
        categorical_cols = [c for c, t in col_types.items() if t in ("categorical", "boolean")]
        datetime_cols = [c for c, t in col_types.items() if t == "datetime"]

        total_missing = float(df.isna().sum().sum())
        total_cells = max(df.shape[0] * df.shape[1], 1)
        total_missing_rate = round(total_missing / total_cells, 4)
        duplicate_rows = int(df.duplicated().sum())

        dataset_info = DatasetInfo(
            name=filename,
            rows=int(df.shape[0]),
            cols=int(df.shape[1]),
            total_missing_rate=total_missing_rate,
            duplicate_rows=duplicate_rows,
        )

        columns_info = []
        for col in df.columns:
            series = df[col]
            ctype = col_types[col]
            info = ColumnInfo(
                name=col,
                type=ctype,
                missing_rate=compute_missing_rate(series),
                unique_count=int(series.nunique(dropna=True)),
                stats=compute_numeric_stats(series) if ctype == "numeric" else None,
                outliers=detect_outliers(series) if ctype == "numeric" else [],
                sample=get_sample_values(series, 5),
            )
            columns_info.append(info)

        correlations = compute_correlation(df, numeric_cols)
        categorical_freq = compute_categorical_freq(df, categorical_cols)
        for i, cf in enumerate(categorical_freq):
            for c in columns_info:
                if c.name == cf.column:
                    c.categories = cf.values
                    break

        timeseries = analyze_timeseries(df, datetime_cols, numeric_cols)

        sampled_df = _sample_for_visualization(df)
        sampled_data = _df_to_records(sampled_df)

        outlier_stories = generate_outlier_stories(df, col_types)

        partial_result = AnalysisResult(
            dataset=dataset_info,
            columns=columns_info,
            correlations=correlations,
            categorical_freq=categorical_freq,
            timeseries=timeseries,
            summary=SummaryResult(headline="", insights=[]),
            sampled_data=sampled_data,
            outlier_stories=outlier_stories,
        )

        summary = generate_summary(partial_result)
        partial_result.summary = summary

        return partial_result
