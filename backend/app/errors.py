import logging

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, SQLAlchemyError

logger = logging.getLogger("campusbite.errors")


def api_error(
    status_code: int, code: str, message: str, headers: dict[str, str] | None = None
) -> HTTPException:
    return HTTPException(status_code, detail={"code": code, "message": message}, headers=headers)


def not_authenticated() -> HTTPException:
    return api_error(
        status.HTTP_401_UNAUTHORIZED,
        "not_authenticated",
        "Log in to continue.",
        {"WWW-Authenticate": "Bearer"},
    )


def unexpected_error() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": {"code": "server_error", "message": "Something went wrong."}},
    )


def invalid_input_error() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": {"code": "invalid_input", "message": "Some of the input is not valid."}},
    )


def database_input_handler(_: Request, error: SQLAlchemyError) -> JSONResponse:
    """Numbers the database cannot hold (out of range) are the caller's mistake, not ours."""
    if isinstance(error, DataError):
        logger.warning("Rejected input the database cannot store: %s", type(error).__name__)
        return invalid_input_error()
    logger.exception("Unexpected database error")
    return unexpected_error()
