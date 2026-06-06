from __future__ import annotations
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

from ..models.schemas import (
    ParsedIntent,
    CustomChartData,
    ChartDataPoint,
)


def _apply_filters(df: pd.DataFrame, filters: List[Any]) -> pd.DataFrame:
    result = df.copy()
    for f in filters:
        col = f.column
        op = f.operator
        values = f.values
        if col not in result.columns:
            continue
        if op == "in":
            str_vals = [str(v) for v in values]
            mask = result[col].astype(str).isin(str_vals)
            for alias_group in [
                ["华东", "East", "东部", "沪苏浙皖", "江浙沪"],
                ["华北", "North", "北部", "京津冀"],
                ["华南", "South", "南部", "粤港澳", "珠三角"],
                ["华中", "Central", "中部"],
                ["西南", "West", "西部"],
            ]:
                matched = [v for v in str_vals if v in alias_group]
                if matched:
                    all_aliases = [a for a in alias_group if a in result[col].astype(str).unique()]
                    if all_aliases:
                        mask = mask | result[col].astype(str).isin(all_aliases)
            result = result[mask]
        elif op == "eq":
            result = result[result[col].astype(str) == str(values[0])]
        elif op == "gt":
            result = result[pd.to_numeric(result[col], errors="coerce") > float(values[0])]
        elif op == "lt":
            result = result[pd.to_numeric(result[col], errors="coerce") < float(values[0])]
    return result


def _aggregate(series: pd.Series, method: str) -> float:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if len(s) == 0:
        return 0.0
    if method == "sum":
        return float(s.sum())
    elif method == "mean":
        return float(s.mean())
    elif method == "count":
        return float(len(s))
    elif method == "max":
        return float(s.max())
    elif method == "min":
        return float(s.min())
    return float(s.sum())


