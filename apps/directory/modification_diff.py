from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

from .models import CardModification


def _split_tags(text: str) -> list[str]:
    return [t.strip() for t in (text or "").replace(";", ",").split(",") if t.strip()]


def _normalized_text(value: str | None) -> str:
    return (value or "").strip()


def _normalized_comparison_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _normalized_url_for_comparison(value: str | None) -> str:
    text = _normalized_comparison_text(value)
    if not text:
        return ""
    parsed = urlsplit(text)
    if not parsed.scheme or not parsed.netloc:
        return text.rstrip("/")
    return urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            parsed.query,
            parsed.fragment,
        )
    )


def _normalized_tags_for_comparison(text: str | None) -> tuple[str, ...]:
    return tuple(sorted({tag.lower() for tag in _split_tags(text or "")}))


def modification_comparison_rows(modification: CardModification) -> list[dict[str, object]]:
    card = modification.card
    rows: list[dict[str, object]] = []
    url_fields = {"website_url", "address_override_url", "image_url"}
    for label, field_name in [
        ("Name", "name"),
        ("Description", "description"),
        ("Website", "website_url"),
        ("Phone", "phone_number"),
        ("Email", "email"),
        ("Address", "address"),
        ("Address override URL", "address_override_url"),
        ("Contact", "contact_name"),
        ("Image URL", "image_url"),
    ]:
        current_value = _normalized_text(getattr(card, field_name))
        proposed_value = _normalized_text(getattr(modification, field_name))
        if field_name in url_fields:
            changed = _normalized_url_for_comparison(
                current_value
            ) != _normalized_url_for_comparison(proposed_value)
        else:
            changed = _normalized_comparison_text(current_value) != _normalized_comparison_text(
                proposed_value
            )
        rows.append(
            {
                "label": label,
                "current_value": current_value,
                "proposed_value": proposed_value,
                "changed": changed,
            }
        )

    current_tags = ", ".join(sorted(t.name for t in card.tags.all()))
    proposed_tags = ", ".join(_split_tags(modification.tags_text or ""))
    rows.append(
        {
            "label": "Tags",
            "current_value": current_tags,
            "proposed_value": proposed_tags,
            "changed": _normalized_tags_for_comparison(current_tags)
            != _normalized_tags_for_comparison(proposed_tags),
        }
    )
    return rows


def modification_changed_fields(modification: CardModification) -> list[dict[str, str]]:
    return [
        {
            "field": str(row["label"]),
            "old_value": str(row["current_value"]),
            "new_value": str(row["proposed_value"]),
        }
        for row in modification_comparison_rows(modification)
        if row["changed"]
    ]
