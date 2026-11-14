import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

logger = logging.getLogger("campusbite.request")


async def log_request_timing(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    started = time.perf_counter()
    logger.info("%s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("%s %s failed", request.method, request.url.path)
        raise
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Process-Time"] = f"{elapsed_ms:.2f}"
    logger.info(
        "%s %s -> %s in %.2f ms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


def add_request_middleware(app: FastAPI) -> None:
    app.middleware("http")(log_request_timing)
