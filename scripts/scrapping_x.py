#!/usr/bin/env python3
"""Template integrasi X API resmi melalui jalur inbox JSONL."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any


def fetch_posts(query: str) -> list[dict[str, Any]]:
    """Ambil post memakai X API resmi dan bearer token dari ``.env``.

    Implementasi sengaja dikosongkan: integrator harus menggunakan endpoint resmi,
    mematuhi ToS dan batas kuota X. Jangan mencoba melewati proteksi anti-bot.
    """
    raise NotImplementedError(
        "Hubungkan fungsi fetch_posts ke X API resmi sebelum mode non-demo dipakai"
    )


def _demo_posts(query: str) -> list[dict[str, Any]]:
    samples = [
        f"Lagi bahas {query}, kualitasnya ternyata bagus bgt 👍",
        f"Menurutku harga {query} agak mahal tp kemasannya keren",
        f"Ada yg sudah coba {query}? penasaran sama bahannya",
        f"Pengiriman {query} kemarin cepat dan pelayanannya ramah",
        f"Promo {query} menarik, semoga ukuran produknya lebih lengkap",
    ]
    now = datetime.now(timezone.utc)
    return [
        {
            "text": text,
            "created_at": now.isoformat().replace("+00:00", "Z"),
            "author_hash": sha256(f"demo-x-{index}".encode()).hexdigest(),
        }
        for index, text in enumerate(samples, start=1)
    ]


def _normalize(post: dict[str, Any], product_id: str) -> dict[str, Any]:
    text = str(post["text"])
    created_at = str(
        post.get("created_at")
        or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )
    identifier = post.get("id") or sha256(
        f"{text}{created_at}".encode("utf-8")
    ).hexdigest()[:16]
    payload: dict[str, Any] = {
        "id": f"ib_{identifier}",
        "source": "inbox",
        "product_id": product_id,
        "text": text,
        "created_at": created_at,
    }
    if post.get("url"):
        payload["url"] = str(post["url"])
    if post.get("author_hash"):
        payload["author_hash"] = str(post["author_hash"])
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kirim post X ke inbox aplikasi")
    parser.add_argument("--product-id", required=True, help="ID produk yang dipantau")
    parser.add_argument("--query", required=True, help="Query pencarian X")
    parser.add_argument(
        "--demo", action="store_true", help="Tulis lima post sintetis tanpa API"
    )
    parser.add_argument("--inbox", type=Path, default=Path("data/inbox"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        posts = _demo_posts(args.query) if args.demo else fetch_posts(args.query)
    except NotImplementedError as exc:
        print(f"Gagal: {exc}")
        return 2
    args.inbox.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output_path = args.inbox / f"x_{'demo_' if args.demo else ''}{timestamp}.jsonl"
    with output_path.open("x", encoding="utf-8") as handle:
        for post in posts:
            handle.write(
                json.dumps(_normalize(post, args.product_id), ensure_ascii=False) + "\n"
            )
    print(f"Menulis {len(posts)} komentar ke {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
