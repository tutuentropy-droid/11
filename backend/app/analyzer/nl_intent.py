from __future__ import annotations
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from ..models.schemas import ParsedIntent, IntentFilter

logger = logging.getLogger(__name__)

_llm_config: Dict[str, Any] = {
    "provider": "",
    "api_key": "",
    "base_url": "",
    "model": "",
}


def set_llm_config(provider: str, api_key: str, base_url: str = "", model: str = "") -> None:
    _llm_config["provider"] = provider
    _llm_config["api_key"] = api_key
    _llm_config["base_url"] = base_url
    _llm_config["model"] = model or _default_model_for_provider(provider)


def get_llm_config_status() -> Tuple[bool, str, str]:
    configured = bool(_llm_config.get("api_key"))
    return configured, _llm_config.get("provider", ""), _llm_config.get("model", "")


def _default_model_for_provider(provider: str) -> str:
    p = provider.lower()
    if "deepseek" in p:
        return "deepseek-chat"
    if "qwen" in p or "dashscope" in p or "ali" in p:
        return "qwen-plus"
    if "glm" in p or "zhipu" in p:
        return "glm-4"
    if "claude" in p or "anthropic" in p:
        return "claude-3-sonnet-20240229"
    return "gpt-4o-mini"


def _load_llm_config_from_env() -> None:
    provider = os.environ.get("LLM_PROVIDER", "")
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")
    model = os.environ.get("LLM_MODEL", "")
    if api_key and not _llm_config.get("api_key"):
        set_llm_config(provider or "openai", api_key, base_url, model)


_load_llm_config_from_env()


CHART_TYPE_KEYWORDS = {
    "timeseries": [
        "趋势", "走势", "时间", "月度", "每月", "每周", "每日", "季度", "年度",
        "变化", "随时间", "时间序列", "时序",
    ],
    "bar": [
        "柱状", "柱图", "条形", "对比", "比较", "排名", "排行", "多少",
    ],
    "pie": [
        "饼图", "占比", "比例", "分布", "构成", "百分比",
    ],
    "scatter": [
        "散点", "相关", "关联", "关系",
    ],
    "line": [
        "折线", "曲线", "连线",
    ],
    "area": [
        "面积", "堆叠",
    ],
}

AGGREGATION_KEYWORDS = {
    "sum": ["总和", "总计", "总", "合计", "一共", "总共"],
    "mean": ["平均", "均值", "平均值"],
    "count": ["数量", "数目", "个数", "多少次", "多少条"],
    "max": ["最大", "最高", "峰值"],
    "min": ["最小", "最低"],
}

TIME_GRANULARITY_KEYWORDS = {
    "year": ["年度", "每年", "按年", "年"],
    "quarter": ["季度", "每季", "按季"],
    "month": ["月度", "每月", "按月", "月"],
    "week": ["每周", "按周", "周"],
    "day": ["每日", "每天", "按日", "天", "日"],
}

REGION_KEYWORDS = {
    "华东": ["华东", "东部", "沪苏浙皖", "江浙沪"],
    "华北": ["华北", "北部", "京津冀"],
    "华南": ["华南", "南部", "粤港澳", "珠三角"],
    "华中": ["华中", "中部"],
    "西南": ["西南", "西部"],
    "西北": ["西北"],
    "东北": ["东北"],
    "East": ["east", "eastern"],
    "North": ["north", "northern"],
    "South": ["south", "southern"],
    "West": ["west", "western"],
    "Central": ["central", "middle"],
}


def _detect_chart_type(text: str) -> str:
    scores: Dict[str, int] = {}
    for ctype, keywords in CHART_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[ctype] = score
    if scores:
        return max(scores, key=scores.get)
    if "趋势" in text or "时间" in text:
        return "timeseries"
    if "对比" in text or "比较" in text:
        return "bar"
    if "占比" in text or "比例" in text:
        return "pie"
    return "bar"


def _detect_aggregation(text: str) -> str:
    for agg, keywords in AGGREGATION_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return agg
    return "sum"


def _detect_time_granularity(text: str) -> Optional[str]:
    for gran, keywords in TIME_GRANULARITY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return gran
    return None


