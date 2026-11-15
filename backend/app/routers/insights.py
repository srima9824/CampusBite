from datetime import UTC, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import require_roles
from app.docs import NOT_LOGGED_IN, described
from app.errors import api_error
from app.models import Role, User
from app.schemas.insights import InsightRequest, InsightResponse
from app.services import insights as service
from app.services.rate_limit import SlidingWindowLimiter

router = APIRouter(prefix="/insights", tags=["insights"])

DbSession = Annotated[Session, Depends(get_db)]
Customer = Annotated[User, Depends(require_roles(Role.CUSTOMER))]

_limiter: SlidingWindowLimiter | None = None


def get_limiter() -> SlidingWindowLimiter:
    global _limiter
    limit = get_settings().ai_questions_per_minute
    if _limiter is None or _limiter.limit != limit:
        _limiter = SlidingWindowLimiter(limit)
    return _limiter


def get_chat_client(settings: Annotated[Settings, Depends(get_settings)]) -> service.ChatClient:
    try:
        return service.build_client(settings)
    except service.AiNotConfigured:
        raise api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ai_not_configured",
            "AI insights are not set up on this server yet.",
        ) from None


@router.post(
    "",
    summary="Ask about my orders",
    description=(
        "Answers a question about the logged-in customer's own order history using OpenAI, for "
        "example `How much did I spend this week?`, `Which of my orders are still not delivered?`, "
        "`Which food items have I ordered most frequently?` or `Summarize my last five orders.` "
        "The server looks up the customer's last 50 orders itself and sends only dish names, "
        "restaurant, status, date, totals and payment status to the model: never addresses, "
        "notes, emails or other customers' data. A customer can ask 5 questions per minute."
    ),
    responses=described(
        {
            401: NOT_LOGGED_IN,
            403: "Only customers can use this route.",
            422: "The question must have 3 to 300 characters.",
            429: "Too many questions (`too_many_questions`) or OpenAI is busy (`ai_rate_limited`). "
            "Try again after the `Retry-After` seconds.",
            502: "OpenAI could not answer right now (`ai_unavailable`).",
            503: "AI insights are not configured on this server (`ai_not_configured`).",
        }
    ),
)
def ask_about_orders(
    data: InsightRequest,
    customer: Customer,
    db: DbSession,
    client: Annotated[service.ChatClient, Depends(get_chat_client)],
    limiter: Annotated[SlidingWindowLimiter, Depends(get_limiter)],
) -> InsightResponse:
    wait = limiter.retry_after(customer.id)
    if wait:
        raise api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too_many_questions",
            "You are asking too fast. Please wait a moment.",
            {"Retry-After": str(wait)},
        )
    orders = service.load_history(db, customer)
    zone = ZoneInfo(get_settings().app_timezone)
    now_text = datetime.now(UTC).astimezone(zone).strftime("%A %Y-%m-%d %H:%M ") + str(zone)
    prompt = service.build_prompt(orders, data.question, now_text, zone)
    try:
        answer = service.answer_question(client, prompt)
    except service.AiRateLimited:
        raise api_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "ai_rate_limited",
            "The AI service is busy. Please try again in a little while.",
            {"Retry-After": "30"},
        ) from None
    except service.AiUnavailable:
        raise api_error(
            status.HTTP_502_BAD_GATEWAY,
            "ai_unavailable",
            "The AI service could not answer right now. Please try again later.",
        ) from None
    return InsightResponse(answer=answer, orders_considered=len(orders))
