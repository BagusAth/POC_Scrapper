"""Analyzer fallback berbasis leksikon lokal."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.nlp.preprocess import tokenize

from .base import BaseAnalyzer, SentimentResult

NEGATIONS = frozenset({"tidak", "bukan", "kurang", "belum"})
TOPICS = (
    "harga", "rasa", "kemasan", "pengiriman", "pelayanan", "kualitas",
    "ukuran", "jahitan", "warna", "bahan", "promo",
)
NLP_DIR = Path(__file__).parents[1] / "nlp"


@lru_cache(maxsize=2)
def _load_words(filename: str) -> frozenset[str]:
    with (NLP_DIR / filename).open(encoding="utf-8") as handle:
        return frozenset(
            line.strip().lower()
            for line in handle
            if line.strip() and not line.lstrip().startswith("#")
        )


def _is_negated(tokens: list[str], index: int) -> bool:
    return any(token in NEGATIONS for token in tokens[max(0, index - 2):index])


def _topic_present(topic: str, tokens: list[str]) -> bool:
    suffixes = ("nya", "ku", "mu", "an")
    return any(token == topic or token in {topic + suffix for suffix in suffixes} for token in tokens)


class LexiconAnalyzer(BaseAnalyzer):
    name = "lexicon"

    def __init__(self) -> None:
        self.positive = _load_words("lexicon_pos.txt")
        self.negative = _load_words("lexicon_neg.txt")

    async def analyze(
        self, items: list[tuple[str, str]]
    ) -> list[SentimentResult]:
        return [self._analyze_one(comment_id, text) for comment_id, text in items]

    def _analyze_one(self, comment_id: str, text: str) -> SentimentResult:
        tokens = tokenize(text)
        positive = negative = 0
        for index, token in enumerate(tokens):
            polarity = 1 if token in self.positive else -1 if token in self.negative else 0
            if polarity and _is_negated(tokens, index):
                polarity *= -1
            positive += polarity > 0
            negative += polarity < 0
        score = (positive - negative) / max(1, positive + negative)
        sentiment = "positif" if score > 0.2 else "negatif" if score < -0.2 else "netral"
        topics = [topic for topic in TOPICS if _topic_present(topic, tokens)][:3]
        return SentimentResult(
            id=comment_id, sentiment=sentiment, score=score, topics=topics
        )
