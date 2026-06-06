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
    IndustryAnalysis,
)
from ..utils import get_logger, StepTimer
from .column_types import classify_all_columns
from .stats import compute_numeric_stats, compute_missing_rate, get_sample_values
from .outliers import detect_outliers, generate_outlier_stories
from .correlation import compute_correlation
from .categorical import compute_categorical_freq
from .timeseries import analyze_timeseries
from .summarizer import generate_summary
from .industry import detect_industry_and_calculate
from .quality_scanner import scan_data_quality

logger = get_logger("analyzer.engine")


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
        logger.info(
            "开始数据分析",
            filename=filename,
            rows=int(df.shape[0]),
            cols=int(df.shape[1]),
            event="analysis_start",
        )

        df = df.copy()
        df.columns = [str(c) for c in df.columns]

        with StepTimer(logger, "列类型识别", filename=filename):
            col_types = classify_all_columns(df)
        numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
        categorical_cols = [c for c, t in col_types.items() if t in ("categorical", "boolean")]
        datetime_cols = [c for c, t in col_types.items() if t == "datetime"]

        logger.info(
            "列分类完成",
            filename=filename,
            numeric_count=len(numeric_cols),
            categorical_count=len(categorical_cols),
            datetime_count=len(datetime_cols),
        )

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
        with StepTimer(logger, "列信息计算", filename=filename):
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

        with StepTimer(logger, "相关性计算", filename=filename):
            correlations = compute_correlation(df, numeric_cols)

        with StepTimer(logger, "分类频率计算", filename=filename):
            categorical_freq = compute_categorical_freq(df, categorical_cols)
        for i, cf in enumerate(categorical_freq):
            for c in columns_info:
                if c.name == cf.column:
                    c.categories = cf.values
                    break

        with StepTimer(logger, "时间序列分析", filename=filename):
            timeseries = analyze_timeseries(df, datetime_cols, numeric_cols)

        with StepTimer(logger, "可视化采样", filename=filename):
            sampled_df = _sample_for_visualization(df)
            sampled_data = _df_to_records(sampled_df)

        with StepTimer(logger, "异常值故事生成", filename=filename):
            outlier_stories = generate_outlier_stories(df, col_types)

        with StepTimer(logger, "行业检测分析", filename=filename):
            industry_data = detect_industry_and_calculate(df)
        industry_analysis = IndustryAnalysis(**industry_data) if industry_data else None

        partial_result = AnalysisResult(
            dataset=dataset_info,
            columns=columns_info,
            correlations=correlations,
            categorical_freq=categorical_freq,
            timeseries=timeseries,
            summary=SummaryResult(headline="", insights=[]),
            sampled_data=sampled_data,
            outlier_stories=outlier_stories,
            industry=industry_analysis,
        )

        with StepTimer(logger, "摘要生成", filename=filename):
            summary = generate_summary(partial_result)
            partial_result.summary = summary

        with StepTimer(logger, "数据质量扫描", filename=filename):
            quality_report = scan_data_quality(df, col_types)
            partial_result.quality_report = quality_report

        logger.info(
            "数据分析完成",
            filename=filename,
            rows=int(df.shape[0]),
            cols=int(df.shape[1]),
            event="analysis_end",
        )

        return partial_result
