from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.db import Database
from app.events import EventBroker
from app.models import TopicCreate
from app.youtube.comment_collector import YouTubeCommentCollector, hash_author


def test_hash_author() -> None:
    assert hash_author(None) == "anon"
    assert hash_author("") == "anon"
    assert len(hash_author("user-123")) == 64


@pytest.mark.asyncio
async def test_insert_and_fetch_youtube_comment(tmp_path: Path) -> None:
    db = Database(tmp_path / "test_comment.db")
    await db.init()
    topic = await db.create_topic(
        TopicCreate(name="Seblak", keywords=["seblak"], product_terms=["seblak"], cities=["Bandung"])
    )
    now = datetime.now(timezone.utc)
    inserted = await db.insert_youtube_comment(
        topic_id=topic.id,
        video_id="vid123",
        comment_id="c1",
        text="Seblaknya pedas mantap bumbu kencurnya berasa banget!",
        author_name="FoodLover",
        author_hash=hash_author("FoodLover"),
        url="https://youtube.com/watch?v=vid123&lc=c1",
        created_at=now,
        collected_at=now,
        mentions_product=True,
        category="opini_produk",
    )
    assert inserted is True

    feed = await db.get_topic_feed(topic.id)
    assert len(feed) == 1
    assert feed[0].source == "youtube"
    assert feed[0].text == "Seblaknya pedas mantap bumbu kencurnya berasa banget!"
    assert feed[0].place_id == "vid123"

    pending = await db.fetch_pending()
    assert any(c.id == "yt_c1" for c in pending)

    await db.close()


@pytest.mark.asyncio
async def test_collector_collect_and_store(tmp_path: Path) -> None:
    db = Database(tmp_path / "test_store.db")
    await db.init()
    broker = EventBroker()

    topic = await db.create_topic(
        TopicCreate(name="Seblak", keywords=["seblak"], product_terms=["seblak"], cities=["Bandung"])
    )

    collector = YouTubeCommentCollector()
    mock_comments = [
        {
            "comment_id": "cmt_101",
            "text": "Enak banget recommended!",
            "author_name": "Reviewer",
            "author_hash": "hash101",
            "url": "https://youtube.com/watch?v=vid_test&lc=cmt_101",
            "created_at": datetime.now(timezone.utc),
        }
    ]

    async with broker.subscribe() as queue:
        with patch.object(collector, "get_video_comments", AsyncMock(return_value=mock_comments)):
            count = await collector.collect_and_store(
                video_id="vid_test",
                topic_id=topic.id,
                database=db,
                broker=broker,
            )
            assert count == 1
            event = await queue.get()
            assert event.name == "comment_new"
            assert event.data["id"] == "yt_cmt_101"
            assert event.data["source"] == "youtube"

    await collector.close()
    await db.close()
