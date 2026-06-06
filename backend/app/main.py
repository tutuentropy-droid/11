import time
import traceback
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool

from .api.upload import router as upload_router
from .api.export import router as export_router
from .api.compare import router as compare_router
from .api.cleaning import router as cleaning_router
from .api.nl_chart import router as nl_chart_router
from .utils import setup_logging, get_logger

setup_logging()
logger = get_logger("app.main")

app = FastAPI(
    title="数据洞察指挥舱 API",
    description="自动分析 CSV/Excel 数据并生成 3D 可视化洞察，支持自然语言查询生成图表",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:12]
        start_time = time.time()
        method = request.method
        path = request.url.path
        query_string = request.url.query
        client_ip = request.client.host if request.client else None

        logger.info(
            f"API 请求开始: {method} {path}",
            request_id=request_id,
            method=method,
            path=path,
            query_string=query_string or None,
            client_ip=client_ip,
            event="request_start",
        )

        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            status_code = response.status_code

            log_level = logger.info if status_code < 400 else (logger.warning if status_code < 500 else logger.error)
            log_level(
                f"API 请求完成: {method} {path} -> {status_code} ({duration_ms}ms)",
                request_id=request_id,
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
                event="request_end",
            )

            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"API 请求异常: {method} {path}",
                exc_info=e,
                request_id=request_id,
                method=method,
                path=path,
                duration_ms=duration_ms,
                error_type=type(e).__name__,
                error_message=str(e),
                event="request_error",
            )
            raise


app.add_middleware(LoggingMiddleware)

app.include_router(upload_router)
app.include_router(export_router)
app.include_router(compare_router)
app.include_router(cleaning_router)
app.include_router(nl_chart_router)


@app.get("/api/health")
async def health():
    logger.info("健康检查请求", event="health_check")
    return {"status": "ok", "version": "1.0.0"}
