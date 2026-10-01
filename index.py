"""Vercel entrypoint for the FastAPI dashboard.

Vercel's Python runtime discovers an ASGI app exposed as ``app`` from a root
``index.py``.  The local deployment keeps its SQLite file under ``data/``;
Vercel's function filesystem is read-only, so the serverless fallback uses
``/tmp``.  For durable production data, point DATABASE_PATH at an external
database before scaling beyond this POC.
"""

from __future__ import annotations

import os

# Keep the hosted POC on the same live sources as the local dashboard. Vercel
# project environment variables override these defaults without changing code.
os.environ.setdefault("SOURCES", "youtube_trend,maps,tiktok,instagram")
os.environ.setdefault("AI_MODE", "lexicon")
os.environ.setdefault("DATABASE_PATH", "/tmp/umkm-poc.db")

from app.main import app  # noqa: E402  (runtime defaults must be set first)

__all__ = ["app"]
