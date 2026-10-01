"""Product relevance rules for Google Maps places and reviews."""

from __future__ import annotations

import re

from app.models import Topic
from app.nlp.preprocess import normalize
from app.maps.parsing import ParsedPlace


def _signals(topic: Topic) -> list[str]:
    values = [topic.name, *topic.product_terms, *topic.keywords]
    return list(dict.fromkeys(normalize(value) for value in values if normalize(value)))


def _contains(text: str, signals: list[str]) -> bool:
    normalized = normalize(text)
    return any(re.search(rf"(?<!\w){re.escape(signal)}(?!\w)", normalized) for signal in signals)


def mentions_product(text: str, topic: Topic) -> bool:
    return _contains(text, _signals(topic))


def place_relevance(place: ParsedPlace, topic: Topic) -> tuple[bool, bool, list[bool]]:
    """Return (relevant, name_mentions_product, review_mentions)."""

    signals = _signals(topic)
    name_hit = _contains(place.name, signals)
    review_hits = [_contains(review.text, signals) for review in place.reviews]
    excluded = any(_contains(place.name, [normalize(term)]) for term in topic.exclude_terms)
    # A place can be discovered through its category/name or through a review
    # that explicitly discusses the product. Permanently closed businesses are
    # retained only as non-relevant history.
    closed = (place.business_status or "").upper() in {"CLOSED_PERMANENTLY", "CLOSED"}
    relevant = not closed and not excluded and (name_hit or any(review_hits))
    return relevant, name_hit, review_hits
