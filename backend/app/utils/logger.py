from __future__ import annotations
import logging
import json
import sys
import os
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _format_timestamp(t: float) -> str:
    return datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": _format_timestamp(record.created),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in getattr(record, "extra_fields", {}).items():
            log_obj[key] = value
        if record.exc_info:
            log_obj["error"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stack": traceback.format_exception(*record.exc_info),
            }
        return json.dumps(log_obj, ensure_ascii=False, default=str)


class ConsoleFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        ts = _format_timestamp(record.created)
        msg = f"{color}[{record.levelname}]{self.RESET} {ts} [{record.name}] {record.getMessage()}"
        extras = getattr(record, "extra_fields", {})
        if extras:
            try:
                msg += " " + json.dumps(extras, ensure_ascii=False, default=str)
            except Exception:
                msg += f" {extras}"
        if record.exc_info:
            msg += "\n" + "".join(traceback.format_exception(*record.exc_info))
        return msg


_loggers_initialized = False


def setup_logging(log_dir: str = "logs", log_level: str = "INFO") -> None:
    global _loggers_initialized
    if _loggers_initialized:
        return

    os.makedirs(log_dir, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.handlers.clear()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ConsoleFormatter())
    root_logger.addHandler(console_handler)

    app_log_file = os.path.join(log_dir, "app.log")
    file_handler = logging.FileHandler(app_log_file, encoding="utf-8")
    file_handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(file_handler)

    error_log_file = os.path.join(log_dir, "error.log")
    error_file_handler = logging.FileHandler(error_log_file, encoding="utf-8")
    error_file_handler.setFormatter(StructuredFormatter())
    error_file_handler.setLevel(logging.WARNING)
    root_logger.addHandler(error_file_handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)

    _loggers_initialized = True


def get_logger(name: str) -> "AppLogger":
    return AppLogger(name)


class AppLogger:
    def __init__(self, name: str):
        self._logger = logging.getLogger(name)

    def _with_extras(self, **kwargs: Any) -> Dict[str, Any]:
        return {"extra_fields": kwargs}

    def debug(self, msg: str, **kwargs: Any) -> None:
        self._logger.debug(msg, extra=self._with_extras(**kwargs))

    def info(self, msg: str, **kwargs: Any) -> None:
        self._logger.info(msg, extra=self._with_extras(**kwargs))

    def warning(self, msg: str, **kwargs: Any) -> None:
        self._logger.warning(msg, extra=self._with_extras(**kwargs))

    def warn(self, msg: str, **kwargs: Any) -> None:
        self.warning(msg, **kwargs)

    def error(self, msg: str, exc_info: Optional[BaseException] = None, **kwargs: Any) -> None:
        if exc_info is not None:
            self._logger.error(msg, exc_info=(type(exc_info), exc_info, exc_info.__traceback__), extra=self._with_extras(**kwargs))
        else:
            self._logger.error(msg, exc_info=True, extra=self._with_extras(**kwargs))

    def exception(self, msg: str, **kwargs: Any) -> None:
        self._logger.error(msg, exc_info=True, extra=self._with_extras(**kwargs))

    def critical(self, msg: str, **kwargs: Any) -> None:
        self._logger.critical(msg, exc_info=True, extra=self._with_extras(**kwargs))


class StepTimer:
    def __init__(self, logger: AppLogger, step_name: str, **extra: Any):
        self.logger = logger
        self.step_name = step_name
        self.extra = extra
        self.start_time: float = 0.0

    def __enter__(self) -> "StepTimer":
        self.start_time = time.time()
        self.logger.info(f"[{self.step_name}] 开始", step=self.step_name, event="start", **self.extra)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        elapsed_ms = round((time.time() - self.start_time) * 1000, 2)
        if exc_val is not None:
            self.logger.error(
                f"[{self.step_name}] 失败",
                step=self.step_name,
                event="error",
                duration_ms=elapsed_ms,
                error_type=exc_type.__name__ if exc_type else None,
                error_message=str(exc_val) if exc_val else None,
                **self.extra,
            )
            return False
        self.logger.info(
            f"[{self.step_name}] 完成",
            step=self.step_name,
            event="end",
            duration_ms=elapsed_ms,
            **self.extra,
        )
        return False
