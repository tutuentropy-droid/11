from __future__ import annotations
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from ..models.schemas import ParsedIntent, IntentFilter
from ..utils import get_logger

logger = get_logger("analyzer.nl_intent")

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


def _detect_chart_type(text: str) -> Tuple[str, Dict[str, int]]:
    scores: Dict[str, int] = {}
    matched_keywords: Dict[str, List[str]] = {}
    for ctype, keywords in CHART_TYPE_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in text]
        score = len(matched)
        if score > 0:
            scores[ctype] = score
            matched_keywords[ctype] = matched
    logger.debug(
        "图表类型关键词匹配",
        query=text,
        scores=scores,
        matched_keywords=matched_keywords,
    )
    if scores:
        best = max(scores, key=scores.get)
        logger.info(
            "图表类型匹配成功",
            query=text,
            chart_type=best,
            score=scores[best],
            matched=matched_keywords.get(best, []),
        )
        return best, scores
    fallback = "bar"
    if "趋势" in text or "时间" in text:
        fallback = "timeseries"
    elif "对比" in text or "比较" in text:
        fallback = "bar"
    elif "占比" in text or "比例" in text:
        fallback = "pie"
    logger.warning(
        "图表类型关键词未匹配，使用启发式回退",
        query=text,
        fallback=fallback,
    )
    return fallback, scores


def _detect_aggregation(text: str) -> Tuple[str, List[str]]:
    for agg, keywords in AGGREGATION_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in text]
        if matched:
            logger.info(
                "聚合方式匹配成功",
                query=text,
                aggregation=agg,
                matched=matched,
            )
            return agg, matched
    logger.warning(
        "聚合方式关键词未匹配，使用默认 sum",
        query=text,
    )
    return "sum", []


def _detect_time_granularity(text: str) -> Tuple[Optional[str], List[str]]:
    for gran, keywords in TIME_GRANULARITY_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in text]
        if matched:
            logger.info(
                "时间粒度匹配成功",
                query=text,
                granularity=gran,
                matched=matched,
            )
            return gran, matched
    logger.info(
        "未匹配到时间粒度",
        query=text,
    )
    return None, []


def _extract_filters(text: str, column_names: List[str], categorical_values: Dict[str, List[str]]) -> Tuple[List[IntentFilter], Dict[str, Any]]:
    filters: List[IntentFilter] = []
    text_lower = text.lower()
    match_details: Dict[str, Any] = {}

    for col, values in categorical_values.items():
        matched_values: List[str] = []
        matched_reasons: List[str] = []
        for v in values:
            v_str = str(v)
            if v_str and (v_str in text or v_str.lower() in text_lower):
                matched_values.append(v_str)
                matched_reasons.append(f"值匹配: {v_str}")
        if not matched_values:
            col_lower = col.lower()
            for region_name, aliases in REGION_KEYWORDS.items():
                matched_aliases = [a for a in aliases if a in text]
                if matched_aliases and ("region" in col_lower or "地区" in col or "区域" in col):
                    matched_values.append(region_name)
                    matched_reasons.append(f"区域别名匹配: {matched_aliases} -> {region_name} (列 {col})")
                    break
        if matched_values:
            filters.append(IntentFilter(column=col, operator="in", values=matched_values))
            match_details[col] = {
                "matched_values": matched_values,
                "reasons": matched_reasons,
            }

    logger.info(
        "过滤条件提取结果",
        query=text,
        filters_count=len(filters),
        details=match_details,
        available_categorical_columns=list(categorical_values.keys()),
    )
    return filters, match_details


