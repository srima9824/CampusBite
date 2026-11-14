from fastapi import HTTPException, status


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
