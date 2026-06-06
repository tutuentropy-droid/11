from __future__ import annotations
from typing import List, Optional, Tuple, Dict, Any
import pandas as pd
import numpy as np

from ..models.schemas import (
    AnalysisResult,
    CompareResult,
    CompareSummary,
    CompareInsight,
    NumericDiff,
    CategoricalDiff,
    CategoricalDiffItem,
    TimeseriesDiff,
    TimeseriesDiffPoint,
    CorrelationDiff,
    CorrelationDiffPair,
)
from .engine import AnalysisEngine
from .column_types import classify_all_columns


def _safe_pct_change(old: Optional[float], new: Optional[float]) -> Optional[float]:
    if old is None or new is None or old == 0:
        return None
    return round((new - old) / abs(old) * 100, 2)


def _find_common_columns(result_a: AnalysisResult, result_b: AnalysisResult) -> Tuple[List[str], List[str], List[str], List[str]]:
    cols_a = {c.name: c for c in result_a.columns}
    cols_b = {c.name: c for c in result_b.columns}
    common = list(set(cols_a.keys()) & set(cols_b.keys()))

    common_numeric = [c for c in common if cols_a[c].type == "numeric" and cols_b[c].type == "numeric"]
    common_categorical = [c for c in common if cols_a[c].type in ("categorical", "boolean") and cols_b[c].type in ("categorical", "boolean")]
    common_datetime = [c for c in common if cols_a[c].type == "datetime" and cols_b[c].type == "datetime"]

    return common, common_numeric, common_categorical, common_datetime


def _compute_numeric_diffs(result_a: AnalysisResult, result_b: AnalysisResult, common_numeric: List[str]) -> List[NumericDiff]:
    diffs: List[NumericDiff] = []
    cols_a = {c.name: c for c in result_a.columns}
    cols_b = {c.name: c for c in result_b.columns}

    for col in common_numeric:
        ca = cols_a[col]
        cb = cols_b[col]
        stats_a = ca.stats
        stats_b = cb.stats
        diffs.append(NumericDiff(
            column=col,
            mean_a=stats_a.mean if stats_a else None,
            mean_b=stats_b.mean if stats_b else None,
            mean_change_pct=_safe_pct_change(stats_a.mean if stats_a else None, stats_b.mean if stats_b else None),
            median_a=stats_a.median if stats_a else None,
            median_b=stats_b.median if stats_b else None,
            median_change_pct=_safe_pct_change(stats_a.median if stats_a else None, stats_b.median if stats_b else None),
            std_a=stats_a.std if stats_a else None,
            std_b=stats_b.std if stats_b else None,
        ))
    return diffs


def _compute_categorical_diffs(result_a: AnalysisResult, result_b: AnalysisResult, common_categorical: List[str]) -> List[CategoricalDiff]:
    diffs: List[CategoricalDiff] = []
    freq_a = {cf.column: cf for cf in result_a.categorical_freq}
    freq_b = {cf.column: cf for cf in result_b.categorical_freq}

    for col in common_categorical:
        if col not in freq_a or col not in freq_b:
            continue
        items_a = {v["name"]: v for v in freq_a[col].values}
        items_b = {v["name"]: v for v in freq_b[col].values}
        all_cats = list(set(items_a.keys()) | set(items_b.keys()))

        total_a = sum(v["count"] for v in items_a.values())
        total_b = sum(v["count"] for v in items_b.values())

        diff_items: List[CategoricalDiffItem] = []
        for cat in all_cats:
            a = items_a.get(cat, {"count": 0, "percentage": 0})
            b = items_b.get(cat, {"count": 0, "percentage": 0})
            diff_items.append(CategoricalDiffItem(
                category=cat,
                count_a=a["count"],
                count_b=b["count"],
                count_change=b["count"] - a["count"],
                pct_a=a["percentage"],
                pct_b=b["percentage"],
                pct_change=round(b["percentage"] - a["percentage"], 2),
            ))

        diff_items.sort(key=lambda x: abs(x.pct_change), reverse=True)
        diffs.append(CategoricalDiff(column=col, items=diff_items))

    return diffs


