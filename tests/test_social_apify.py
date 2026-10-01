from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.db import Database
from app.models import Topic
from app.social.apify_client import SocialApifyClient
from app.social.parsing import parse_social_items
from app.social.usage import SocialUsageTracker


def topic() -> Topic:
    return Topic(
        id="sepatu-lokal", name="Sepatu Lokal", category="fashion",
        keywords=["sepatu lokal", "sneakers lokal"],
        product_terms=["sepatu", "sneakers"], cities=["Bandung"],
        created_at="2026-01-01T00:00:00Z",
    )


@pytest.mark.asyncio
async def test_tiktok_actor_batches_queries_without_comments_or_media(tmp_path: Path) -> None:
    calls: list[tuple[str, str, dict | None]] = []
    statuses = iter([
        {"data": {"id": "run-tt", "defaultDatasetId": "ds-tt", "status": "RUNNING"}},
        {"data": {"id": "run-tt", "defaultDatasetId": "ds-tt", "status": "SUCCEEDED"}},
    ])

    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        calls.append((request.method, str(request.url), body))
        assert request.headers["authorization"] == "Bearer test-token"
        if request.method == "POST" and "/actors/clockworks~tiktok-scraper/runs" in str(request.url):
            return httpx.Response(201, json=next(statuses))
        if request.method == "GET" and "/actor-runs/run-tt" in str(request.url):
            return httpx.Response(200, json=next(statuses))
        if request.method == "GET" and "/datasets/ds-tt/items" in str(request.url):
            return httpx.Response(200, json=[{"id": "v1", "text": "Sepatu lokal nyaman", "createTimeISO": "2026-09-30T00:00:00Z"}])
        return httpx.Response(404)

    db = Database(tmp_path / "social.db")
    await db.init()
    usage = SocialUsageTracker(db, daily_cap=5, monthly_cap=5)
    settings = Settings(
        _env_file=None, apify_token="test-token", apify_poll_interval_seconds=0.001,
        apify_poll_timeout_seconds=2, database_path=tmp_path / "social.db",
        social_max_queries_per_topic=3, social_results_per_query=50,
    )
    transport = httpx.MockTransport(handler)
    client_http = httpx.AsyncClient(transport=transport)
    client = SocialApifyClient(settings, usage, client=client_http)
    result = await client.collect("tiktok", topic())
    start = next(call for call in calls if call[0] == "POST" and "/runs" in call[1])
    assert start[2]["resultsPerPage"] == 50
    assert len(start[2]["searchQueries"]) == 3
    assert start[2]["commentsPerPost"] == 0
    assert start[2]["shouldDownloadVideos"] is False
    assert result.items[0]["id"] == "v1"
    assert sum(row["units"] for row in await db.usage_rows("social_")) == 1
    await client_http.aclose()
    await db.close()


def test_instagram_input_and_social_parser() -> None:
    settings = Settings(_env_file=None, apify_token="x", social_results_per_query=30)
    client = SocialApifyClient(settings, SocialUsageTracker(Database(":memory:")))
    payload = client.build_input("instagram", topic())
    assert payload["resultsType"] == "posts"
    assert len(payload["directUrls"]) == 3
    assert payload["resultsLimit"] == 30
    posts = parse_social_items("instagram", [{
        "id": "ig-1", "shortCode": "ABC", "caption": "Sepatu lokal Bandung",
        "timestamp": "2026-09-30T00:00:00Z", "likesCount": 23,
        "commentsCount": 4, "ownerUsername": "toko_sepatu",
    }], topic())
    assert posts[0].url == "https://www.instagram.com/p/ABC/"
    assert posts[0].mentions_product is True
    assert posts[0].likes == 23