def _truncate_time(dt: pd.Timestamp, granularity: Optional[str]) -> pd.Timestamp:
    if not granularity:
        return dt
    g = granularity.lower()
    if g == "year":
        return pd.Timestamp(year=dt.year, month=1, day=1)
    elif g == "quarter":
        q = ((dt.month - 1) // 3) * 3 + 1
        return pd.Timestamp(year=dt.year, month=q, day=1)
    elif g == "month":
        return pd.Timestamp(year=dt.year, month=dt.month, day=1)
    elif g == "week":
        return dt - pd.Timedelta(days=dt.weekday())
    elif g == "day":
        return pd.Timestamp(year=dt.year, month=dt.month, day=dt.day)
    return dt


def _format_time(dt: pd.Timestamp, granularity: Optional[str]) -> str:
    g = (granularity or "").lower()
    if g == "year":
        return dt.strftime("%Y")
    elif g == "quarter":
        q = (dt.month - 1) // 3 + 1
        return f"{dt.year} Q{q}"
    elif g == "month":
        return dt.strftime("%Y-%m")
    elif g == "week":
        return dt.strftime("%Y-%m-%d") + " 周"
    elif g == "day":
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d %H:%M")


def _get_time_granularity(n_points: int, intent: ParsedIntent) -> str:
    if intent.time_granularity:
        return intent.time_granularity
    if n_points <= 12:
        return "month"
    if n_points <= 30:
        return "week"
    return "day"


def generate_chart_data(df: pd.DataFrame, intent: ParsedIntent) -> CustomChartData:
    filtered_df = _apply_filters(df, intent.filters)

    if len(filtered_df) == 0:
        return CustomChartData(
            chart_type=intent.chart_type,
            title=intent.title or "无数据",
            message="筛选后无匹配数据",
        )

    value_cols = intent.value_columns or []
    if not value_cols:
        numeric_cols = filtered_df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            value_cols = [numeric_cols[0]]

    chart_type = intent.chart_type or "bar"

    if chart_type in ("timeseries", "line", "area"):
        return _generate_timeseries(filtered_df, intent, value_cols)
    elif chart_type == "pie":
        return _generate_pie(filtered_df, intent, value_cols)
    elif chart_type == "scatter":
        return _generate_scatter(filtered_df, intent, value_cols)
    else:
        return _generate_bar(filtered_df, intent, value_cols)


def _generate_timeseries(df: pd.DataFrame, intent: ParsedIntent, value_cols: List[str]) -> CustomChartData:
    time_col = intent.time_column
    if not time_col or time_col not in df.columns:
        datetime_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()
        if not datetime_cols:
            for col in df.columns:
                try:
                    parsed = pd.to_datetime(df[col], errors="coerce")
                    if parsed.notna().sum() / max(len(parsed), 1) > 0.5:
                        time_col = col
                        break
                except Exception:
                    pass
        else:
            time_col = datetime_cols[0]

    if not time_col:
        return _generate_bar(df, intent, value_cols)

    df = df.copy()
    df["_parsed_time"] = pd.to_datetime(df[time_col], errors="coerce")
    df = df.dropna(subset=["_parsed_time"])
    if len(df) == 0:
        return CustomChartData(chart_type="timeseries", title=intent.title or "无时间数据")

    granularity = _get_time_granularity(len(df), intent)
    df["_time_bucket"] = df["_parsed_time"].apply(lambda t: _truncate_time(t, granularity))

    group_cols = ["_time_bucket"] + [g for g in intent.group_by if g and g in df.columns and g != time_col]
    series_list: List[Dict[str, Any]] = []
    data_points: List[ChartDataPoint] = []
    categories: List[str] = []

    if not value_cols:
        return CustomChartData(chart_type="timeseries", title=intent.title or "无数值列")

    primary_value = value_cols[0]

    if len(group_cols) == 1:
        grouped = df.groupby("_time_bucket")[primary_value].apply(
            lambda s: _aggregate(s, intent.aggregation)
        ).reset_index()
        grouped = grouped.sort_values("_time_bucket")

        series_data: List[Dict[str, Any]] = []
        for _, row in grouped.iterrows():
            t = row["_time_bucket"]
            v = row[primary_value]
            label = _format_time(t, granularity)
            if label not in categories:
                categories.append(label)
            series_data.append({"time": label, "value": round(float(v), 4)})
            data_points.append(ChartDataPoint(x=label, value=round(float(v), 4)))

        series_list.append({
            "name": primary_value,
            "type": "line3D",
            "data": series_data,
        })
    else:
        cat_col = group_cols[1]
        grouped = df.groupby(group_cols)[primary_value].apply(
            lambda s: _aggregate(s, intent.aggregation)
        ).reset_index()
        grouped = grouped.sort_values("_time_bucket")

        all_times = sorted(grouped["_time_bucket"].unique())
        all_cats = [str(c) for c in grouped[cat_col].astype(str).unique()]

        for t in all_times:
            label = _format_time(t, granularity)
            if label not in categories:
                categories.append(label)

        for cat in all_cats:
            cat_df = grouped[grouped[cat_col].astype(str) == cat]
            series_data: List[Dict[str, Any]] = []
            for t in all_times:
                t_row = cat_df[cat_df["_time_bucket"] == t]
                v = float(t_row[primary_value].iloc[0]) if len(t_row) > 0 else 0.0
                label = _format_time(t, granularity)
                series_data.append({"time": label, "value": round(v, 4)})
                data_points.append(ChartDataPoint(x=label, category=cat, value=round(v, 4)))
            series_list.append({
                "name": str(cat),
                "type": "line3D",
                "data": series_data,
            })

    return CustomChartData(
        chart_type="timeseries",
        title=intent.title or f"{primary_value} 时间趋势",
        x_label=time_col,
        y_label="",
        z_label=primary_value,
        categories=categories,
        series=series_list,
        data_points=data_points,
        raw_columns=[time_col, primary_value] + [g for g in intent.group_by if g],
    )


def _generate_bar(df: pd.DataFrame, intent: ParsedIntent, value_cols: List[str]) -> CustomChartData:
    group_by = [g for g in intent.group_by if g and g in df.columns]

    if not group_by:
        categorical_cols = [c for c in df.columns if df[c].dtype == "object" or df[c].nunique() < 20]
        if categorical_cols:
            group_by = [categorical_cols[0]]

    if not value_cols:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        value_cols = numeric_cols[:1] if numeric_cols else []

    if not group_by:
        data_points: List[ChartDataPoint] = []
        series_list: List[Dict[str, Any]] = []
        categories: List[str] = []
        for vc in value_cols:
            v = _aggregate(df[vc], intent.aggregation)
            categories.append(vc)
            data_points.append(ChartDataPoint(x=vc, value=round(float(v), 4)))
        series_list.append({"name": intent.aggregation, "type": "bar3D", "data": [{"category": vc, "value": round(float(_aggregate(df[vc], intent.aggregation)), 4)} for vc in value_cols]})
        return CustomChartData(
            chart_type="bar",
            title=intent.title or "数值对比",
            x_label="指标",
            z_label=intent.aggregation,
            categories=categories,
            series=series_list,
            data_points=data_points,
            raw_columns=value_cols,
        )

    primary_group = group_by[0]
    secondary_group = group_by[1] if len(group_by) > 1 else None
    primary_value = value_cols[0] if value_cols else None

    if not primary_value:
        return CustomChartData(chart_type="bar", title=intent.title or "无数值列")

    series_list: List[Dict[str, Any]] = []
    data_points: List[ChartDataPoint] = []
    categories: List[str] = []

    if not secondary_group:
        grouped = df.groupby(primary_group)[primary_value].apply(
            lambda s: _aggregate(s, intent.aggregation)
        ).reset_index()
        grouped = grouped.sort_values(primary_value, ascending=False).head(20)

        series_data: List[Dict[str, Any]] = []
        for _, row in grouped.iterrows():
            cat = str(row[primary_group])
            v = float(row[primary_value])
            categories.append(cat)
            series_data.append({"category": cat, "value": round(v, 4)})
            data_points.append(ChartDataPoint(x=cat, value=round(v, 4)))

        series_list.append({
            "name": primary_value,
            "type": "bar3D",
            "data": series_data,
        })
    else:
        grouped = df.groupby([primary_group, secondary_group])[primary_value].apply(
            lambda s: _aggregate(s, intent.aggregation)
        ).reset_index()

        all_primary = [str(c) for c in grouped[primary_group].astype(str).unique()]
        all_secondary = [str(c) for c in grouped[secondary_group].astype(str).unique()]
        categories = all_primary

        for sec in all_secondary:
            sec_df = grouped[grouped[secondary_group].astype(str) == sec]
            series_data: List[Dict[str, Any]] = []
            for pri in all_primary:
                row = sec_df[sec_df[primary_group].astype(str) == pri]
                v = float(row[primary_value].iloc[0]) if len(row) > 0 else 0.0
                series_data.append({"category": pri, "value": round(v, 4)})
                data_points.append(ChartDataPoint(x=pri, category=sec, value=round(v, 4)))
            series_list.append({
                "name": str(sec),
                "type": "bar3D",
                "data": series_data,
            })

    return CustomChartData(
        chart_type="bar",
        title=intent.title or f"{primary_value} 按 {primary_group} 对比",
        x_label=primary_group,
        y_label=secondary_group or "",
        z_label=primary_value,
        categories=categories,
        series=series_list,
        data_points=data_points,
        raw_columns=[primary_group, secondary_group or "", primary_value],
    )


def _generate_pie(df: pd.DataFrame, intent: ParsedIntent, value_cols: List[str]) -> CustomChartData:
    group_by = [g for g in intent.group_by if g and g in df.columns]
    if not group_by:
        categorical_cols = [c for c in df.columns if df[c].dtype == "object" or df[c].nunique() < 20]
        if categorical_cols:
            group_by = [categorical_cols[0]]

    primary_value = value_cols[0] if value_cols else None
    primary_group = group_by[0] if group_by else None

    if not primary_group:
        return CustomChartData(chart_type="pie", title=intent.title or "无分类列")

    if primary_value:
        grouped = df.groupby(primary_group)[primary_value].apply(
            lambda s: _aggregate(s, intent.aggregation)
        ).reset_index()
    else:
        grouped = df.groupby(primary_group).size().reset_index(name="__count__")
        primary_value = "__count__"

    grouped = grouped.sort_values(primary_value, ascending=False).head(15)
    total = float(grouped[primary_value].sum()) or 1.0

    series_list: List[Dict[str, Any]] = []
    data_points: List[ChartDataPoint] = []
    categories: List[str] = []
    pie_data: List[Dict[str, Any]] = []

    for _, row in grouped.iterrows():
        cat = str(row[primary_group])
        v = float(row[primary_value])
        pct = round(v / total * 100, 2)
        categories.append(cat)
        pie_data.append({"name": cat, "value": round(v, 4), "percentage": pct})
        data_points.append(ChartDataPoint(x=cat, value=round(v, 4), extra={"percentage": pct}))

    series_list.append({
        "name": primary_value,
        "type": "pie3D",
        "data": pie_data,
    })

    return CustomChartData(
        chart_type="pie",
        title=intent.title or f"{primary_value} 占比",
        x_label="",
        y_label="",
        z_label="",
        categories=categories,
        series=series_list,
        data_points=data_points,
        raw_columns=[primary_group, primary_value],
    )


def _generate_scatter(df: pd.DataFrame, intent: ParsedIntent, value_cols: List[str]) -> CustomChartData:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        return _generate_bar(df, intent, value_cols)

    x_col = numeric_cols[0]
    y_col = numeric_cols[1]
    z_col = numeric_cols[2] if len(numeric_cols) > 2 else None

    group_by = [g for g in intent.group_by if g and g in df.columns]
    cat_col = group_by[0] if group_by else None

    series_list: List[Dict[str, Any]] = []
    data_points: List[ChartDataPoint] = []
    categories: List[str] = []

    sampled = df.sample(min(500, len(df)), random_state=42) if len(df) > 500 else df

    if cat_col:
        for cat in sampled[cat_col].astype(str).unique():
            cat_df = sampled[sampled[cat_col].astype(str) == cat]
            if cat not in categories:
                categories.append(cat)
            scatter_data: List[List[float]] = []
            for _, row in cat_df.iterrows():
                xv = pd.to_numeric(row[x_col], errors="coerce")
                yv = pd.to_numeric(row[y_col], errors="coerce")
                zv = pd.to_numeric(row[z_col], errors="coerce") if z_col else 0.0
                if pd.isna(xv) or pd.isna(yv):
                    continue
                pt = [float(xv), float(yv)]
                if z_col and not pd.isna(zv):
                    pt.append(float(zv))
                else:
                    pt.append(0.0)
                scatter_data.append(pt)
                data_points.append(ChartDataPoint(x=float(xv), y=float(yv), z=float(zv) if z_col and not pd.isna(zv) else 0.0, category=cat))
            series_list.append({
                "name": str(cat),
                "type": "scatter3D",
                "data": scatter_data,
            })
    else:
        scatter_data: List[List[float]] = []
        for _, row in sampled.iterrows():
            xv = pd.to_numeric(row[x_col], errors="coerce")
            yv = pd.to_numeric(row[y_col], errors="coerce")
            zv = pd.to_numeric(row[z_col], errors="coerce") if z_col else 0.0
            if pd.isna(xv) or pd.isna(yv):
                continue
            pt = [float(xv), float(yv)]
            if z_col and not pd.isna(zv):
                pt.append(float(zv))
            else:
                pt.append(0.0)
            scatter_data.append(pt)
            data_points.append(ChartDataPoint(x=float(xv), y=float(yv), z=float(zv) if z_col and not pd.isna(zv) else 0.0))
        series_list.append({
            "name": "散点数据",
            "type": "scatter3D",
            "data": scatter_data,
        })

    return CustomChartData(
        chart_type="scatter",
        title=intent.title or "散点关系图",
        x_label=x_col,
        y_label=y_col,
        z_label=z_col or "",
        categories=categories,
        series=series_list,
        data_points=data_points,
        raw_columns=[x_col, y_col] + ([z_col] if z_col else []) + ([cat_col] if cat_col else []),
    )