def _align_timeseries(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    time_col: str,
    value_col: str,
) -> Optional[TimeseriesDiff]:
    try:
        a = df_a.copy()
        b = df_b.copy()
        a[time_col] = pd.to_datetime(a[time_col])
        b[time_col] = pd.to_datetime(b[time_col])

        a_grouped = a.groupby(time_col)[value_col].sum().reset_index()
        b_grouped = b.groupby(time_col)[value_col].sum().reset_index()

        a_grouped.columns = [time_col, "value"]
        b_grouped.columns = [time_col, "value"]

        merged = pd.merge(a_grouped, b_grouped, on=time_col, how="outer", suffixes=("_a", "_b"), indicator=True)
        merged = merged.sort_values(time_col)

        only_a = merged[merged["_merge"] == "left_only"]
        only_b = merged[merged["_merge"] == "right_only"]
        common = merged[merged["_merge"] == "both"]

        aligned_points: List[TimeseriesDiffPoint] = []
        for _, row in common.iterrows():
            va = float(row["value_a"]) if pd.notna(row["value_a"]) else None
            vb = float(row["value_b"]) if pd.notna(row["value_b"]) else None
            diff = (vb - va) if va is not None and vb is not None else None
            diff_pct = _safe_pct_change(va, vb)
            aligned_points.append(TimeseriesDiffPoint(
                time=row[time_col].strftime("%Y-%m-%d") if isinstance(row[time_col], pd.Timestamp) else str(row[time_col]),
                value_a=va,
                value_b=vb,
                diff=diff,
                diff_pct=diff_pct,
            ))

        total_a = float(a_grouped["value"].sum())
        total_b = float(b_grouped["value"].sum())

        return TimeseriesDiff(
            time_column=time_col,
            value_column=value_col,
            aligned_points=aligned_points,
            only_in_a=[{"time": r[time_col].strftime("%Y-%m-%d") if isinstance(r[time_col], pd.Timestamp) else str(r[time_col]), "value": float(r["value"])} for _, r in only_a.iterrows()],
            only_in_b=[{"time": r[time_col].strftime("%Y-%m-%d") if isinstance(r[time_col], pd.Timestamp) else str(r[time_col]), "value": float(r["value"])} for _, r in only_b.iterrows()],
            total_a=total_a,
            total_b=total_b,
            total_change_pct=_safe_pct_change(total_a, total_b),
        )
    except Exception:
        return None


def _compute_correlation_diff(result_a: AnalysisResult, result_b: AnalysisResult, common_numeric: List[str]) -> Optional[CorrelationDiff]:
    if not result_a.correlations or not result_b.correlations:
        return None
    if len(common_numeric) < 2:
        return None

    corr_a_map: Dict[Tuple[str, str], float] = {}
    for pair in result_a.correlations.top_pairs:
        key = tuple(sorted([str(pair[0]), str(pair[1])]))
        corr_a_map[key] = float(pair[2])

    corr_b_map: Dict[Tuple[str, str], float] = {}
    for pair in result_b.correlations.top_pairs:
        key = tuple(sorted([str(pair[0]), str(pair[1])]))
        corr_b_map[key] = float(pair[2])

    common_keys = list(set(corr_a_map.keys()) & set(corr_b_map.keys()))
    pairs: List[CorrelationDiffPair] = []
    for k in common_keys:
        ca = corr_a_map[k]
        cb = corr_b_map[k]
        pairs.append(CorrelationDiffPair(
            col1=k[0],
            col2=k[1],
            corr_a=ca,
            corr_b=cb,
            corr_diff=round(cb - ca, 4),
        ))
    pairs.sort(key=lambda p: abs(p.corr_diff or 0), reverse=True)
    return CorrelationDiff(common_pairs=pairs[:20])


