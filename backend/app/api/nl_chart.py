from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from ..analyzer.cleaner import get_cached_dataframe
from ..analyzer.nl_intent import (
    parse_intent,
    set_llm_config,
    get_llm_config_status,
)
from ..analyzer.chart_generator import generate_chart_data
from ..analyzer.column_types import classify_all_columns
from ..models.schemas import (
    NLChartRequest,
    NLChartResponse,
    LLMConfigRequest,
    LLMConfigStatus,
)
from ..utils import get_logger, StepTimer

logger = get_logger("api.nl_chart")

router = APIRouter(prefix="/api", tags=["nl-chart"])


@router.post("/nl-chart", response_model=NLChartResponse)
async def nl_chart_query(req: NLChartRequest):
    logger.info(
        "自然语言出图请求",
        task_id=req.task_id,
        query=req.query,
        event="nl_query_start",
    )
    try:
        df = get_cached_dataframe(req.task_id)
        if df is None:
            logger.warning(
                "任务不存在或已过期",
                task_id=req.task_id,
                event="nl_query_error",
            )
            return NLChartResponse(
                success=False,
                error=f"任务 {req.task_id} 不存在或已过期，请重新上传数据",
                message="任务不存在",
            )

        query = req.query.strip()
        if not query:
            logger.warning(
                "查询内容为空",
                task_id=req.task_id,
                event="nl_query_error",
            )
            return NLChartResponse(
                success=False,
                error="查询内容不能为空",
                message="请输入查询内容",
            )

        with StepTimer(logger, "列类型识别", task_id=req.task_id, query=query):
            col_types = classify_all_columns(df)
        numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
        categorical_cols = [c for c, t in col_types.items() if t in ("categorical", "boolean")]
        datetime_cols = [c for c, t in col_types.items() if t == "datetime"]
        column_names = list(df.columns)

        categorical_values: Dict[str, list] = {}
        for col in categorical_cols:
            try:
                vals = df[col].dropna().astype(str).unique().tolist()
                categorical_values[col] = vals[:50]
            except Exception:
                categorical_values[col] = []

        with StepTimer(logger, "意图解析", task_id=req.task_id, query=query):
            intent = parse_intent(
                query,
                column_names=column_names,
                numeric_cols=numeric_cols,
                categorical_cols=categorical_cols,
                datetime_cols=datetime_cols,
                categorical_values=categorical_values,
            )

        logger.info(
            "意图解析结果",
            task_id=req.task_id,
            query=query,
            parser_source=intent.parser_source,
            chart_type=intent.chart_type,
            value_columns=intent.value_columns,
            group_by=intent.group_by,
            time_column=intent.time_column,
            aggregation=intent.aggregation,
            time_granularity=intent.time_granularity,
            filters=[f.model_dump() for f in intent.filters],
            event="nl_intent_parsed",
        )

        with StepTimer(logger, "图表数据生成", task_id=req.task_id, query=query, chart_type=intent.chart_type):
            chart_data = generate_chart_data(df, intent)

        source_label = "大语言模型" if intent.parser_source == "llm" else "关键词匹配"
        logger.info(
            "自然语言出图完成",
            task_id=req.task_id,
            query=query,
            parser_source=intent.parser_source,
            chart_type=intent.chart_type,
            event="nl_query_success",
        )
        return NLChartResponse(
            success=True,
            intent=intent,
            chart_data=chart_data,
            message=f"已通过 {source_label} 解析意图，生成图表",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "生成图表失败",
            exc_info=e,
            task_id=req.task_id,
            query=req.query,
            error_type=type(e).__name__,
            error_message=str(e),
            event="nl_query_error",
        )
        return NLChartResponse(
            success=False,
            error=str(e),
            message="生成图表失败",
        )


@router.post("/nl-chart/config", response_model=LLMConfigStatus)
async def configure_llm(req: LLMConfigRequest):
    logger.info(
        "LLM 配置更新",
        provider=req.provider,
        has_api_key=bool(req.api_key),
        has_base_url=bool(req.base_url),
        model=req.model,
        event="llm_config_update",
    )
    try:
        if not req.api_key:
            return LLMConfigStatus(configured=False, provider="", model="")
        set_llm_config(
            provider=req.provider,
            api_key=req.api_key,
            base_url=req.base_url or "",
            model=req.model or "",
        )
        configured, provider, model = get_llm_config_status()
        logger.info(
            "LLM 配置已更新",
            configured=configured,
            provider=provider,
            model=model,
            event="llm_config_updated",
        )
        return LLMConfigStatus(configured=configured, provider=provider, model=model)
    except Exception as e:
        logger.error(
            "LLM 配置失败",
            exc_info=e,
            error_type=type(e).__name__,
            error_message=str(e),
            event="llm_config_error",
        )
        raise HTTPException(500, f"配置失败: {str(e)}")


@router.get("/nl-chart/config", response_model=LLMConfigStatus)
async def get_llm_status():
    configured, provider, model = get_llm_config_status()
    logger.info(
        "LLM 配置状态查询",
        configured=configured,
        provider=provider,
        model=model,
        event="llm_config_query",
    )
    return LLMConfigStatus(configured=configured, provider=provider, model=model)
