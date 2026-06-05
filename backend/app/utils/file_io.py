from __future__ import annotations
import io
import os
import tempfile
from typing import Optional
import pandas as pd


ALLOWED_EXT = {".csv", ".xlsx", ".xls"}


def read_file_to_df(file_bytes: bytes, filename: str) -> Optional[pd.DataFrame]:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"不支持的文件类型: {ext}，仅支持 CSV、XLSX、XLS")

    buf = io.BytesIO(file_bytes)
    if ext == ".csv":
        encodings = ["utf-8", "utf-8-sig", "gbk", "latin-1"]
        last_err = None
        for enc in encodings:
            try:
                buf.seek(0)
                return pd.read_csv(buf, encoding=enc)
            except Exception as e:
                last_err = e
                continue
        raise last_err or ValueError("CSV 解析失败")
    else:
        return pd.read_excel(buf, engine="openpyxl")


def save_temp(file_bytes: bytes, filename: str) -> str:
    os.makedirs(tempfile.gettempdir(), exist_ok=True)
    ext = os.path.splitext(filename)[1]
    fd, path = tempfile.mkstemp(suffix=ext)
    with os.fdopen(fd, "wb") as f:
        f.write(file_bytes)
    return path