def _generate_compare_summary(
    result_a: AnalysisResult,
    result_b: AnalysisResult,
    numeric_diffs: List[NumericDiff],
    categorical_diffs: List[CategoricalDiff],
    ts_diff: Optional[TimeseriesDiff],
    corr_diff: Optional[CorrelationDiff],
    label_a: str,
    label_b: str,
) -> CompareSummary:
    insights: List[CompareInsight] = []
    key_metrics: List[Dict[str, Any]] = []

    significant_numeric = [d for d in numeric_diffs if d.mean_change_pct is not None and abs(d.mean_change_pct) >= 5]
    significant_numeric.sort(key=lambda d: abs(d.mean_change_pct or 0), reverse=True)

    for d in significant_numeric[:5]:
        direction = "上升" if (d.mean_change_pct or 0) > 0 else "下降"
        severity = "high" if abs(d.mean_change_pct or 0) >= 30 else "medium" if abs(d.mean_change_pct or 0) >= 15 else "low"
        insights.append(CompareInsight(
            severity=severity,
            text=f"'{d.column}' 均值从 {round(d.mean_a or 0, 2)} 变为 {round(d.mean_b or 0, 2)}，{direction} {abs(d.mean_change_pct or 0)}%。",
            category="numeric",
            details={"column": d.column, "mean_a": d.mean_a, "mean_b": d.mean_b, "change_pct": d.mean_change_pct},
        ))
        key_metrics.append({
            "name": d.column,
            "value_a": d.mean_a,
            "value_b": d.mean_b,
            "change_pct": d.mean_change_pct,
            "type": "numeric",
        })

    for cd in categorical_diffs[:2]:
        top_changes = [i for i in cd.items if abs(i.pct_change) >= 3][:3]
        for item in top_changes:
            direction = "增加" if item.pct_change > 0 else "减少"
            severity = "high" if abs(item.pct_change) >= 15 else "medium" if abs(item.pct_change) >= 5 else "low"
            insights.append(CompareInsight(
                severity=severity,
                text=f"[{cd.column}] '{item.category}' 占比从 {item.pct_a}% {direction}至 {item.pct_b}%（{item.pct_change:+.2f}pp）。",
                category="categorical",
                details={"column": cd.column, "category": item.category, "pct_a": item.pct_a, "pct_b": item.pct_b, "pct_change": item.pct_change},
            ))

    if ts_diff and ts_diff.total_change_pct is not None:
        direction = "上升" if ts_diff.total_change_pct > 0 else "下降"
        severity = "high" if abs(ts_diff.total_change_pct) >= 20 else "medium" if abs(ts_diff.total_change_pct) >= 10 else "low"
        insights.append(CompareInsight(
            severity=severity,
            text=f"时间序列总量从 {round(ts_diff.total_a or 0, 2)} 变为 {round(ts_diff.total_b or 0, 2)}，整体{direction} {abs(ts_diff.total_change_pct)}%。",
            category="timeseries",
            details={"total_a": ts_diff.total_a, "total_b": ts_diff.total_b, "change_pct": ts_diff.total_change_pct},
        ))
        key_metrics.append({
            "name": f"{ts_diff.value_column} (总量)",
            "value_a": ts_diff.total_a,
            "value_b": ts_diff.total_b,
            "change_pct": ts_diff.total_change_pct,
            "type": "timeseries",
        })

        big_changes = [p for p in ts_diff.aligned_points if p.diff_pct is not None and abs(p.diff_pct) >= 20]
        for p in big_changes[:3]:
            dir2 = "上升" if (p.diff_pct or 0) > 0 else "下降"
            insights.append(CompareInsight(
                severity="medium",
                text=f"{p.time}: {ts_diff.value_column} {dir2} {abs(p.diff_pct or 0)}%（{p.value_a} → {p.value_b}）。",
                category="timeseries",
                details={"time": p.time, "value_a": p.value_a, "value_b": p.value_b, "diff_pct": p.diff_pct},
            ))

    if corr_diff and corr_diff.common_pairs:
        big_corr_changes = [p for p in corr_diff.common_pairs if abs(p.corr_diff or 0) >= 0.2]
        for p in big_corr_changes[:3]:
            direction = "增强" if (p.corr_diff or 0) > 0 else "减弱"
            insights.append(CompareInsight(
                severity="medium",
                text=f"'{p.col1}' 与 '{p.col2}' 的相关性{direction}（{p.corr_a} → {p.corr_b}，差 {p.corr_diff:+.3f}）。",
                category="correlation",
                details={"col1": p.col1, "col2": p.col2, "corr_a": p.corr_a, "corr_b": p.corr_b, "corr_diff": p.corr_diff},
            ))

    if len(insights) == 0:
        insights.append(CompareInsight(
            severity="low",
            text="两份数据在主要指标上没有显著差异。",
            category="general",
        ))

    headline_parts = [
        f"{label_a} vs {label_b}",
        f"{len(significant_numeric)} 个指标有显著变化",
    ]
    if ts_diff and ts_diff.total_change_pct is not None:
        headline_parts.append(f"总量 {ts_diff.total_change_pct:+.1f}%")

    headline = " · ".join(headline_parts)

    return CompareSummary(headline=headline, insights=insights, key_metrics=key_metrics)


