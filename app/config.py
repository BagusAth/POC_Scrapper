"""Application configuration loaded exclusively from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Window = Literal["1h", "24h", "7d", "30d", "90d", "all"]


class Settings(BaseSettings):
    """Runtime settings for the v3 trend and opinion architecture."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    sources: str = "youtube_trend,maps"
    replay_interval_seconds: float = 4.0

    youtube_api_key: str = ""
    youtube_daily_quota: int = 10_000
    yt_search_reserve_units: int = 6_000
    yt_trend_lookback_days: int = 90
    yt_search_date_pages: int = 2
    yt_search_refresh_hours: float = 6.0
    yt_max_videos_per_topic: int = 150
    yt_stats_interval_minutes: float = 60.0
    yt_comments_enabled: bool = False
    youtube_http_timeout_seconds: float = 10.0

    google_maps_api_key: str = ""
    google_maps_embed_key: str = ""
    maps_language: str = "id"
    maps_region: str = "ID"
    maps_max_pages: int = 2
    maps_refresh_hours: float = 8.0
    maps_daily_request_cap: int = 30
    maps_monthly_request_cap: int = 800
    maps_content_ttl_days: int = 7
    default_city: str = "Bandung"

    demo_mode: bool = False
    demo_stats_interval_seconds: float = 120.0
    demo_budget_units: int = 1_500
    max_active_topics: int = 5

    ai_mode: Literal["mock", "lexicon", "gemini"] = "mock"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_rpm: int = 8
    batch_size: int = 25
    batch_max_wait_seconds: float = 10.0
    max_gemini_failures: int = 3
    video_classifier: Literal["auto", "rules"] = "auto"
    summary_min_reviews: int = 10

    database_path: Path = Path("data/app.db")
    topics_path: Path = Path("config/topics.json")
    aspects_path: Path = Path("config/aspects.json")
    replay_reviews_path: Path = Path("data/replay_reviews.csv")
    max_comment_chars: int = 800
    default_window: Window = "90d"
    log_level: str = "INFO"

    # Compatibility-only settings retained while the v2 modules remain importable.
    products_path: Path = Path("config/products.json")
    inbox_path: Path = Path("data/inbox")
    seed_comments_path: Path = Path("data/seed_comments.csv")
    collect_interval_seconds: float = 90.0
    youtube_videos_per_product: int = 5
    youtube_search_refresh_minutes: int = 60
    comment_max_age_days: int = 180
    marketplace_ingest_token: str = ""

    @field_validator(
        "youtube_daily_quota", "yt_search_reserve_units", "yt_trend_lookback_days",
        "yt_search_date_pages", "yt_max_videos_per_topic", "maps_max_pages",
        "maps_daily_request_cap", "maps_monthly_request_cap", "maps_content_ttl_days",
        "demo_budget_units", "max_active_topics", "gemini_rpm", "batch_size",
        "max_gemini_failures", "summary_min_reviews", "max_comment_chars",
        "comment_max_age_days",
    )
    @classmethod
    def positive_integer(cls, value: int) -> int:
        if value < 1:
            raise ValueError("nilai harus lebih besar dari nol")
        return value

    @field_validator(
        "replay_interval_seconds", "yt_search_refresh_hours", "yt_stats_interval_minutes",
        "youtube_http_timeout_seconds", "maps_refresh_hours",
        "demo_stats_interval_seconds", "batch_max_wait_seconds",
        "collect_interval_seconds",
    )
    @classmethod
    def positive_interval(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("interval harus lebih besar dari nol")
        return value

    @field_validator("sources", mode="before")
    @classmethod
    def normalize_sources(cls, value: object) -> str:
        if isinstance(value, (list, tuple, set)):
            return ",".join(str(item) for item in value)
        return str(value)

    @property
    def active_sources(self) -> list[str]:
        aliases = {"youtube": "youtube_trend", "gmaps": "maps"}
        values = (
            aliases.get(part.strip().lower(), part.strip().lower())
            for part in self.sources.split(",")
            if part.strip()
        )
        return list(dict.fromkeys(values))

    @property
    def sources_list(self) -> list[str]:
        return self.active_sources


@lru_cache
def get_settings() -> Settings:
    return Settings()
