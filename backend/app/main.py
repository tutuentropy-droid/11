from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.upload import router as upload_router
from .api.export import router as export_router

app = FastAPI(
    title="数据洞察指挥舱 API",
    description="自动分析 CSV/Excel 数据并生成 3D 可视化洞察",
    version="1.0.0",
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
