from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import uuid
import json
import os
import tempfile
from typing import Optional

from ..utils.file_io import read_file_to_df
from ..analyzer.comparator import DataComparator
from ..models.schemas import CompareResult

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
    if not file_a.filename or not file_b.filename:
        raise HTTPException(400, "缺少文件名")

    try:
        content_a = await file_a.read()
        content_b = await file_b.read()

        if len(content_a) > 50 * 1024 * 1024 or len(content_b) > 50 * 1024 * 1024:
            raise HTTPException(400, "文件过大，请上传小于 50MB 的文件")

        df_a = read_file_to_df(content_a, file_a.filename)
        df_b = read_file_to_df(content_b, file_b.filename)

        if df_a is None or df_a.empty:
            raise HTTPException(400, f"无法读取文件 A ({file_a.filename}) 或文件为空")
        if df_b is None or df_b.empty:
            raise HTTPException(400, f"无法读取文件 B ({file_b.filename}) 或文件为空")

        comparator = DataComparator()
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

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"对比分析失败: {str(e)}")


@router.get("/compare/{compare_id}")
async def get_compare_result(compare_id: str):
    if compare_id in _compare_cache:
        return _compare_cache[compare_id].model_dump()
    cache_path = os.path.join(tempfile.gettempdir(), "datainsight_cache", f"compare_{compare_id}.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(404, "对比任务不存在或已过期")
