from typing import List, Dict, Any
import pandas as pd
import numpy as np

from ..models.schemas import OutlierStoryCard


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


def _format_number(v: float) -> str:
    if abs(v) >= 10000:
        return f"{v:,.0f}"
    if abs(v) >= 100:
        return f"{v:,.1f}"
    return f"{v:.2f}"


def _get_outlier_bounds(series: pd.Series):
    s = series.dropna()
    if len(s) < 4:
        return None, None, None, None
    q1 = float(s.quantile(0.25))
    q3 = float(s.quantile(0.75))
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    mean = float(s.mean())
    median = float(s.median())
    return lower, upper, mean, median


def _infer_context_reason(row: Dict[str, Any], categorical_cols: List[str]) -> str:
    reasons = []
    promotion_keywords = {"promotion", "promo", "discount", "sale", "促销", "折扣"}
    for col in categorical_cols:
        val = row.get(col)
        if val is None:
            continue
        val_str = str(val).lower()
        if any(kw in val_str for kw in promotion_keywords):
            reasons.append(f"当天{col}为'{val}'")
    return reasons


def generate_outlier_stories(
    df: pd.DataFrame,
    col_types: Dict[str, str],
) -> List[OutlierStoryCard]:
    stories: List[OutlierStoryCard] = []
    numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
    categorical_cols = [c for c, t in col_types.items() if t in ("categorical", "boolean")]
    datetime_cols = [c for c, t in col_types.items() if t == "datetime"]

    for col in numeric_cols:
        series = df[col]
        outliers = detect_outliers(series)
        if not outliers:
            continue

        lower, upper, mean, median = _get_outlier_bounds(series)
        if lower is None:
            continue

        for idx in outliers:
            if idx >= len(df):
                continue
            actual = float(series.iloc[idx])
            if pd.isna(actual):
                continue

            if actual > upper:
                direction = "偏高"
                expected_min = float(lower)
                expected_max = float(upper)
                baseline = mean if mean > 0 else median
                if baseline == 0:
                    continue
                deviation = (actual - baseline) / abs(baseline) * 100
            elif actual < lower:
                direction = "偏低"
                expected_min = float(lower)
                expected_max = float(upper)
                baseline = mean if mean > 0 else median
                if baseline == 0:
                    continue
                deviation = (baseline - actual) / abs(baseline) * 100
            else:
                continue

            row = df.iloc[idx]
            context_fields: Dict[str, Any] = {}

            for c in categorical_cols:
                val = row.get(c)
                if val is not None and not pd.isna(val):
                    if isinstance(val, (np.integer,)):
                        context_fields[c] = int(val)
                    elif isinstance(val, (np.floating,)):
                        context_fields[c] = round(float(val), 4)
                    else:
                        context_fields[c] = str(val)

            for c in datetime_cols:
                val = row.get(c)
                if val is not None and not pd.isna(val):
                    if isinstance(val, pd.Timestamp):
                        context_fields[c] = val.strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        context_fields[c] = str(val)

            time_str = ""
            for c in datetime_cols:
                val = row.get(c)
                if val is not None and not pd.isna(val):
                    if isinstance(val, pd.Timestamp):
                        time_str = val.strftime("%Y年%m月%d日")
                    else:
                        time_str = str(val)
                    break

            category_str = ""
            for c in categorical_cols:
                val = row.get(c)
                if val is not None and not pd.isna(val) and c not in {"product", "region"}:
                    category_str = f"{c}为'{val}'"
                    break

            product_str = ""
            if "product" in df.columns:
                val = row.get("product")
                if val is not None and not pd.isna(val):
                    product_str = f"{val}"

            region_str = ""
            if "region" in df.columns:
                val = row.get("region")
                if val is not None and not pd.isna(val):
                    region_str = f"{val}地区"

            context_reasons = _infer_context_reason(row.to_dict(), categorical_cols)

            ratio = actual / baseline if baseline > 0 else 0

            parts = []
            if time_str:
                parts.append(time_str)
            if region_str:
                parts.append(region_str)
            if product_str:
                parts.append(product_str)
            subject = "，".join(parts) if parts else f"第{idx}条记录"

            story = f"{subject}的{col}为{_format_number(actual)}元，是同类均值的{ratio:.1f}倍"
            if context_reasons:
                story += f"，{'、'.join(context_reasons)}，可能由此带来的{'高峰' if direction == '偏高' else '低谷'}"
            else:
                hints = []
                if category_str:
                    hints.append(category_str)
                if hints:
                    story += f"，当时{'、'.join(hints)}，需结合业务背景进一步核查"
                else:
                    story += "，需结合业务背景进一步核查"

            card = OutlierStoryCard(
                row_index=int(idx),
                column=col,
                story=story,
                actual_value=round(actual, 4),
                expected_min=round(expected_min, 4),
                expected_max=round(expected_max, 4),
                deviation_percent=round(deviation, 2),
                direction=direction,
                context_fields=context_fields,
            )
            stories.append(card)

    return stories
