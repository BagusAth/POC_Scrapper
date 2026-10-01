"""Application health API."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter

from app.config import Settings


def _state_from(worker: Any | None) -> dict[str, Any]:
    if worker is None:
        return {}
    state = getattr(worker, "state", worker)
    if callable(state):
        state = state()
    if hasattr(state, "model_dump"):
        state = state.model_dump(mode="json")
    return dict(state) if isinstance(state, dict) else {}


def create_health_router(
    settings: Settings,
    worker: Any | None = None,
    sources_provider: Callable[[], list[str]] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["system"])

    @router.get("/health")
    async def health() -> dict[str, object]:
        sources = sources_provider() if sources_provider else settings.active_sources
        analyzer = _state_from(worker) or {
            "ai_mode": settings.ai_mode,
            "active_analyzer": settings.ai_mode,
            "gemini_healthy": settings.ai_mode != "gemini" or bool(settings.gemini_api_key),
            "cooldown_until": None,
            "last_error": None,
            "pending_count": 0,
        }
        return {
            "status": "ok",
            "sources_active": sources,
            "youtube_configured": bool(settings.youtube_api_key),
            "youtube_mode": "api" if settings.youtube_api_key else "public",
            "maps_configured": bool(settings.google_maps_api_key),
            "yt_comments_enabled": settings.yt_comments_enabled,
            "demo_mode": settings.demo_mode,
            "analyzer": analyzer,
            "source_messages": {
                "youtube": (
                    "YouTube Data API aktif"
                    if settings.youtube_api_key
                    else "Mode publik YouTube aktif; tambahkan API key untuk kuota resmi"
                ),
                "maps": (
                    "Google Maps aktif"
                    if settings.google_maps_api_key
                    else "Google Maps belum dikonfigurasi"
                ),
            },
        }

    return router
