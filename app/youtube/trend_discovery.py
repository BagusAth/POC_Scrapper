"""Discover and persist trend-relevant YouTube videos for a topic."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from app.config import Settings
from app.db import Database
from app.models import Topic, Video, VideoStat
from app.nlp.preprocess import normalize

from app.events import EventBroker
from .comment_collector import YouTubeCommentCollector
from .content_type import ContentTypeClassifier

NEGATIVE_PRODUCT_SIGNALS = (
    "resep", "cara membuat", "cara bikin", "tutorial", "bikin sendiri",
    "buat sendiri", "diy", "homemade", "masak sendiri", "mudah buatnya",
    "cukup di aduk", "lagu", "cover", "chord", "karaoke", "lirik",
    "official music", "official video", "podcast", "gameplay", "parodi",
    "prank", "asmr", "full album", "belajar", "kursus", "pelatihan",
    "biang", "10 liter",
)


class TrendClient(Protocol):
    mode: str

    async def search_videos(
        self, query: str, order: str, published_after: datetime,
        max_results: int = 50, page_token: str | None = None,
    ) -> tuple[list[str], str | None]: ...

    async def get_videos(
        self, ids: list[str], parts: str = "snippet,statistics",
        usage_bucket: str = "yt_read",
    ) -> list[dict[str, Any]]: ...


@dataclass(slots=True)
class DiscoveryResult:
    query: str
    found: int
    relevant: int
    stored: int
    videos: list[Video]


def build_query(topic: Topic) -> str:
    terms = [f'"{keyword}"' if " " in keyword else keyword for keyword in topic.keywords]
    excluded = [f'-"{term}"' if " " in term else f"-{term}" for term in topic.exclude_terms]
    return "|".join(terms) + (" " + " ".join(excluded) if excluded else "")


def is_relevant(item: dict[str, Any], topic: Topic, *, strict_product_filter: bool = False) -> bool:
    if item.get("live_broadcast_content") == "upcoming":
        return False
    title = normalize(str(item.get("title", "")))
    description = normalize(str(item.get("description", ""))[:600])
    combined = f"{title} {description}"
    excludes = [normalize(term) for term in topic.exclude_terms]
    if any(term and term in title for term in excludes):
        return False
    if strict_product_filter:
        if any(neg in title for neg in NEGATIVE_PRODUCT_SIGNALS):
            return False
    signals = [normalize(value) for value in [*topic.keywords, *topic.product_terms]]
    return any(signal and signal in combined for signal in signals)


class TrendDiscovery:
    def __init__(
        self, database: Database, client: TrendClient, settings: Settings,
        classifier: ContentTypeClassifier,
        broker: EventBroker | None = None,
        comment_collector: YouTubeCommentCollector | None = None,
    ) -> None:
        self.database = database
        self.client = client
        self.settings = settings
        self.classifier = classifier
        self.broker = broker
        self.comment_collector = comment_collector

    async def discover(self, topic: Topic, *, now: datetime | None = None) -> DiscoveryResult:
        current = now or datetime.now(timezone.utc)
        cutoff = current - timedelta(days=self.settings.yt_trend_lookback_days)
        query = build_query(topic)
        ids: list[str] = []
        pages = self.settings.yt_search_date_pages if self.client.mode == "api" else 1
        page_token: str | None = None
        for _ in range(pages):
            found, page_token = await self.client.search_videos(
                query, "date", cutoff, page_token=page_token
            )
            ids.extend(found)
            if not page_token:
                break
        popular, _ = await self.client.search_videos(query, "viewCount", cutoff)
        ids.extend(popular)
        unique_ids = list(dict.fromkeys(ids))
        details: list[dict[str, Any]] = []
        for start in range(0, len(unique_ids), 50):
            details.extend(await self.client.get_videos(unique_ids[start:start + 50]))
        filtered = [
            item for item in details
            if is_relevant(item, topic, strict_product_filter=self.settings.yt_strict_review_filter)
            and self._published_at(item, current) >= cutoff
        ]
        filtered.sort(
            key=lambda item: (
                str(item.get("published_at") or ""), int(item.get("views", 0))
            ),
            reverse=True,
        )
        filtered = filtered[: self.settings.yt_max_videos_per_topic]
        kinds = await self.classifier.classify([
            (str(item["video_id"]), str(item.get("title", ""))) for item in filtered
        ])
        
        # Filter strictly for accepted video types (e.g. review only)
        accepted_types = {t.strip() for t in self.settings.accepted_video_types.split(",") if t.strip()}
        accepted_filtered = [
            item for item in filtered
            if kinds.get(str(item["video_id"])) in accepted_types
        ]
        
        source = "public_search" if self.client.mode == "public" else "search_date"
        videos = [self._video(item, topic.id, source, kinds[str(item["video_id"])], current) for item in accepted_filtered]
        await self.database.upsert_videos(videos)
        initial_stats = [
            VideoStat(
                video_id=str(item["video_id"]), captured_at=current,
                views=max(0, int(item.get("views", 0))),
                likes=item.get("likes"), comments=item.get("comments"),
            )
            for item in accepted_filtered
        ]
        await self.database.insert_video_stats(initial_stats)
        await self.database.deactivate_old_videos(topic.id, cutoff)
        await self.database.update_topic_status(
            topic.id, "active" if videos else "limited", discovery_at=current
        )

        # Scrape review comments from accepted review videos
        if self.comment_collector and self.settings.yt_comments_enabled:
            for video in videos:
                try:
                    await self.comment_collector.collect_and_store(
                        video_id=video.video_id,
                        topic_id=topic.id,
                        database=self.database,
                        broker=self.broker,
                        max_comments=self.settings.yt_max_comments_per_video,
                        max_comment_chars=self.settings.max_comment_chars,
                    )
                except Exception as exc:
                    logging.getLogger(__name__).warning(
                        "Scraping komentar video %s gagal: %s", video.video_id, exc
                    )

        return DiscoveryResult(query, len(unique_ids), len(filtered), len(videos), videos)

    @staticmethod
    def _published_at(item: dict[str, Any], fallback: datetime) -> datetime:
        value = item.get("published_at")
        if isinstance(value, datetime):
            parsed = value
        elif value:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        else:
            parsed = fallback
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _video(
        item: dict[str, Any], topic_id: str, source: str, content_type: str,
        discovered_at: datetime,
    ) -> Video:
        published = item.get("published_at") or discovered_at
        if not isinstance(published, datetime):
            published = datetime.fromisoformat(str(published).replace("Z", "+00:00"))
        return Video(
            video_id=str(item["video_id"]), topic_id=topic_id,
            title=str(item.get("title", "")), channel_id=str(item.get("channel_id", "")),
            channel_title=str(item.get("channel_title", "")),
            description=str(item.get("description", "")), published_at=published,
            discovered_at=discovered_at, discovery_source=source,
            content_type=content_type,
        )
