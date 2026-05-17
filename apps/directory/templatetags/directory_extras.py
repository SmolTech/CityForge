from django import template

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
