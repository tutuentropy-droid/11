from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import uuid
import json
import os
import tempfile
from typing import Optional

from ..utils.file_io import read_file_to_df
from ..analyzer.comparator import DataComparator
from ..models.schemas import CompareResult
from ..utils import get_logger, StepTimer

logger = get_logger("api.compare")

router = APIRouter(prefix="/api", tags=["compare"])

_compare_cache: dict = {}


@router.post("/compare", response_model=CompareResult)
async def compare_datasets(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    label_a: Optional[str] = Form(None),
    label_b: Optional[str] = Form(None),
    align_strategy: str = Form("auto"),
    align_field: Optional[str] = Form(None),
):
    logger.info(
        "双文件对比请求",
        file_a=file_a.filename,
        file_b=file_b.filename,
        label_a=label_a,
        label_b=label_b,
        align_strategy=align_strategy,
        align_field=align_field,
        event="compare_start",
    )
    if not file_a.filename or not file_b.filename:
        logger.warning("对比失败: 缺少文件名", event="compare_error")
        raise HTTPException(400, "缺少文件名")

    try:
        content_a = await file_a.read()
        content_b = await file_b.read()

        if len(content_a) > 50 * 1024 * 1024 or len(content_b) > 50 * 1024 * 1024:
            logger.warning(
                "对比失败: 文件过大",
                file_a=file_a.filename,
                file_b=file_b.filename,
                size_a=len(content_a),
                size_b=len(content_b),
                event="compare_error",
            )
            raise HTTPException(400, "文件过大，请上传小于 50MB 的文件")

        with StepTimer(logger, "文件 A 解析", file=file_a.filename):
            df_a = read_file_to_df(content_a, file_a.filename)
        with StepTimer(logger, "文件 B 解析", file=file_b.filename):
            df_b = read_file_to_df(content_b, file_b.filename)

        if df_a is None or df_a.empty:
            logger.warning(
                "对比失败: 无法读取文件 A",
                file_a=file_a.filename,
                event="compare_error",
            )
            raise HTTPException(400, f"无法读取文件 A ({file_a.filename}) 或文件为空")
        if df_b is None or df_b.empty:
            logger.warning(
                "对比失败: 无法读取文件 B",
                file_b=file_b.filename,
                event="compare_error",
            )
            raise HTTPException(400, f"无法读取文件 B ({file_b.filename}) 或文件为空")

        logger.info(
            "文件解析完成，开始对比分析",
            file_a=file_a.filename,
            file_b=file_b.filename,
            rows_a=int(df_a.shape[0]),
            rows_b=int(df_b.shape[0]),
            cols_a=int(df_a.shape[1]),
            cols_b=int(df_b.shape[1]),
        )

        comparator = DataComparator()
        with StepTimer(
            logger, "对比分析", file_a=file_a.filename, file_b=file_b.filename):
            result = comparator.compare(
                df_a, df_b,
                filename_a=file_a.filename,
                filename_b=file_b.filename,
                label_a=label_a,
                label_b=label_b,
                align_strategy=align_strategy,
                align_field=align_field,
            )

        compare_id = str(uuid.uuid4())[:8]
        result.compare_id = compare_id
        _compare_cache[compare_id] = result

        cache_dir = os.path.join(tempfile.gettempdir(), "datainsight_cache")
        os.makedirs(cache_dir, exist_ok=True)
        with open(os.path.join(cache_dir, f"compare_{compare_id}.json"), "w", encoding="utf-8") as f:
            json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, default=str)

        logger.info(
            "对比分析完成",
            compare_id=compare_id,
            file_a=file_a.filename,
            file_b=file_b.filename,
            event="compare_success",
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "对比分析失败",
            exc_info=e,
            file_a=file_a.filename,
            file_b=file_b.filename,
            error_type=type(e).__name__,
            error_message=str(e),
            event="compare_error",
        )
        raise HTTPException(500, f"对比分析失败: {str(e)}")


@router.get("/compare/{compare_id}")
async def get_compare_result(compare_id: str):
    logger.info(
        "查询对比结果",
        compare_id=compare_id,
        event="compare_result_query",
    )
    if compare_id in _compare_cache:
        logger.info(
            "对比结果命中内存缓存",
            compare_id=compare_id,
            event="compare_cache_hit",
        )
        return _compare_cache[compare_id].model_dump()
    cache_path = os.path.join(tempfile.gettempdir(), "datainsight_cache", f"compare_{compare_id}.json")
    if os.path.exists(cache_path):
        logger.info(
            "对比结果命中磁盘缓存",
            compare_id=compare_id,
            event="compare_disk_hit",
        )
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
    logger.warning(
        "对比任务不存在或已过期",
        compare_id=compare_id,
        event="compare_result_not_found",
    )
    raise HTTPException(404, "对比任务不存在或已过期")
