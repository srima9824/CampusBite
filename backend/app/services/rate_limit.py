import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

WINDOW_SECONDS = 60


class SlidingWindowLimiter:
    """Allows `limit` hits per key in any 60 second window. Kept in memory, per process."""

    def __init__(self, limit: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.clock = clock
        self.hits: dict[int, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def retry_after(self, key: int) -> int:
        """Records a hit and returns 0 when allowed, else the seconds to wait."""
        now = self.clock()
        with self.lock:
            window = self.hits[key]
            while window and now - window[0] >= WINDOW_SECONDS:
                window.popleft()
            if len(window) >= self.limit:
                return max(1, int(WINDOW_SECONDS - (now - window[0])) + 1)
            window.append(now)
            return 0
