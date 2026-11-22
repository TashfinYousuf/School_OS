# backend/app/core/ai_client.py
import os
import logging
from typing import Optional, Any
from dotenv import load_dotenv, find_dotenv

logger = logging.getLogger("educationos.ai")

load_dotenv(find_dotenv(), override=True)

_cached_client: Optional[Any] = None
_client_initialized: bool = False


def get_genai_client() -> Optional[Any]:
    """
    Lazily and safely initializes the Google GenAI client.
    Never fails during module import; handles missing/invalid credentials gracefully.
    """
    global _cached_client, _client_initialized
    if _client_initialized:
        return _cached_client

    try:
        from app.core.config import settings
        raw = (
            getattr(settings, "GEMINI_API_KEY", None) or
            getattr(settings, "GOOGLE_API_KEY", None) or
            os.getenv("GEMINI_API_KEY") or
            os.getenv("GOOGLE_API_KEY") or
            ""
        )
        clean_key = str(raw).strip().strip('"').strip("'") if raw else ""
        if clean_key and len(clean_key) >= 10:
            from google import genai
            _cached_client = genai.Client(api_key=clean_key)
            logger.info("Gemini AI client initialized successfully.")
        else:
            logger.warning("No valid GEMINI_API_KEY found — AI features will operate in fallback/disabled mode.")
            _cached_client = None
    except Exception as exc:
        logger.warning(f"Could not initialize GenAI client: {exc}")
        _cached_client = None

    _client_initialized = True
    return _cached_client


class _AIClientProxy:
    """
    Runtime proxy for Google GenAI Client.
    Prevents import-time crashes and defers client lookup to actual invocation.
    Compatible with unittest.mock.patch and standard attribute introspection.
    """
    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)

        client = get_genai_client()
        if client is None:
            raise AttributeError(
                f"Gemini AI features are unavailable: '{name}' cannot be accessed because "
                "a valid GEMINI_API_KEY is not configured."
            )
        return getattr(client, name)

    def __bool__(self) -> bool:
        return get_genai_client() is not None

    def __repr__(self) -> str:
        client = get_genai_client()
        return f"<AIClientProxy connected={client is not None}>"


ai_client = _AIClientProxy()