def _extract_filters(text: str, column_names: List[str], categorical_values: Dict[str, List[str]]) -> List[IntentFilter]:
    filters: List[IntentFilter] = []
    text_lower = text.lower()

    for col, values in categorical_values.items():
        matched_values: List[str] = []
        for v in values:
            v_str = str(v)
            if v_str and (v_str in text or v_str.lower() in text_lower):
                matched_values.append(v_str)
        if not matched_values:
            col_lower = col.lower()
            for region_name, aliases in REGION_KEYWORDS.items():
                if any(a in text for a in aliases) and ("region" in col_lower or "地区" in col or "区域" in col):
                    matched_values.append(region_name)
                    break
        if matched_values:
            filters.append(IntentFilter(column=col, operator="in", values=matched_values))

    return filters


def _extract_value_columns(text: str, column_names: List[str], numeric_cols: List[str]) -> List[str]:
    matched: List[str] = []
    text_lower = text.lower()

    value_hints = ["利润", "profit", "销售额", "销量", "销售", "sales", "数量", "quantity",
                   "金额", "amount", "收入", "revenue", "成本", "cost", "价格", "price"]

    for col in numeric_cols:
        col_lower = col.lower()
        if any(h in col for h in value_hints) or any(h in col_lower for h in [h.lower() for h in value_hints]):
            if col in text or col_lower in text_lower or any(h in text for h in value_hints if h in col):
                matched.append(col)

    if not matched:
        if any(w in text for w in ["利润", "profit"]):
            for col in numeric_cols:
                if "利润" in col or "profit" in col.lower():
                    matched.append(col)
                    break
        if not matched and any(w in text for w in ["销售额", "销量", "销售", "sales"]):
            for col in numeric_cols:
                if "销售" in col or "sale" in col.lower() or "销量" in col:
                    matched.append(col)
                    break
    if not matched and numeric_cols:
        matched = [numeric_cols[0]]

    return matched


def _extract_group_by(text: str, column_names: List[str], categorical_cols: List[str]) -> List[str]:
    matched: List[str] = []
    text_lower = text.lower()

    group_hints = ["按", "每个", "各", "根据", "依据", "对比", "比较", "分"]

    for col in categorical_cols:
        col_lower = col.lower()
        if col in text or col_lower in text_lower:
            matched.append(col)
        else:
            hint_aliases = {
                "region": ["地区", "区域", "大区"],
                "product": ["产品", "商品"],
                "category": ["品类", "类别", "分类"],
                "customer": ["客户", "用户"],
                "segment": ["细分", "群体"],
                "date": ["时间", "日期"],
            }
            for key, aliases in hint_aliases.items():
                if key in col_lower and any(a in text for a in aliases):
                    matched.append(col)
                    break

    if any(h in text for h in ["三个区域", "各区域", "各个地区", "每个地区"]):
        for col in categorical_cols:
            if "region" in col.lower() or "地区" in col or "区域" in col:
                if col not in matched:
                    matched.append(col)
                break

    if any(h in text for h in ["产品", "商品"]):
        for col in categorical_cols:
            if "product" in col.lower() or "产品" in col:
                if col not in matched:
                    matched.append(col)
                break

    return matched


def _extract_time_column(text: str, datetime_cols: List[str]) -> Optional[str]:
    if not datetime_cols:
        return None
    if any(w in text for w in ["时间", "日期", "月", "趋势", "走势", "每周", "每月", "每天", "年度", "季度"]):
        return datetime_cols[0]
    return None


def parse_intent_keyword(
    query: str,
    column_names: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
    datetime_cols: List[str],
    categorical_values: Dict[str, List[str]],
) -> ParsedIntent:
    chart_type = _detect_chart_type(query)
    aggregation = _detect_aggregation(query)
    time_granularity = _detect_time_granularity(query)
    value_cols = _extract_value_columns(query, column_names, numeric_cols)
    group_by = _extract_group_by(query, column_names, categorical_cols)
    time_col = _extract_time_column(query, datetime_cols)
    filters = _extract_filters(query, column_names, categorical_values)

    if chart_type == "timeseries" and not time_col and datetime_cols:
        time_col = datetime_cols[0]

    if chart_type == "pie" and not group_by and categorical_cols:
        group_by = [categorical_cols[0]]

    if chart_type == "bar" and not group_by and categorical_cols:
        group_by = categorical_cols[:1]

    title = query.strip()

    return ParsedIntent(
        chart_type=chart_type,
        value_columns=value_cols,
        group_by=group_by,
        time_column=time_col,
        filters=filters,
        aggregation=aggregation,
        time_granularity=time_granularity,
        title=title,
        parser_source="keyword",
    )


