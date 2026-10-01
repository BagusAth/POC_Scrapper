"""FastAPI router factories for the UMKM dashboard."""

from .routes_feed import create_feed_router
from .routes_health import create_health_router
from .routes_products import create_products_router
from .routes_stats import create_stats_router
from .routes_stream import create_stream_router
from .routes_summary import SummaryService, create_summary_router

__all__ = [
    "SummaryService",
    "create_feed_router",
    "create_health_router",
    "create_products_router",
    "create_stats_router",
    "create_stream_router",
    "create_summary_router",
]
