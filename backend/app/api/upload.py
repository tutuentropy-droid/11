from fastapi import APIRouter, UploadFile, File, HTTPException
import uuid
import json
import os
import tempfile

from ..utils.file_io import read_file_to_df
from ..analyzer.engine import AnalysisEngine
from ..models.schemas import AnalysisResult

router = APIRouter(prefix="/api", tags=["analysis"])

_cache: dict = {}


@router.post("/upload", response_model=AnalysisResult)
async def upload_and_analyze(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "缺少文件名")
    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(400, "文件过大，请上传小于 50MB 的文件")
        df = read_file_to_df(content, file.filename)
        if df is None or df.empty:
            raise HTTPException(400, "无法读取文件内容或文件为空")
        engine = AnalysisEngine()
        result = engine.analyze(df, filename=file.filename)
        task_id = str(uuid.uuid4())[:8]
        result.task_id = task_id
        _cache[task_id] = result

        cache_dir = os.path.join(tempfile.gettempdir(), "datainsight_cache")
        os.makedirs(cache_dir, exist_ok=True)
        with open(os.path.join(cache_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
            json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, default=str)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"分析失败: {str(e)}")


@router.get("/result/{task_id}")
async def get_result(task_id: str):
    if task_id in _cache:
        return _cache[task_id].model_dump()
    cache_path = os.path.join(tempfile.gettempdir(), "datainsight_cache", f"{task_id}.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(404, "任务不存在或已过期")
