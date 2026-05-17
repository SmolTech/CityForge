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
    """Return the URL only if it uses an http(s) scheme; otherwise empty string.

    Prevents ``javascript:``/``data:`` URIs from sneaking into ``href`` attributes.
    """
    if not value:
        return ""
    v = str(value).strip()
    lowered = v.lower()
    if lowered.startswith(("http://", "https://", "mailto:", "tel:", "/")):
        return v
    return ""


@register.filter(name="highlight_safe")
def highlight_safe(value):
    """Escape an OpenSearch highlight fragment except for the ``<em>`` markers."""
    if value is None:
        return ""
    escaped = escape(str(value))
    escaped = escaped.replace("&lt;em&gt;", "<em>").replace("&lt;/em&gt;", "</em>")
    return mark_safe(escaped)  # nosemgrep: python.django.security.audit.avoid-mark-safe.avoid-mark-safe
