"""Combined YouTube and Maps usage endpoint."""

from fastapi import APIRouter

from app.maps.usage import MapsUsageTracker
from app.youtube.quota import QuotaTracker


def create_usage_router(
    youtube: QuotaTracker, maps: MapsUsageTracker
) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["usage"])

    @router.get("/usage")
    async def usage() -> dict[str, object]:
        return {"youtube": await youtube.status(), "maps": await maps.status()}

    return router
