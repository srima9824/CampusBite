from threading import Thread

import pytest

from app.services.rate_limit import WINDOW_SECONDS, SlidingWindowLimiter


class Clock:
    def __init__(self, now: float = 1000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def test_exactly_limit_hits_are_allowed():
    limiter = SlidingWindowLimiter(3, Clock())

    results = [limiter.retry_after(1) for _ in range(4)]

    assert results[:3] == [0, 0, 0]
    assert results[3] > 0


@pytest.mark.parametrize(
    ("elapsed", "expected"),
    [(0, 61), (10, 51), (30, 31), (59, 2), (59.5, 1)],
)
def test_retry_after_counts_down(elapsed, expected):
    clock = Clock()
    limiter = SlidingWindowLimiter(1, clock)
    limiter.retry_after(1)
    clock.now += elapsed

    assert limiter.retry_after(1) == expected


def test_retry_after_is_at_least_one_second():
    clock = Clock()
    limiter = SlidingWindowLimiter(1, clock)
    limiter.retry_after(1)
    clock.now += WINDOW_SECONDS - 0.001

    assert limiter.retry_after(1) >= 1


def test_hits_expire_after_the_window():
    clock = Clock()
    limiter = SlidingWindowLimiter(2, clock)
    limiter.retry_after(1)
    limiter.retry_after(1)
    assert limiter.retry_after(1) > 0

    clock.now += WINDOW_SECONDS

    assert limiter.retry_after(1) == 0


def test_window_slides_one_hit_at_a_time():
    clock = Clock()
    limiter = SlidingWindowLimiter(2, clock)
    limiter.retry_after(1)
    clock.now += 30
    limiter.retry_after(1)
    clock.now += 31  # first hit is 61s old, second is 31s old

    assert limiter.retry_after(1) == 0
    assert limiter.retry_after(1) > 0


def test_blocked_attempts_are_not_recorded():
    clock = Clock()
    limiter = SlidingWindowLimiter(1, clock)
    limiter.retry_after(1)
    for _ in range(5):
        clock.now += 10
        assert limiter.retry_after(1) > 0
    clock.now += 10  # 60s after the only recorded hit

    assert limiter.retry_after(1) == 0


def test_keys_are_isolated():
    limiter = SlidingWindowLimiter(1, Clock())
    limiter.retry_after(1)

    assert limiter.retry_after(1) > 0
    assert limiter.retry_after(2) == 0


def test_concurrent_hits_never_exceed_the_limit():
    limiter = SlidingWindowLimiter(10, Clock())
    results: list[int] = []

    def hammer() -> None:
        for _ in range(20):
            results.append(limiter.retry_after(7))

    threads = [Thread(target=hammer) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(results) == 160
    assert results.count(0) == 10

