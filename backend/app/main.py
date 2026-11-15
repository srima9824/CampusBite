import logging
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.docs import TAGS_METADATA
from app.middleware import add_request_middleware
from app.routers import auth, orders, owner_menu, owner_orders, restaurants


def create_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO)
    app = FastAPI(
        title="CampusBite API",
        description=(
            "Restaurant ordering and delivery for campus. Customers browse and order, "
            "restaurant owners manage menus and orders, and delivery partners handle deliveries. "
            "Log in with POST /auth/login, then use the Authorize button with the returned token "
            "(paste the token only, without the word Bearer)."
        ),
        openapi_tags=TAGS_METADATA,
    )
    add_request_middleware(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time"],
    )

    app.include_router(auth.router)
    app.include_router(restaurants.router)
    app.include_router(owner_menu.router)
    app.include_router(orders.router)
    app.include_router(owner_orders.router)

    @app.get(
        "/health",
        tags=["system"],
        summary="Check the service",
        description=(
            "Returns `ok` when the API is running. `database` is `up` when the database answered "
            "a test query and `down` when it did not. Use it to check a fresh setup."
        ),
    )
    def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return {"status": "ok", "database": "down"}
        return {"status": "ok", "database": "up"}

    return app


app = create_app()
