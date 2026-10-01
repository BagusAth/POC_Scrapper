"""Persistent Actor-run caps shared by TikTok and Instagram."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db import Database

from .errors import SocialBudgetExceededError


class SocialUsageTracker:
    def __init__(
        self, database: Database, *, daily_cap: int = 12, monthly_cap: int = 300
    ) -> None:
        self.database = database
        self.daily_cap = daily_cap
        self.monthly_cap = monthly_cap

    @staticmethod
    def day(now: datetime | None = None) -> str:
        value = now or datetime.now(timezone.utc)
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).date().isoformat()

    async def consume(self, platform: str, *, now: datetime | None = None) -> int:
        if platform not in {"tiktok", "instagram", "facebook"}:
            raise ValueError("Platform sosial tidak valid")
        day = self.day(now)
        rows = await self.database.usage_rows("social_")
        daily = sum(int(row["units"]) for row in rows if row["day"] == day)
        monthly = sum(
            int(row["units"]) for row in rows if str(row["day"]).startswith(day[:7])
        )
        if daily >= self.daily_cap:
            raise SocialBudgetExceededError("Batas run sosial hari ini tercapai")
        if monthly >= self.monthly_cap:
            raise SocialBudgetExceededError("Batas run sosial bulan ini tercapai")
        return await self.database.usage_add(day, f"social_{platform}_run", 1)

    async def status(self, *, now: datetime | None = None) -> dict[str, Any]:
        day = self.day(now)
        rows = await self.database.usage_rows("social_")
        daily_rows = [row for row in rows if row["day"] == day]
        monthly_rows = [row for row in rows if str(row["day"]).startswith(day[:7])]
        by_platform = {
            platform: sum(
                int(row["units"])
                for row in daily_rows
                if row["api"] == f"social_{platform}_run"
            )
            for platform in ("tiktok", "instagram", "facebook")
        }
        daily = sum(int(row["units"]) for row in daily_rows)
        monthly = sum(int(row["units"]) for row in monthly_rows)
        return {
            "day": day,
            "month": day[:7],
            "today": daily,
            "by_platform_today": by_platform,
            "daily_limit": self.daily_cap,
            "this_month": monthly,
            "monthly_limit": self.monthly_cap,
            "level": "habis" if daily >= self.daily_cap or monthly >= self.monthly_cap else "hemat",
        }
