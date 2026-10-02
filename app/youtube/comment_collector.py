"""YouTube comment collector for review videos, supporting API and public web fallback."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

import httpx

from app.db import Database
from app.events import EventBroker

logger = logging.getLogger(__name__)

API_ROOT = "https://www.googleapis.com/youtube/v3"
WEB_ROOT = "https://www.youtube.com"
WEB_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def hash_author(author_id: str | None) -> str:
    if not author_id:
        return "anon"
    return sha256(author_id.strip().encode("utf-8")).hexdigest()


class YouTubeCommentCollector:
    """Collects comments from YouTube review videos."""

    def __init__(
        self, api_key: str = "", *, timeout: float = 15.0, client: httpx.AsyncClient | None = None
    ) -> None:
        self.api_key = api_key.strip()
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._owns_client = client is None

    async def get_video_comments(self, video_id: str, max_comments: int = 15) -> list[dict[str, Any]]:
        """Fetch comments for a video, trying API first (if key exists), falling back to public web."""
        if self.api_key:
            try:
                comments = await self._api_comments(video_id, max_comments)
                if comments:
                    return comments
            except Exception as exc:
                logger.warning(
                    "YouTube API commentThreads gagal untuk %s: %s; mencoba fallback publik", video_id, exc
                )
        return await self._public_comments(video_id, max_comments)

    async def _api_comments(self, video_id: str, max_comments: int) -> list[dict[str, Any]]:
        response = await self._client.get(
            f"{API_ROOT}/commentThreads",
            params={
                "key": self.api_key,
                "part": "snippet",
                "videoId": video_id,
                "maxResults": min(max_comments, 50),
                "order": "relevance",
                "textFormat": "plainText",
            },
        )
        if response.status_code in {400, 403}:
            raise RuntimeError(f"YouTube comment API error: {response.status_code}")
        response.raise_for_status()
        items = response.json().get("items", [])
        results: list[dict[str, Any]] = []
        for item in items:
            snippet = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
            text = str(snippet.get("textDisplay", "")).strip()
            if not text:
                continue
            comment_id = str(item.get("id", ""))
            author = str(snippet.get("authorDisplayName", ""))
            channel_id = str(snippet.get("authorChannelId", {}).get("value", "") or author)
            pub = snippet.get("publishedAt")
            created_at = (
                datetime.fromisoformat(str(pub).replace("Z", "+00:00"))
                if pub
                else datetime.now(timezone.utc)
            )
            results.append({
                "comment_id": comment_id,
                "text": text,
                "author_name": author or "Pengguna YouTube",
                "author_hash": hash_author(channel_id),
                "url": f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}",
                "created_at": created_at,
            })
            if len(results) >= max_comments:
                break
        return results

    async def _public_comments(self, video_id: str, max_comments: int) -> list[dict[str, Any]]:
        try:
            response = await self._client.get(
                f"{WEB_ROOT}/watch?v={video_id}&hl=id&gl=ID",
                headers={
                    "User-Agent": WEB_USER_AGENT,
                    "Accept-Language": "id-ID,id;q=0.9",
                },
            )
            response.raise_for_status()
            html = response.text
            data = self._extract_initial_data(html)
            panel = next(
                (
                    node["engagementPanelSectionListRenderer"]
                    for node in self._walk(data)
                    if isinstance(node.get("engagementPanelSectionListRenderer"), dict)
                    and node["engagementPanelSectionListRenderer"].get("panelIdentifier")
                    == "engagement-panel-comments-section"
                ),
                None,
            )
            if panel is None:
                return []
            content = panel.get("content") or {}
            continuation = next(
                (
                    node["continuationCommand"]["token"]
                    for node in self._walk(content)
                    if isinstance(node.get("continuationCommand"), dict)
                    and node["continuationCommand"].get("token")
                ),
                None,
            )
            api_key = self._html_config(html, "INNERTUBE_API_KEY")
            client_version = self._html_config(html, "INNERTUBE_CONTEXT_CLIENT_VERSION")
            if not continuation or not api_key or not client_version:
                return []

            comments_response = await self._client.post(
                f"{WEB_ROOT}/youtubei/v1/next",
                params={"key": api_key, "prettyPrint": "false"},
                headers={
                    "User-Agent": WEB_USER_AGENT,
                    "Content-Type": "application/json",
                    "Origin": WEB_ROOT,
                    "X-YouTube-Client-Name": "1",
                    "X-YouTube-Client-Version": client_version,
                },
                json={
                    "context": {
                        "client": {
                            "clientName": "WEB",
                            "clientVersion": client_version,
                            "hl": "id",
                            "gl": "ID",
                        }
                    },
                    "continuation": continuation,
                },
            )
            comments_response.raise_for_status()
            results: list[dict[str, Any]] = []
            for node in self._walk(comments_response.json()):
                payload = node.get("commentEntityPayload")
                if isinstance(payload, dict):
                    parsed = self._map_public_comment(payload, video_id)
                    if parsed:
                        results.append(parsed)
                    if len(results) >= max_comments:
                        break
            return results
        except Exception as exc:
            logger.debug("Public comment scraping skipped for %s: %s", video_id, exc)
            return []

    @classmethod
    def _map_public_comment(cls, payload: dict[str, Any], video_id: str) -> dict[str, Any] | None:
        try:
            props = payload.get("properties", {})
            comment_id = str(props.get("commentId", ""))
            text = str(props.get("content", {}).get("content", "")).strip()
            if not text:
                return None
            author = payload.get("author", {})
            author_name = str(author.get("displayName") or "Pengguna YouTube")
            author_id = author.get("channelId") or author_name
            pub_text = props.get("publishedTime")
            created_at = cls._relative_datetime(pub_text)
            return {
                "comment_id": comment_id,
                "text": text,
                "author_name": author_name,
                "author_hash": hash_author(author_id),
                "url": f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}",
                "created_at": created_at,
            }
        except Exception:
            return None

    @classmethod
    def _walk(cls, value: Any):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from cls._walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from cls._walk(child)

    @staticmethod
    def _extract_initial_data(html: str) -> dict[str, Any]:
        decoder = json.JSONDecoder()
        for marker in ("var ytInitialData = ", "window['ytInitialData'] = ", "ytInitialData = "):
            index = html.find(marker)
            if index < 0:
                continue
            payload = html[index + len(marker) :].lstrip()
            parsed, _ = decoder.raw_decode(payload)
            if isinstance(parsed, dict):
                return parsed
        return {}

    @staticmethod
    def _html_config(html: str, name: str) -> str | None:
        match = re.search(rf'"{re.escape(name)}"\s*:\s*"([^"]+)"', html)
        return match.group(1) if match else None

    @staticmethod
    def _relative_datetime(value: Any) -> datetime:
        now = datetime.now(timezone.utc)
        text = str(value or "").lower()
        match = re.search(
            r"(\d+)\s+(detik|second|seconds|menit|minute|minutes|jam|hour|hours|"
            r"hari|day|days|minggu|week|weeks|bulan|month|months|tahun|year|years)",
            text,
        )
        if not match:
            return now
        amount = int(match.group(1))
        unit = match.group(2)
        seconds = {
            "detik": 1,
            "second": 1,
            "seconds": 1,
            "menit": 60,
            "minute": 60,
            "minutes": 60,
            "jam": 3600,
            "hour": 3600,
            "hours": 3600,
            "hari": 86400,
            "day": 86400,
            "days": 86400,
            "minggu": 604800,
            "week": 604800,
            "weeks": 604800,
            "bulan": 2592000,
            "month": 2592000,
            "months": 2592000,
            "tahun": 31536000,
            "year": 31536000,
            "years": 31536000,
        }.get(unit, 1)
        return now - timedelta(seconds=amount * seconds)

    async def collect_and_store(
        self,
        *,
        video_id: str,
        topic_id: str,
        database: Database,
        broker: EventBroker | None = None,
        max_comments: int = 15,
        max_comment_chars: int = 800,
    ) -> int:
        now = datetime.now(timezone.utc)
        comments = await self.get_video_comments(video_id, max_comments=max_comments)
        inserted_count = 0
        for c in comments:
            inserted = await database.insert_youtube_comment(
                topic_id=topic_id,
                video_id=video_id,
                comment_id=c["comment_id"],
                text=c["text"],
                author_name=c["author_name"],
                author_hash=c["author_hash"],
                url=c["url"],
                created_at=c["created_at"],
                collected_at=now,
                mentions_product=True,
                category="opini_produk",
                max_comment_chars=max_comment_chars,
            )
            if inserted:
                inserted_count += 1
                if broker:
                    await broker.publish("comment_new", {
                        "id": f"yt_{c['comment_id']}",
                        "topic_id": topic_id,
                        "source": "youtube",
                        "place_id": video_id,
                        "category": "opini_produk",
                        "text": c["text"],
                        "stars": None,
                        "created_at": c["created_at"].isoformat().replace("+00:00", "Z"),
                    })
        return inserted_count

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()