def _extract_value_columns(text: str, column_names: List[str], numeric_cols: List[str]) -> Tuple[List[str], Dict[str, Any]]:
    matched: List[str] = []
    text_lower = text.lower()
    match_reasons: Dict[str, str] = {}

    value_hints = ["利润", "profit", "销售额", "销量", "销售", "sales", "数量", "quantity",
                   "金额", "amount", "收入", "revenue", "成本", "cost", "价格", "price"]

    for col in numeric_cols:
        col_lower = col.lower()
        col_matched = False
        for h in value_hints:
            if h in col or h.lower() in col_lower:
                if col in text or col_lower in text_lower or h in text:
                    matched.append(col)
                    match_reasons[col] = f"值提示 '{h}' 命中列名且查询包含关键词"
                    col_matched = True
                    break
        if not col_matched and (col in text or col_lower in text_lower):
            matched.append(col)
            match_reasons[col] = f"列名直接出现在查询中"

    if not matched:
        fallback_reason = ""
        for col in numeric_cols:
            if "利润" in col or "profit" in col.lower():
                if any(w in text for w in ["利润", "profit"]):
                    matched.append(col)
                    fallback_reason = f"利润关键词回退匹配列 {col}"
                    break
        if not matched:
            for col in numeric_cols:
                if "销售" in col or "sale" in col.lower() or "销量" in col:
                    if any(w in text for w in ["销售额", "销量", "销售", "sales"]):
                        matched.append(col)
                        fallback_reason = f"销售关键词回退匹配列 {col}"
                        break
        if not matched and numeric_cols:
            matched = [numeric_cols[0]]
            fallback_reason = f"无匹配，使用第一个数值列 {numeric_cols[0]} 作为回退"
            match_reasons[matched[0]] = fallback_reason
            logger.warning(
                "数值列未匹配到关键词，使用回退策略",
                query=text,
                fallback=numeric_cols[0],
                available_numeric=numeric_cols,
            )
        elif fallback_reason:
            match_reasons[matched[0]] = fallback_reason

    logger.info(
        "数值列提取结果",
        query=text,
        matched_columns=matched,
        reasons=match_reasons,
        available_numeric=numeric_cols,
    )
    return matched, match_reasons


def _extract_group_by(text: str, column_names: List[str], categorical_cols: List[str]) -> Tuple[List[str], Dict[str, Any]]:
    matched: List[str] = []
    text_lower = text.lower()
    match_reasons: Dict[str, str] = {}

    group_hints = ["按", "每个", "各", "根据", "依据", "对比", "比较", "分"]

    for col in categorical_cols:
        col_lower = col.lower()
        if col in text or col_lower in text_lower:
            matched.append(col)
            match_reasons[col] = "列名直接出现在查询中"
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
                matched_aliases = [a for a in aliases if a in text]
                if key in col_lower and matched_aliases:
                    matched.append(col)
                    match_reasons[col] = f"别名匹配: {matched_aliases} -> 列 {col}"
                    break

    hint_triggered = False
    if any(h in text for h in ["三个区域", "各区域", "各个地区", "每个地区"]):
        for col in categorical_cols:
            if "region" in col.lower() or "地区" in col or "区域" in col:
                if col not in matched:
                    matched.append(col)
                    match_reasons[col] = "区域提示词触发"
                    hint_triggered = True
                break

    if any(h in text for h in ["产品", "商品"]):
        for col in categorical_cols:
            if "product" in col.lower() or "产品" in col:
                if col not in matched:
                    matched.append(col)
                    match_reasons[col] = "产品提示词触发"
                    hint_triggered = True
                break

    if not matched:
        logger.warning(
            "分组列未匹配到关键词",
            query=text,
            available_categorical=categorical_cols,
            hint_triggered=hint_triggered,
        )

    logger.info(
        "分组列提取结果",
        query=text,
        matched_columns=matched,
        reasons=match_reasons,
        available_categorical=categorical_cols,
    )
    return matched, match_reasons


def _extract_time_column(text: str, datetime_cols: List[str]) -> Tuple[Optional[str], List[str]]:
    if not datetime_cols:
        logger.info(
            "无时间列可用，跳过时间列提取",
            query=text,
        )
        return None, []
    keywords = ["时间", "日期", "月", "趋势", "走势", "每周", "每月", "每天", "年度", "季度"]
    matched = [kw for kw in keywords if kw in text]
    if matched:
        logger.info(
            "时间列匹配成功",
            query=text,
            time_column=datetime_cols[0],
            matched_keywords=matched,
        )
        return datetime_cols[0], matched
    logger.info(
        "未检测到时间查询关键词，跳过时间列",
        query=text,
        available_datetime=datetime_cols,
    )
    return None, []


