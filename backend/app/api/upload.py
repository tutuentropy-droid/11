from fastapi import APIRouter, UploadFile, File, HTTPException
import uuid
import json
import os
import tempfile

from ..utils.file_io import read_file_to_df
from ..analyzer.engine import AnalysisEngine
from ..models.schemas import AnalysisResult
from ..analyzer.cleaner import cache_dataframe
from ..utils import get_logger

logger = get_logger("api.upload")

router = APIRouter(prefix="/api", tags=["analysis"])

_cache: dict = {}


@router.post("/upload", response_model=AnalysisResult)
async def upload_and_analyze(file: UploadFile = File(...)):
    logger.info(
        "文件上传请求",
        filename=file.filename,
        content_type=file.content_type,
        event="upload_start",
    )
    if not file.filename:
        logger.warning("上传失败: 缺少文件名", event="upload_error")
        raise HTTPException(400, "缺少文件名")
    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            logger.warning(
                "上传失败: 文件过大",
                filename=file.filename,
                size_bytes=len(content),
                max_size_bytes=50 * 1024 * 1024,
                event="upload_error",
            )
            raise HTTPException(400, "文件过大，请上传小于 50MB 的文件")
        df = read_file_to_df(content, file.filename)
        if df is None or df.empty:
            logger.warning(
                "上传失败: 无法读取文件内容",
                filename=file.filename,
                event="upload_error",
            )
            raise HTTPException(400, "无法读取文件内容或文件为空")

        logger.info(
            "文件解析成功，开始分析",
            filename=file.filename,
            rows=int(df.shape[0]),
            cols=int(df.shape[1]),
            size_kb=round(len(content) / 1024, 2),
            event="file_parsed",
        )

        engine = AnalysisEngine()
        result = engine.analyze(df, filename=file.filename)
        task_id = str(uuid.uuid4())[:8]
        result.task_id = task_id
        _cache[task_id] = result
        cache_dataframe(task_id, df)

        cache_dir = os.path.join(tempfile.gettempdir(), "datainsight_cache")
        os.makedirs(cache_dir, exist_ok=True)
        with open(os.path.join(cache_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
            json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, default=str)

        logger.info(
            "分析完成",
            task_id=task_id,
            filename=file.filename,
            event="upload_success",
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "分析失败",
            exc_info=e,
            filename=file.filename,
            error_type=type(e).__name__,
            error_message=str(e),
            event="upload_error",
        )
        raise HTTPException(500, f"分析失败: {str(e)}")


@router.get("/result/{task_id}")
async def get_result(task_id: str):
    logger.info(
        "查询分析结果",
        task_id=task_id,
        event="result_query",
    )
    if task_id in _cache:
        logger.info(
            "分析结果命中内存缓存",
            task_id=task_id,
            event="result_cache_hit",
        )
        return _cache[task_id].model_dump()
    cache_path = os.path.join(tempfile.gettempdir(), "datainsight_cache", f"{task_id}.json")
    if os.path.exists(cache_path):
        logger.info(
            "分析结果命中磁盘缓存",
            task_id=task_id,
            event="result_disk_hit",
        )
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
    logger.warning(
        "任务不存在或已过期",
        task_id=task_id,
        event="result_not_found",
    )
    raise HTTPException(404, "任务不存在或已过期")
