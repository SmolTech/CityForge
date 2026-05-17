import re
from urllib.parse import quote_plus

from django import template
from django.utils.html import escape
from django.utils.safestring import mark_safe

register = template.Library()


@register.simple_tag(takes_context=True)
def query_replace(context, **kwargs):
    """Render the current request querystring with given keys replaced/removed."""
    request = context["request"]
    params = request.GET.copy()
    for key, value in kwargs.items():
        if value in (None, ""):
            params.pop(key, None)
        else:
            params[key] = value
    return params.urlencode()


@register.filter(name="safe_external_url")
def safe_external_url(value):
    """Return the URL only if it uses an allowed scheme; otherwise empty string.

    Prevents ``javascript:``/``data:`` URIs from sneaking into ``href`` attributes.
    """
    if not value:
        return ""
    v = str(value).strip()
    lowered = v.lower()
    if lowered.startswith(("http://", "https://", "mailto:", "tel:", "/")):
        return v
    return ""


@register.filter(name="business_address_url")
def business_address_url(address, override_url=None):
    """Return an override URL or a Google Maps search URL for a physical address."""
    safe_override = safe_external_url(override_url)
    if safe_override:
        return safe_override
    if not address:
        return ""
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(str(address))}"


@register.filter(name="phone_href")
def phone_href(value):
    """Return a tel: URL using only dialable digits, preserving a leading +."""
    if not value:
        return ""
    raw = str(value).strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    prefix = "+" if raw.startswith("+") else ""
    return f"tel:{prefix}{digits}"


@register.filter(name="highlight_safe")
def highlight_safe(value):
    """Escape an OpenSearch highlight fragment except for the ``<em>`` markers."""
    if value is None:
        return ""
    escaped = escape(str(value))
    escaped = escaped.replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
    return mark_safe(  # nosemgrep: python.django.security.audit.avoid-mark-safe.avoid-mark-safe
        escaped
    )
