from fastapi import APIRouter, HTTPException
import json
import os
import tempfile

from ..models.schemas import CleanRequest, CleanResult, AnalysisResult
from ..analyzer.cleaner import (
    get_cached_dataframe,
    cache_dataframe,
    apply_fix,
)
from ..analyzer.engine import AnalysisEngine
from ..analyzer.quality_scanner import scan_data_quality
from ..api.upload import _cache

router = APIRouter(prefix="/api", tags=["cleaning"])


def _persist_result(task_id: str, result: AnalysisResult) -> None:
    _cache[task_id] = result
    cache_dir = os.path.join(tempfile.gettempdir(), "datainsight_cache")
    os.makedirs(cache_dir, exist_ok=True)
    with open(os.path.join(cache_dir, f"{task_id}.json"), "w", encoding="utf-8") as f:
        json.dump(result.model_dump(mode="json"), f, ensure_ascii=False, default=str)


@router.post("/clean", response_model=CleanResult)
async def clean_data(request: CleanRequest):
    task_id = request.task_id
    df = get_cached_dataframe(task_id)
    if df is None:
        raise HTTPException(404, "任务不存在或已过期，请重新上传文件")

    current_result = _cache.get(task_id)
    if not current_result or not current_result.quality_report:
        raise HTTPException(400, "未找到数据质量报告")

    quality_before = current_result.quality_report.quality.model_copy(deep=True)

    issues = current_result.quality_report.issues
    fixed_issues: list = []
    fixed_count = 0

    indices_to_process: list = []
    if request.fix_all:
        indices_to_process = [i for i, iss in enumerate(issues) if not iss.fixed and iss.suggestion]
    elif request.issue_index is not None:
        if request.issue_index < 0 or request.issue_index >= len(issues):
            raise HTTPException(400, "问题索引超出范围")
        indices_to_process = [request.issue_index]
    else:
        raise HTTPException(400, "请指定 issue_index 或设置 fix_all=True")

    for idx in indices_to_process:
        issue = issues[idx]
        if issue.fixed:
            continue
        if not issue.suggestion:
            continue
        df, n_fixed, success = apply_fix(df, issue)
        if success:
            issue.fixed = True
            fixed_issues.append(idx)
            fixed_count += n_fixed

    engine = AnalysisEngine()
    filename = current_result.dataset.name
    updated_result = engine.analyze(df, filename=filename)
    updated_result.task_id = task_id

    cache_dataframe(task_id, df)
    _persist_result(task_id, updated_result)

    quality_after = updated_result.quality_report.quality if updated_result.quality_report else None

    return CleanResult(
        task_id=task_id,
        success=True,
        message=f"成功修正 {len(fixed_issues)} 类问题，共处理 {fixed_count} 个数据点",
        fixed_issues=fixed_issues,
        quality_before=quality_before,
        quality_after=quality_after,
        updated_analysis=updated_result,
    )