class DataComparator:
    def __init__(self):
        self.engine = AnalysisEngine()

    def compare(
        self,
        df_a: pd.DataFrame,
        df_b: pd.DataFrame,
        filename_a: str = "dataset_a",
        filename_b: str = "dataset_b",
        label_a: Optional[str] = None,
        label_b: Optional[str] = None,
        align_strategy: str = "auto",
        align_field: Optional[str] = None,
    ) -> CompareResult:
        df_a = df_a.copy()
        df_b = df_b.copy()
        df_a.columns = [str(c) for c in df_a.columns]
        df_b.columns = [str(c) for c in df_b.columns]

        result_a = self.engine.analyze(df_a, filename=filename_a)
        result_b = self.engine.analyze(df_b, filename=filename_b)

        lbl_a = label_a or filename_a
        lbl_b = label_b or filename_b

        common_cols, common_numeric, common_categorical, common_datetime = _find_common_columns(result_a, result_b)

        numeric_diffs = _compute_numeric_diffs(result_a, result_b, common_numeric)
        categorical_diffs = _compute_categorical_diffs(result_a, result_b, common_categorical)

        ts_diff = None
        if align_field:
            if align_field in common_datetime and common_numeric:
                value_col = common_numeric[0]
                ts_diff = _align_timeseries(df_a, df_b, align_field, value_col)
        else:
            if common_datetime and common_numeric:
                time_col = common_datetime[0]
                value_col = common_numeric[0]
                ts_diff = _align_timeseries(df_a, df_b, time_col, value_col)

        corr_diff = _compute_correlation_diff(result_a, result_b, common_numeric)

        summary = _generate_compare_summary(
            result_a, result_b,
            numeric_diffs, categorical_diffs,
            ts_diff, corr_diff,
            lbl_a, lbl_b,
        )

        strategy_used = align_strategy
        used_align_field = None
        if ts_diff:
            strategy_used = "time"
            used_align_field = ts_diff.time_column
        elif align_field and align_field in common_categorical:
            strategy_used = "categorical"
            used_align_field = align_field

        return CompareResult(
            dataset_a=result_a,
            dataset_b=result_b,
            label_a=lbl_a,
            label_b=lbl_b,
            common_columns=common_cols,
            common_numeric_columns=common_numeric,
            common_categorical_columns=common_categorical,
            common_datetime_columns=common_datetime,
            numeric_diffs=numeric_diffs,
            categorical_diffs=categorical_diffs,
            timeseries_diff=ts_diff,
            correlation_diff=corr_diff,
            summary=summary,
            align_strategy=strategy_used,
            align_field=used_align_field,
        )
