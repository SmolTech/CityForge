from __future__ import annotations

import calendar as pycalendar
from datetime import UTC, date, datetime, timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import require_http_methods

from apps.webhooks.service import dispatch_event

from .forms import EventSubmissionForm
from .models import Event, EventStatus, EventSubmission


def _absolute_url(request: HttpRequest, view_name: str, **kwargs) -> str:
    return request.build_absolute_uri(reverse(view_name, kwargs=kwargs))


def _serialize_event(event: Event) -> dict[str, object]:
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description or "",
        "location": event.location or "",
        "start_at": event.start_at,
        "end_at": event.end_at,
        "url": event.url or "",
        "all_day": event.all_day,
        "slug": event.slug,
        "approved": event.approved,
        "created_date": event.created_date,
        "updated_date": event.updated_date,
    }


def _serialize_submission(submission: EventSubmission) -> dict[str, object]:
    return {
        "id": submission.id,
        "title": submission.title,
        "description": submission.description or "",
        "location": submission.location or "",
        "start_at": submission.start_at,
        "end_at": submission.end_at,
        "url": submission.url or "",
        "all_day": submission.all_day,
        "status": submission.status,
        "created_date": submission.created_date,
    }


def _event_span_start(event: Event) -> datetime:
    return timezone.localtime(event.start_at)


def _event_span_end(event: Event) -> datetime:
    return timezone.localtime(event.end_at or event.start_at)


def _safe_int(value: str | None, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value or default)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, minimum), maximum)


def _event_dates(event: Event) -> list[date]:
    start = _event_span_start(event).date()
    end = _event_span_end(event).date()
    days = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def _approved_events_queryset():
    return Event.objects.filter(approved=True).order_by("start_at", "title")


def _calendar_month_context(request: HttpRequest) -> dict[str, object]:
    today = timezone.localdate()
    month_param = (request.GET.get("month") or "").strip()
    if month_param:
        try:
            current = datetime.strptime(month_param, "%Y-%m").date().replace(day=1)
        except ValueError:
            current = today.replace(day=1)
    else:
        current = today.replace(day=1)

    month_start = current
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    events = list(
        _approved_events_queryset().filter(
            Q(start_at__date__lte=month_end)
            & (
                Q(end_at__isnull=True, start_at__date__gte=month_start)
                | Q(end_at__date__gte=month_start)
            )
        )
    )
    events_by_day: dict[date, list[Event]] = {}
    for event in events:
        for day in _event_dates(event):
            if month_start <= day <= month_end:
                events_by_day.setdefault(day, []).append(event)

    cal = pycalendar.Calendar(firstweekday=6)
    weeks = []
    for week in cal.monthdatescalendar(current.year, current.month):
        weeks.append(
            [
                {
                    "date": day,
                    "in_month": day.month == current.month,
                    "is_today": day == today,
                    "events": events_by_day.get(day, []),
                }
                for day in week
            ]
        )

    prev_month = (month_start.replace(day=1) - timedelta(days=1)).replace(day=1)
    next_month = (month_end + timedelta(days=1)).replace(day=1)
    return {
        "current_month": current,
        "weeks": weeks,
        "prev_month": prev_month.strftime("%Y-%m"),
        "next_month": next_month.strftime("%Y-%m"),
        "month": current.strftime("%Y-%m"),
        "today": today,
    }


