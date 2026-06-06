from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.upload import router as upload_router
from .api.export import router as export_router
from .api.compare import router as compare_router
from .api.cleaning import router as cleaning_router
from .api.nl_chart import router as nl_chart_router

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

app.include_router(upload_router)
app.include_router(export_router)
app.include_router(compare_router)
app.include_router(cleaning_router)
app.include_router(nl_chart_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
