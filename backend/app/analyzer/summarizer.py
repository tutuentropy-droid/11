from typing import List
import pandas as pd

from ..models.schemas import (
    AnalysisResult,
    Insight,
    SummaryResult,
)


def generate_summary(result: AnalysisResult) -> SummaryResult:
    insights: List[Insight] = []

    ds = result.dataset
    quality_comments: List[str] = []
    if ds.total_missing_rate > 0.2:
        quality_comments.append(f"整体缺失率较高 ({round(ds.total_missing_rate * 100, 1)}%)")
        insights.append(Insight(
            severity="high",
            text=f"数据集整体缺失率为 {round(ds.total_missing_rate * 100, 1)}%，建议处理缺失值后再做深入分析。",
            viz="columns",
        ))
    elif ds.total_missing_rate > 0.05:
        quality_comments.append(f"有少量缺失 ({round(ds.total_missing_rate * 100, 1)}%)")
        insights.append(Insight(
            severity="medium",
            text=f"数据集存在 {round(ds.total_missing_rate * 100, 1)}% 的缺失值，分析时已自动忽略。",
            viz="columns",
        ))
    else:
        quality_comments.append("缺失率很低")

    if ds.duplicate_rows > 0:
        quality_comments.append(f"存在 {ds.duplicate_rows} 行重复")
        insights.append(Insight(
            severity="medium",
            text=f"检测到 {ds.duplicate_rows} 行重复数据，建议去重。",
            viz="columns",
        ))

    high_missing_cols = [c for c in result.columns if c.missing_rate > 0.3]
    for col in high_missing_cols[:3]:
        insights.append(Insight(
            severity="medium",
            text=f"列 '{col.name}' 缺失率 {round(col.missing_rate * 100, 1)}%，信息价值较低。",
            viz="columns",
            details={"column": col.name, "missing_rate": col.missing_rate},
        ))

    total_outliers = sum(len(c.outliers) for c in result.columns)
    if total_outliers > 0:
        outlier_cols = [c for c in result.columns if len(c.outliers) > 0]
        insights.append(Insight(
            severity="high" if total_outliers > 20 else "medium",
            text=f"检测到 {total_outliers} 个异常数据点，分布在 {len(outlier_cols)} 列中。",
            viz="scatter",
            details={"total_outliers": total_outliers},
        ))
        for col in outlier_cols[:3]:
            insights.append(Insight(
                severity="medium",
                text=f"'{col.name}' 列有 {len(col.outliers)} 个异常点（红色闪烁），建议核查。",
                viz="histogram",
                details={"column": col.name, "outliers": len(col.outliers)},
            ))

    if result.correlations and len(result.correlations.top_pairs) > 0:
        strong_pairs = [p for p in result.correlations.top_pairs if abs(p[2]) >= 0.7]
        if strong_pairs:
            for pair in strong_pairs[:3]:
                direction = "正相关" if pair[2] > 0 else "负相关"
                insights.append(Insight(
                    severity="high",
                    text=f"'{pair[0]}' 与 '{pair[1]}' 呈强{direction}（r = {pair[2]}）。",
                    viz="correlation",
                    details={"col1": pair[0], "col2": pair[1], "r": pair[2]},
                ))
        else:
            weak_pairs = result.correlations.top_pairs[:2]
            for pair in weak_pairs:
                direction = "正相关" if pair[2] > 0 else "负相关"
                insights.append(Insight(
                    severity="low",
                    text=f"'{pair[0]}' 与 '{pair[1]}' 存在弱{direction}（r = {pair[2]}）。",
                    viz="correlation",
                ))

    if result.timeseries:
        ts = result.timeseries
        insights.append(Insight(
            severity="medium",
            text=f"发现时间序列：'{ts.time_column}' vs '{ts.value_column}'，已完成趋势拆解和预测。",
            viz="timeseries",
        ))
        if ts.forecast and ts.forecast.get("values"):
            vals = ts.forecast["values"]
            if len(vals) >= 2:
                delta = vals[-1] - vals[0]
                if abs(delta) > 0.01:
                    direction = "上升" if delta > 0 else "下降"
                    insights.append(Insight(
                        severity="medium",
                        text=f"预测未来 {len(vals)} 个周期 '{ts.value_column}' 将{direction}。",
                        viz="timeseries",
                    ))

    for cf in result.categorical_freq[:2]:
        if cf.values:
            top = cf.values[0]
            insights.append(Insight(
                severity="low",
                text=f"'{cf.column}' 中 '{top['name']}' 占比最高，达 {top['percentage']}%。",
                viz="pie",
                details={"column": cf.column, "top": top},
            ))

    if len(insights) == 0:
        insights.append(Insight(
            severity="low",
            text="数据整体较为平稳，未发现显著异常或强相关关系。",
            viz="columns",
        ))

    headline_parts = [
        f"{ds.rows} 行 × {ds.cols} 列",
        f"质量{'优秀' if ds.total_missing_rate < 0.05 else '良好' if ds.total_missing_rate < 0.2 else '待提升'}",
    ]
    if total_outliers > 0:
        headline_parts.append(f"{total_outliers} 个异常点")
    if result.correlations and result.correlations.top_pairs:
        headline_parts.append(f"{len(result.correlations.top_pairs)} 对关系")

    headline = " · ".join(headline_parts)

    return SummaryResult(headline=headline, insights=insights)