def _ical_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _ical_dt(value: datetime) -> str:
    return timezone.localtime(value).astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _build_ics(events: list[Event], request: HttpRequest) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CityForge//Community Calendar//EN",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:CityForge Community Calendar",
        "X-WR-TIMEZONE:UTC",
        "METHOD:PUBLISH",
    ]
    for event in events:
        start = timezone.localtime(event.start_at)
        end = timezone.localtime(event.end_at or event.start_at)
        if event.all_day:
            start_date = start.date()
            end_date = (end.date() if end.date() > start_date else start_date) + timedelta(days=1)
            lines.extend(
                [
                    "BEGIN:VEVENT",
                    f"UID:event-{event.id}@cityforge.local",
                    f"DTSTAMP:{_ical_dt(event.updated_date)}",
                    f"DTSTART;VALUE=DATE:{start_date.strftime('%Y%m%d')}",
                    f"DTEND;VALUE=DATE:{end_date.strftime('%Y%m%d')}",
                    f"SUMMARY:{_ical_escape(event.title)}",
                ]
            )
        else:
            lines.extend(
                [
                    "BEGIN:VEVENT",
                    f"UID:event-{event.id}@cityforge.local",
                    f"DTSTAMP:{_ical_dt(event.updated_date)}",
                    f"DTSTART:{_ical_dt(event.start_at)}",
                    f"DTEND:{_ical_dt(event.end_at or event.start_at)}",
                    f"SUMMARY:{_ical_escape(event.title)}",
                ]
            )
        if event.description:
            lines.append(f"DESCRIPTION:{_ical_escape(event.description)}")
        if event.location:
            lines.append(f"LOCATION:{_ical_escape(event.location)}")
        event_url = event.url or _absolute_url(
            request, "events:event_detail", pk=event.pk, slug=event.slug
        )
        if event_url and not event_url.startswith(("http://", "https://")):
            event_url = _absolute_url(request, "events:event_detail", pk=event.pk, slug=event.slug)
        lines.append(f"URL:{_ical_escape(event_url)}")
        lines.append("STATUS:CONFIRMED")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def events_home(request: HttpRequest) -> HttpResponse:
    search = (request.GET.get("q") or "").strip()
    qs = _approved_events_queryset()
    if search:
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(location__icontains=search)
        )
    page = Paginator(qs, settings.PAGINATION_DEFAULT_LIMIT).get_page(request.GET.get("page"))
    calendar_context = _calendar_month_context(request)
    return render(
        request,
        "events/home.html",
        {
            "page_obj": page,
            "events": page.object_list,
            "search": search,
            "feed_url": _absolute_url(request, "events:feed"),
            **calendar_context,
            "total": qs.count(),
        },
    )


def event_detail(request: HttpRequest, pk: int, slug: str | None = None) -> HttpResponse:
    event = get_object_or_404(Event, pk=pk, approved=True)
    canonical = slugify(event.title)
    if slug != canonical:
        return redirect("events:event_detail", pk=event.pk, slug=canonical)
    return render(request, "events/detail.html", {"event": event})


@require_http_methods(["GET", "POST"])
def event_submit(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return redirect("accounts:login")

    if request.method == "POST":
        form = EventSubmissionForm(request.POST)
        if form.is_valid():
            submission: EventSubmission = form.save(commit=False)
            submission.submitter = request.user
            submission.status = EventStatus.PENDING
            submission.save()
            dispatch_event(
                "event.submitted",
                {
                    "submission_id": submission.id,
                    "submission_title": submission.title,
                    "submitter_id": request.user.id,
                    "submitter_email": request.user.email,
                    "change_text": f"{request.user.email} submitted a new event '{submission.title}'.",
                    "content_url": _absolute_url(
                        request, "events:event_submission_detail", pk=submission.id
                    ),
                    "content_title": submission.title,
                },
                source_info="events.event_submit",
            )
            messages.success(
                request, "Event submission received — it will be reviewed by an admin."
            )
            return redirect("events:home")
    else:
        form = EventSubmissionForm()
    return render(request, "events/submit.html", {"form": form})


@require_http_methods(["GET"])
def my_event_submissions(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return redirect("accounts:login")
    submissions = EventSubmission.objects.filter(submitter=request.user).order_by("-created_date")
    return render(request, "events/my_submissions.html", {"submissions": submissions})


@login_required
def event_submission_detail(request: HttpRequest, pk: int) -> HttpResponse:
    submission = get_object_or_404(EventSubmission.objects.select_related("submitter"), pk=pk)
    if submission.submitter != request.user and not request.user.is_staff:
        messages.error(request, "You do not have permission to view this submission.")
        return redirect("events:home")
    return render(request, "events/submission_detail.html", {"submission": submission})


def api_events(request: HttpRequest) -> JsonResponse:
    limit = _safe_int(request.GET.get("limit"), default=100, minimum=1, maximum=500)
    offset = _safe_int(request.GET.get("offset"), default=0, minimum=0, maximum=10000)
    qs = _approved_events_queryset()
    total = qs.count()
    events = [_serialize_event(event) for event in qs[offset : offset + limit]]
    return JsonResponse({"events": events, "total": total, "limit": limit, "offset": offset})


def event_feed(request: HttpRequest) -> HttpResponse:
    events = list(_approved_events_queryset())
    response = HttpResponse(
        _build_ics(events, request), content_type="text/calendar; charset=utf-8"
    )
    response["Content-Disposition"] = 'inline; filename="community-calendar.ics"'
    return response
