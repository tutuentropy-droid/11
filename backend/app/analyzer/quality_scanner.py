from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np
import re
from ..models.schemas import (
    DataQualityIssue,
    DataQualityReport,
    QualityCategory,
    QualityFixSuggestion,
)


DATE_REGEXES = [
    (re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$"), "YYYY-MM-DD"),
    (re.compile(r"^\d{4}/\d{2}/\d{2}( \d{2}:\d{2}(:\d{2})?)?$"), "YYYY/MM/DD"),
    (re.compile(r"^\d{2}-\d{2}-\d{4}$"), "DD-MM-YYYY"),
    (re.compile(r"^\d{2}/\d{2}/\d{4}$"), "DD/MM/YYYY"),
    (re.compile(r"^\d{4}年\d{1,2}月\d{1,2}日$"), "YYYY年MM月DD日"),
]

NUMBER_REGEX = re.compile(r"^-?\d+(\.\d+)?$")
NUMBER_WITH_COMMA_REGEX = re.compile(r"^-?\d{1,3}(,\d{3})*(\.\d+)?$")
NUMBER_WITH_UNIT_REGEX = re.compile(r"^(-?\d+(\.\d+)?)\s*[¥$€%元千百万]$")


def _scan_duplicates(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    dup_mask = df.duplicated(keep=False)
    if not dup_mask.any():
        return issues
    dup_groups: Dict[tuple, List[int]] = {}
    for idx, is_dup in enumerate(dup_mask):
        if not is_dup:
            continue
        row_key = tuple(str(v) if not pd.isna(v) else None for v in df.iloc[idx])
        if row_key not in dup_groups:
            dup_groups[row_key] = []
        dup_groups[row_key].append(int(idx))
    for key, indices in dup_groups.items():
        if len(indices) < 2:
            continue
        sample_row = df.iloc[indices[0]].to_dict()
        preview = {k: (None if pd.isna(v) else (int(v) if isinstance(v, (np.integer,)) else (round(float(v), 4) if isinstance(v, (np.floating,)) else v))) for k, v in list(sample_row.items())[:5]}
        issues.append(
            DataQualityIssue(
                issue_type="duplicate",
                severity="high",
                column="__all__",
                row_indices=indices,
                count=len(indices),
                message=f"发现 {len(indices)} 行重复数据",
                details={
                    "duplicate_count": len(indices),
                    "sample_preview": preview,
                    "affected_rows": indices,
                },
                suggestion=QualityFixSuggestion(
                    fix_type="deduplicate",
                    description="删除重复行，仅保留首行",
                    impact=f"将删除 {len(indices) - 1} 行重复数据",
                ),
            )
        )
    return issues


def _scan_missing_values(df: pd.DataFrame) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    for col in df.columns:
        missing_mask = df[col].isna()
        if not missing_mask.any():
            continue
        missing_indices = [int(i) for i in df.index[missing_mask].tolist()]
        missing_count = len(missing_indices)
        missing_pct = round(missing_count / max(len(df), 1) * 100, 2)
        col_type = df[col].dtype
        fill_strategy = "mean"
        if pd.api.types.is_numeric_dtype(col_type):
            fill_value = round(float(df[col].mean()), 4)
            fill_desc = f"用均值 {fill_value} 填充"
        else:
            mode_vals = df[col].mode()
            if len(mode_vals) > 0:
                fill_value = str(mode_vals.iloc[0]) if not pd.isna(mode_vals.iloc[0]) else ""
                fill_desc = f"用众数 '{fill_value}' 填充"
                fill_strategy = "mode"
            else:
                fill_value = ""
                fill_desc = "用空字符串填充"
                fill_strategy = "empty"
        severity = "high" if missing_pct > 10 else ("medium" if missing_pct > 3 else "low")
        issues.append(
            DataQualityIssue(
                issue_type="missing",
                severity=severity,
                column=col,
                row_indices=missing_indices,
                count=missing_count,
                message=f"{col} 列有 {missing_count} 个缺失值 ({missing_pct}%)",
                details={
                    "missing_count": missing_count,
                    "missing_percentage": missing_pct,
                    "affected_rows": missing_indices[:100],
                },
                suggestion=QualityFixSuggestion(
                    fix_type="fill_missing",
                    column=col,
                    fill_strategy=fill_strategy,
                    fill_value=fill_value if isinstance(fill_value, (int, float, str)) else None,
                    description=fill_desc,
                    impact=f"将填充 {missing_count} 个缺失值",
                ),
            )
        )
    return issues


def _scan_date_format_issues(df: pd.DataFrame, col_types: Dict[str, str]) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    for col, ctype in col_types.items():
        if ctype != "datetime":
            continue
        series = df[col].dropna()
        if len(series) == 0:
            continue
        str_vals = series.astype(str)
        bad_indices: List[int] = []
        bad_samples: List[str] = []
        for idx in series.index:
            val = str_vals.loc[idx]
            matched = any(p.match(val.strip()) for p, _ in DATE_REGEXES)
            try:
                pd.Timestamp(val)
                matched = True
            except Exception:
                pass
            if not matched:
                bad_indices.append(int(idx))
                if len(bad_samples) < 5:
                    bad_samples.append(str(val))
        if bad_indices:
            severity = "high" if len(bad_indices) > 10 else ("medium" if len(bad_indices) > 3 else "low")
            issues.append(
                DataQualityIssue(
                    issue_type="format_date",
                    severity=severity,
                    column=col,
                    row_indices=bad_indices,
                    count=len(bad_indices),
                    message=f"{col} 列有 {len(bad_indices)} 个日期格式异常",
                    details={
                        "bad_count": len(bad_indices),
                        "bad_samples": bad_samples,
                        "affected_rows": bad_indices[:100],
                    },
                    suggestion=QualityFixSuggestion(
                        fix_type="parse_date",
                        column=col,
                        description="尝试解析异常日期，无法解析则置空",
                        impact=f"将处理 {len(bad_indices)} 个异常日期格式",
                    ),
                )
            )
    return issues


def _scan_numeric_format_issues(df: pd.DataFrame, col_types: Dict[str, str]) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    for col in df.columns:
        if col_types.get(col) not in ("numeric", "text", "categorical"):
            continue
        series = df[col].dropna()
        if len(series) == 0:
            continue
        if pd.api.types.is_numeric_dtype(series):
            continue
        str_vals = series.astype(str).str.strip()
        numeric_count = 0
        total = len(str_vals)
        for v in str_vals:
            if (NUMBER_REGEX.match(v) or NUMBER_WITH_COMMA_REGEX.match(v) or NUMBER_WITH_UNIT_REGEX.match(v)):
                numeric_count += 1
        if numeric_count < max(3, total * 0.5):
            continue
        bad_indices: List[int] = []
        bad_samples: List[str] = []
        for idx in series.index:
            val = str_vals.loc[idx]
            if not (NUMBER_REGEX.match(val) or NUMBER_WITH_COMMA_REGEX.match(val) or NUMBER_WITH_UNIT_REGEX.match(val)):
                bad_indices.append(int(idx))
                if len(bad_samples) < 5:
                    bad_samples.append(str(val))
        if bad_indices:
            severity = "high" if len(bad_indices) > 10 else ("medium" if len(bad_indices) > 3 else "low")
            issues.append(
                DataQualityIssue(
                    issue_type="format_numeric",
                    severity=severity,
                    column=col,
                    row_indices=bad_indices,
                    count=len(bad_indices),
                    message=f"{col} 列有 {len(bad_indices)} 个数值格式异常（含单位/符号或非数字）",
                    details={
                        "bad_count": len(bad_indices),
                        "bad_samples": bad_samples,
                        "affected_rows": bad_indices[:100],
                    },
                    suggestion=QualityFixSuggestion(
                        fix_type="parse_numeric",
                        column=col,
                        description="清除单位和千分位符号，转换为纯数字，无法转换则置空",
                        impact=f"将处理 {len(bad_indices)} 个异常数值格式",
                    ),
                )
            )
    return issues


def _scan_case_inconsistency(df: pd.DataFrame, col_types: Dict[str, str]) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    for col, ctype in col_types.items():
        if ctype not in ("categorical", "text"):
            continue
        series = df[col].dropna()
        if len(series) == 0:
            continue
        str_vals = series.astype(str)
        non_empty = str_vals[str_vals.str.len() > 0]
        if len(non_empty) < 5:
            continue
        lower_map: Dict[str, List[Tuple[str, int]]] = {}
        for idx in non_empty.index:
            val = str(non_empty.loc[idx])
            key = val.lower()
            if key not in lower_map:
                lower_map[key] = []
            lower_map[key].append((val, int(idx)))
        inconsistent_groups = {k: v for k, v in lower_map.items() if len(set(x[0] for x in v)) > 1}
        if not inconsistent_groups:
            continue
        affected_indices: List[int] = []
        group_details: List[Dict[str, Any]] = []
        for key, entries in inconsistent_groups.items():
            variants = list(set(x[0] for x in entries))
            if len(variants) <= 1:
                continue
            variant_counts: Dict[str, int] = {}
            for val, _ in entries:
                variant_counts[val] = variant_counts.get(val, 0) + 1
            canonical = max(variant_counts, key=variant_counts.get)
            indices_in_group = [i for _, i in entries]
            affected_indices.extend(indices_in_group)
            group_details.append({
                "canonical": canonical,
                "variants": variants,
                "variant_counts": variant_counts,
                "affected_count": len(indices_in_group),
            })
        if not group_details:
            continue
        severity = "medium" if len(affected_indices) > 10 else "low"
        issues.append(
            DataQualityIssue(
                issue_type="case_inconsistency",
                severity=severity,
                column=col,
                row_indices=sorted(set(affected_indices)),
                count=len(set(affected_indices)),
                message=f"{col} 列有 {len(group_details)} 组大小写不一致的分类值",
                details={
                    "group_count": len(group_details),
                    "groups": group_details,
                    "affected_rows": sorted(set(affected_indices))[:100],
                },
                suggestion=QualityFixSuggestion(
                    fix_type="normalize_case",
                    column=col,
                    description="统一为使用频率最高的写法",
                    impact=f"将规范化 {len(group_details)} 组分类值的写法",
                ),
            )
        )
    return issues


def _scan_extreme_values(df: pd.DataFrame, col_types: Dict[str, str]) -> List[DataQualityIssue]:
    issues: List[DataQualityIssue] = []
    for col, ctype in col_types.items():
        if ctype != "numeric":
            continue
        series = df[col].dropna()
        if len(series) < 10:
            continue
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        if iqr == 0:
            continue
        mild_lower = q1 - 1.5 * iqr
        mild_upper = q3 + 1.5 * iqr
        extreme_lower = q1 - 3.0 * iqr
        extreme_upper = q3 + 3.0 * iqr
        extreme_mask = (series < extreme_lower) | (series > extreme_upper)
        if not extreme_mask.any():
            continue
        extreme_indices = [int(i) for i in series.index[extreme_mask].tolist()]
        extreme_vals = [round(float(series.loc[i]), 4) for i in extreme_indices[:5]]
        median = float(series.median())
        mean = float(series.mean())
        severity = "high" if len(extreme_indices) > 5 else ("medium" if len(extreme_indices) > 2 else "low")
        issues.append(
            DataQualityIssue(
                issue_type="extreme_value",
                severity=severity,
                column=col,
                row_indices=extreme_indices,
                count=len(extreme_indices),
                message=f"{col} 列有 {len(extreme_indices)} 个极端异常值（超出 3×IQR）",
                details={
                    "extreme_count": len(extreme_indices),
                    "sample_values": extreme_vals,
                    "normal_range": {
                        "min": round(mild_lower, 4),
                        "max": round(mild_upper, 4),
                    },
                    "stats": {
                        "q1": round(q1, 4),
                        "q3": round(q3, 4),
                        "iqr": round(iqr, 4),
                        "median": round(median, 4),
                        "mean": round(mean, 4),
                    },
                    "affected_rows": extreme_indices[:100],
                },
                suggestion=QualityFixSuggestion(
                    fix_type="winsorize",
                    column=col,
                    description="将极端值裁剪到上下界（1.5×IQR）",
                    impact=f"将修正 {len(extreme_indices)} 个极端值",
                ),
            )
        )
    return issues


def _compute_quality_score(
    df: pd.DataFrame,
    issues: List[DataQualityIssue],
) -> QualityCategory:
    total_cells = max(df.shape[0] * df.shape[1], 1)
    total_rows = max(df.shape[0], 1)
    completeness_weight = 0.30
    uniqueness_weight = 0.20
    validity_weight = 0.25
    consistency_weight = 0.15
    accuracy_weight = 0.10

    missing_count = sum(i.count for i in issues if i.issue_type == "missing")
    completeness = max(0.0, 1.0 - missing_count / total_cells)

    dup_count = sum(max(0, i.count - 1) for i in issues if i.issue_type == "duplicate")
    uniqueness = max(0.0, 1.0 - dup_count / total_rows)

    format_count = sum(i.count for i in issues if i.issue_type in ("format_date", "format_numeric"))
    validity = max(0.0, 1.0 - format_count / total_cells)

    case_count = sum(i.count for i in issues if i.issue_type == "case_inconsistency")
    consistency = max(0.0, 1.0 - case_count / total_cells)

    extreme_count = sum(i.count for i in issues if i.issue_type == "extreme_value")
    accuracy = max(0.0, 1.0 - extreme_count / total_cells)

    score = round(
        completeness * completeness_weight
        + uniqueness * uniqueness_weight
        + validity * validity_weight
        + consistency * consistency_weight
        + accuracy * accuracy_weight,
        4,
    )
    score_pct = round(score * 100, 2)

    breakdown = {
        "completeness": round(completeness, 4),
        "uniqueness": round(uniqueness, 4),
        "validity": round(validity, 4),
        "consistency": round(consistency, 4),
        "accuracy": round(accuracy, 4),
    }

    issue_counts: Dict[str, int] = {}
    for i in issues:
        issue_counts[i.issue_type] = issue_counts.get(i.issue_type, 0) + 1

    return QualityCategory(
        score=score,
        score_percentage=score_pct,
        grade=(
            "A" if score_pct >= 90
            else "B" if score_pct >= 75
            else "C" if score_pct >= 60
            else "D" if score_pct >= 40
            else "F"
        ),
        breakdown=breakdown,
        issue_counts=issue_counts,
    )


def scan_data_quality(df: pd.DataFrame, col_types: Optional[Dict[str, str]] = None) -> DataQualityReport:
    df = df.copy()
    if col_types is None:
        from .column_types import classify_all_columns
        col_types = classify_all_columns(df)

    all_issues: List[DataQualityIssue] = []
    all_issues.extend(_scan_duplicates(df))
    all_issues.extend(_scan_missing_values(df))
    all_issues.extend(_scan_date_format_issues(df, col_types))
    all_issues.extend(_scan_numeric_format_issues(df, col_types))
    all_issues.extend(_scan_case_inconsistency(df, col_types))
    all_issues.extend(_scan_extreme_values(df, col_types))

    severity_order = {"high": 0, "medium": 1, "low": 2}
    all_issues.sort(key=lambda i: (severity_order.get(i.severity, 3), -i.count))

    quality = _compute_quality_score(df, all_issues)

    return DataQualityReport(
        quality=quality,
        issues=all_issues,
        total_rows=int(df.shape[0]),
        total_columns=int(df.shape[1]),
        total_cells=int(df.shape[0] * df.shape[1]),
        total_issues=len(all_issues),
        total_affected_rows=len(set(idx for i in all_issues for idx in i.row_indices)),
    )
