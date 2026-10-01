from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.db import Database
from app.maps.apify_client import ApifyMapsClient
from app.maps.parsing import parse_apify_items
from app.maps.usage import MapsUsageTracker
from app.models import Topic


def _topic() -> Topic:
    return Topic(
        id="sepatu-lokal",
        name="Sepatu Lokal",
        category="fashion",
        keywords=["sepatu lokal"],
        product_terms=["sepatu", "sneakers"],
        cities=["Bandung"],
        created_at="2026-01-01T00:00:00Z",
    )


@pytest.mark.asyncio
async def test_apify_run_poll_and_dataset_use_bearer_and_charge_once(tmp_path: Path) -> None:
    calls: list[tuple[str, str, dict | None]] = []
    statuses = iter([
        {"data": {"id": "run-1", "defaultDatasetId": "ds-1", "status": "RUNNING"}},
        {"data": {"id": "run-1", "defaultDatasetId": "ds-1", "status": "SUCCEEDED"}},
    ])

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, str(request.url), request.content and __import__("json").loads(request.content)))
        assert request.headers["authorization"] == "Bearer test-token"
        if request.method == "POST" and "/actors/compass~crawler-google-places/runs" in str(request.url):
            return httpx.Response(201, json=next(statuses))
        if request.method == "GET" and "/actor-runs/run-1" in str(request.url):
            return httpx.Response(200, json=next(statuses))
        if request.method == "GET" and "/datasets/ds-1/items" in str(request.url):
            return httpx.Response(200, json=[{
                "placeId": "place-1", "title": "Sepatu Lokal Bandung", "totalScore": 4.7,
                "reviewsCount": 12, "reviews": [{
                    "reviewId": "review-1", "text": "Sepatunya nyaman", "stars": 5,
                    "publishedAtDate": "2026-09-30",
                }],
            }])
        return httpx.Response(404)

    db = Database(tmp_path / "maps.db")
    await db.init()
    tracker = MapsUsageTracker(db, daily_cap=10, monthly_cap=10)
    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    settings = Settings(
        _env_file=None,
        apify_token="test-token",
        apify_poll_interval_seconds=0.001,
        apify_poll_timeout_seconds=2,
        database_path=tmp_path / "maps.db",
    )
    client = ApifyMapsClient(settings, tracker, client=http_client)
    result = await client.collect(_topic(), "Bandung")

    assert result.run_id == "run-1"
    assert result.dataset_id == "ds-1"
    assert result.items[0]["placeId"] == "place-1"
    rows = await db.usage_rows("maps_")
    assert sum(row["units"] for row in rows) == 1
    start = next(call for call in calls if call[0] == "POST" and "/runs" in call[1])
    assert start[2]["reviewsSort"] == "newest"
    assert start[2]["searchStringsArray"] == ["sepatu lokal Bandung"]
    await http_client.aclose()
    await db.close()


def test_apify_parser_drops_empty_reviews_and_clamps_stars() -> None:
    places = parse_apify_items([{
        "id": "p1", "name": "Toko Sepatu", "rating": "4.4", "reviewsCount": "3",
        "reviews": [
            {"id": "r1", "reviewText": "bagus", "rating": 9, "publishedDate": "2026-09-29"},
            {"id": "r2", "reviewText": ""},
            {"id": "", "reviewText": "tanpa id"},
        ],
    }])
    assert len(places) == 1
    assert places[0].rating == 4.4
    assert places[0].user_rating_count == 3
    assert len(places[0].reviews) == 1
    assert places[0].reviews[0].stars == 5