def _call_llm(prompt: str) -> Optional[str]:
    configured, _, _ = get_llm_config_status()
    if not configured:
        return None

    try:
        import urllib.request
        import ssl

        api_key = _llm_config["api_key"]
        base_url = _llm_config["base_url"] or "https://api.openai.com/v1"
        model = _llm_config["model"] or "gpt-4o-mini"

        if base_url.endswith("/"):
            base_url = base_url[:-1]
        url = f"{base_url}/chat/completions"

        payload = json.dumps({
            "model": model,
            "messages": [
                {"role": "system", "content": "你是一个数据分析意图解析助手。请严格按照 JSON 格式输出。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )

        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            return content
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return None


def parse_intent_llm(
    query: str,
    column_names: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
    datetime_cols: List[str],
    categorical_values: Dict[str, List[str]],
) -> Optional[ParsedIntent]:
    configured, _, _ = get_llm_config_status()
    if not configured:
        return None

    cat_values_preview = {}
    for col, vals in categorical_values.items():
        cat_values_preview[col] = vals[:20]

    prompt = f"""
请解析以下自然语言查询，输出严格的 JSON 格式。

用户查询: "{query}"

可用列信息:
- 所有列: {column_names}
- 数值列: {numeric_cols}
- 分类列: {categorical_cols}
- 时间列: {datetime_cols}
- 分类列示例值: {json.dumps(cat_values_preview, ensure_ascii=False)}

图表类型可选值: timeseries, bar, pie, scatter, line, area
聚合方式可选值: sum, mean, count, max, min
时间粒度可选值: year, quarter, month, week, day

请输出 JSON 格式:
{{
  "chart_type": "图表类型",
  "value_columns": ["数值列名1", "数值列名2"],
  "group_by": ["分组列名"],
  "time_column": "时间列名或null",
  "filters": [
    {{"column": "列名", "operator": "in", "values": ["匹配值1", "匹配值2"]}}
  ],
  "aggregation": "聚合方式",
  "time_granularity": "时间粒度或null",
  "title": "图表标题"
}}

要求:
1. value_columns 只从 numeric_cols 中选择
2. group_by 只从 categorical_cols 或 datetime_cols 中选择
3. filters 里的值必须是该列真实存在的值
4. 如果查询涉及时间趋势，chart_type 用 timeseries
5. 如果查询涉及占比，chart_type 用 pie
6. 如果查询涉及对比比较，chart_type 用 bar
7. 只输出 JSON，不要任何额外文字
"""

    raw = _call_llm(prompt)
    if not raw:
        return None

    try:
        data = json.loads(raw)
        intent = ParsedIntent(
            chart_type=data.get("chart_type", "bar"),
            value_columns=[c for c in data.get("value_columns", []) if c in numeric_cols],
            group_by=[c for c in data.get("group_by", []) if c in categorical_cols or c in datetime_cols],
            time_column=data.get("time_column") if data.get("time_column") in datetime_cols else None,
            filters=[
                IntentFilter(
                    column=f["column"],
                    operator=f.get("operator", "in"),
                    values=f.get("values", []),
                )
                for f in data.get("filters", [])
                if f.get("column") in column_names
            ],
            aggregation=data.get("aggregation", "sum"),
            time_granularity=data.get("time_granularity"),
            title=data.get("title", query.strip()),
            parser_source="llm",
        )
        if not intent.value_columns and numeric_cols:
            intent.value_columns = [numeric_cols[0]]
        return intent
    except Exception as e:
        logger.warning(f"LLM response parse failed: {e}, raw: {raw}")
        return None


def parse_intent(
    query: str,
    column_names: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
    datetime_cols: List[str],
    categorical_values: Dict[str, List[str]],
) -> ParsedIntent:
    llm_result = parse_intent_llm(
        query, column_names, numeric_cols, categorical_cols, datetime_cols, categorical_values
    )
    if llm_result is not None:
        return llm_result
    return parse_intent_keyword(
        query, column_names, numeric_cols, categorical_cols, datetime_cols, categorical_values
    )
