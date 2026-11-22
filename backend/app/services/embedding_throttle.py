import logging
import random
import re
import time
from typing import Callable, List, Optional, Sequence

logger = logging.getLogger("educationos.embeddings")

_RETRYABLE = ("429", "rate limit", "ratelimit", "too many requests", "quota", "resource_exhausted",
              "unavailable", "503", "502", "500 ", "timeout", "timed out", "deadline", "overloaded",
              "connection reset", "connection aborted")
_HINT = re.compile(r"retry\w*\D{0,12}(\d+(?:\.\d+)?)\s*s", re.I)


class EmbeddingCancelled(Exception):
    pass


def _retryable(exc: Exception) -> bool:
    msg = f"{type(exc).__name__} {exc}".lower()
    return any(k in msg for k in _RETRYABLE)


def embed_in_batches(
    texts: Sequence[str],
    embed_fn: Callable[[List[str]], List[List[float]]],
    *,
    batch_size: int = 16,
    min_interval: float = 1.0,
    max_retries: int = 8,
    base_delay: float = 3.0,
    max_delay: float = 90.0,
    on_progress: Optional[Callable[[int, int], None]] = None,
    should_cancel: Optional[Callable[[], bool]] = None,
) -> List[List[float]]:
    out: List[List[float]] = []
    last_call = 0.0
    total = len(texts)
    for start in range(0, total, batch_size):
        if should_cancel and should_cancel():
            raise EmbeddingCancelled()
        batch = list(texts[start:start + batch_size])
        gap = min_interval - (time.monotonic() - last_call)
        if gap > 0:
            time.sleep(gap)
        attempt = 0
        while True:
            try:
                vectors = embed_fn(batch)
                if len(vectors) != len(batch):
                    raise ValueError(f"Embedding API returned {len(vectors)} vectors for {len(batch)} texts")
                break
            except Exception as exc:
                attempt += 1
                if attempt > max_retries or not _retryable(exc):
                    raise
                hint = _HINT.search(str(exc))
                delay = float(hint.group(1)) + 1 if hint else min(max_delay, base_delay * 2 ** (attempt - 1))
                delay = min(max_delay, delay) * (0.8 + 0.4 * random.random())
                logger.warning("embedding batch %s retry %s/%s in %.1fs: %s",
                               start // batch_size, attempt, max_retries, delay, str(exc)[:160])
                time.sleep(delay)
        last_call = time.monotonic()
        out.extend(vectors)
        if on_progress:
            on_progress(len(out), total)
    return out