def parse_intent_keyword(
    query: str,
    column_names: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
    datetime_cols: List[str],
    categorical_values: Dict[str, List[str]],
) -> ParsedIntent:
    logger.info(
        "开始关键词意图解析",
        query=query,
        available_columns=column_names,
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
        datetime_cols=datetime_cols,
    )

    chart_type, _ = _detect_chart_type(query)
    aggregation, _ = _detect_aggregation(query)
    time_granularity, _ = _detect_time_granularity(query)
    value_cols, _ = _extract_value_columns(query, column_names, numeric_cols)
    group_by, _ = _extract_group_by(query, column_names, categorical_cols)
    time_col, _ = _extract_time_column(query, datetime_cols)
    filters, _ = _extract_filters(query, column_names, categorical_values)

    if chart_type == "timeseries" and not time_col and datetime_cols:
        time_col = datetime_cols[0]
        logger.info(
            "timeseries 图表自动补全时间列",
            query=query,
            time_column=time_col,
        )

    if chart_type == "pie" and not group_by and categorical_cols:
        group_by = [categorical_cols[0]]
        logger.info(
            "pie 图表自动补全分组列",
            query=query,
            group_by=group_by,
        )

    if chart_type == "bar" and not group_by and categorical_cols:
        group_by = categorical_cols[:1]
        logger.info(
            "bar 图表自动补全分组列",
            query=query,
            group_by=group_by,
        )

    title = query.strip()

    result = ParsedIntent(
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

    logger.info(
        "关键词意图解析完成",
        query=query,
        result=result.model_dump(),
    )
    return result


def _call_llm(prompt: str) -> Optional[str]:
    configured, _, _ = get_llm_config_status()
    if not configured:
        logger.info("LLM 未配置，跳过 LLM 调用")
        return None

    logger.info("开始 LLM 调用", prompt_length=len(prompt))
    try:
        import urllib.request
        import ssl
        import time as _time

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
        start = _time.time()
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            duration_ms = round((_time.time() - start) * 1000, 2)
            body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            logger.info(
                "LLM 调用成功",
                model=model,
                duration_ms=duration_ms,
                response_length=len(content),
            )
            return content
    except Exception as e:
        logger.warning(
            "LLM 调用失败",
            exc_info=e,
            error_type=type(e).__name__,
            error_message=str(e),
        )
        return None


def parse_intent_llm(
    query: str,
    column_names: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
    datetime_cols: List[str],
    categorical_values: Dict[str, List[str]],
) -> Optional[ParsedIntent]:
    configured, provider, model = get_llm_config_status()
    if not configured:
        logger.info("LLM 未配置，使用关键词解析")
        return None

    logger.info(
        "开始 LLM 意图解析",
        query=query,
        provider=provider,
        model=model,
    )

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
        logger.warning(
            "LLM 返回空结果，回退到关键词解析",
            query=query,
        )
        return None

    logger.debug(
        "LLM 原始响应",
        query=query,
        raw_response=raw,
    )

    try:
        data = json.loads(raw)
        value_columns_valid = [c for c in data.get("value_columns", []) if c in numeric_cols]
        group_by_valid = [c for c in data.get("group_by", []) if c in categorical_cols or c in datetime_cols]
        time_column_valid = data.get("time_column") if data.get("time_column") in datetime_cols else None
        filters_valid = [
            IntentFilter(
                column=f["column"],
                operator=f.get("operator", "in"),
                values=f.get("values", []),
            )
            for f in data.get("filters", [])
            if f.get("column") in column_names
        ]

        invalid_value_cols = [c for c in data.get("value_columns", []) if c not in numeric_cols]
        invalid_group_by = [c for c in data.get("group_by", []) if c not in categorical_cols and c not in datetime_cols]
        invalid_filters = [f for f in data.get("filters", []) if f.get("column") not in column_names]

        if invalid_value_cols or invalid_group_by or invalid_filters:
            logger.warning(
                "LLM 响应存在无效字段已被过滤",
                query=query,
                invalid_value_columns=invalid_value_cols,
                invalid_group_by=invalid_group_by,
                invalid_filters=invalid_filters,
            )

        intent = ParsedIntent(
            chart_type=data.get("chart_type", "bar"),
            value_columns=value_columns_valid,
            group_by=group_by_valid,
            time_column=time_column_valid,
            filters=filters_valid,
            aggregation=data.get("aggregation", "sum"),
            time_granularity=data.get("time_granularity"),
            title=data.get("title", query.strip()),
            parser_source="llm",
        )
        if not intent.value_columns and numeric_cols:
            intent.value_columns = [numeric_cols[0]]
            logger.warning(
                "LLM 未返回有效数值列，使用第一个数值列回退",
                query=query,
                fallback=numeric_cols[0],
            )

        logger.info(
            "LLM 意图解析完成",
            query=query,
            result=intent.model_dump(),
        )
        return intent
    except Exception as e:
        logger.warning(
            "LLM 响应解析失败，回退到关键词解析",
            exc_info=e,
            query=query,
            raw_response=raw,
            error_type=type(e).__name__,
            error_message=str(e),
        )
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
        logger.info(
            "意图解析完成，使用 LLM 结果",
            query=query,
            parser_source="llm",
        )
        return llm_result
    logger.info(
        "意图解析完成，使用关键词匹配结果",
        query=query,
        parser_source="keyword",
    )
    return parse_intent_keyword(
        query, column_names, numeric_cols, categorical_cols, datetime_cols, categorical_values
    )
