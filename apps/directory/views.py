from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.text import slugify
from django.views.decorators.http import require_http_methods

from apps.webhooks.service import dispatch_event

from .forms import CardModificationForm, CardSubmissionForm, ReviewForm
from .models import (
    Card,
    CardModification,
    CardSubmission,
    CardSubmissionStatus,
    Review,
    Tag,
)
from .modification_diff import modification_changed_fields


def _split_tags(text: str) -> list[str]:
    return [t.strip() for t in (text or "").replace(";", ",").split(",") if t.strip()]


def _absolute_url(request: HttpRequest, view_name: str, **kwargs) -> str:
    return request.build_absolute_uri(reverse(view_name, kwargs=kwargs))


def home(request: HttpRequest) -> HttpResponse:
    search = (request.GET.get("q") or "").strip()
    selected_tags = request.GET.getlist("tag")
    tag_mode = (request.GET.get("tag_mode") or "or").lower()
    featured_only = request.GET.get("featured") == "1"

    qs = Card.objects.filter(approved=True)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(description__icontains=search)
            | Q(address__icontains=search)
            | Q(contact_name__icontains=search)
        )

    if featured_only:
        qs = qs.filter(featured=True)

    if selected_tags:
        if tag_mode == "or":
            qs = qs.filter(tags__name__in=selected_tags).distinct()
        else:
            for t in selected_tags:
                qs = qs.filter(tags__name=t)
            qs = qs.distinct()

    qs = (
        qs.annotate(
            avg_rating=Avg("reviews__rating", filter=Q(reviews__hidden=False)),
            num_reviews=Count("reviews", filter=Q(reviews__hidden=False)),
        )
        .prefetch_related("tags")
        .order_by("-featured", "name")
    )

    paginator = Paginator(qs, settings.PAGINATION_DEFAULT_LIMIT)
    page = paginator.get_page(request.GET.get("page"))

    tags = Tag.objects.annotate(used=Count("cards")).filter(used__gt=0).order_by("name")

    ctx = {
        "page_obj": page,
        "cards": page.object_list,
        "tags": tags,
        "selected_tags": selected_tags,
        "tag_mode": tag_mode,
        "search": search,
        "featured_only": featured_only,
        "total": paginator.count,
    }
    return render(request, "directory/home.html", ctx)


def api_cards(request: HttpRequest) -> JsonResponse:
    limit = _safe_int(request.GET.get("limit"), default=1000, minimum=1, maximum=5000)
    cards = (
        Card.objects.filter(approved=True)
        .order_by("id")
        .values(
            "id",
            "name",
            "description",
            "website_url",
            "phone_number",
            "email",
            "address",
            "address_override_url",
            "contact_name",
            "featured",
            "image_url",
            "created_date",
            "updated_date",
        )[:limit]
    )
    return JsonResponse({"cards": list(cards)})


def _safe_int(value: str | None, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value or default)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, minimum), maximum)


def card_detail(request: HttpRequest, pk: int, slug: str | None = None) -> HttpResponse:
    card = get_object_or_404(
        Card.objects.prefetch_related("tags").select_related("creator"),
        pk=pk,
        approved=True,
    )
    canonical = slugify(card.name)
    if slug != canonical:
        return redirect("directory:card_detail", pk=card.pk, slug=canonical)

    reviews = card.reviews.filter(hidden=False).select_related("user").order_by("-created_date")
    rating_agg = reviews.aggregate(avg=Avg("rating"), count=Count("id"))

    can_review = request.user.is_authenticated and not reviews.filter(user=request.user).exists()
    review_form = ReviewForm() if can_review else None

    return render(
        request,
        "directory/card_detail.html",
        {
            "card": card,
            "reviews": reviews,
            "avg_rating": rating_agg["avg"],
            "review_count": rating_agg["count"],
            "can_review": can_review,
            "review_form": review_form,
            "can_suggest_update": request.user.is_authenticated,
        },
    )


@login_required
@require_http_methods(["POST"])
def submit_review(request: HttpRequest, pk: int) -> HttpResponse:
    card = get_object_or_404(Card, pk=pk, approved=True)
    if Review.objects.filter(card=card, user=request.user).exists():
        messages.error(request, "You have already reviewed this business.")
        return redirect("directory:card_detail", pk=card.pk, slug=slugify(card.name))

    form = ReviewForm(request.POST)
    if form.is_valid():
        review = form.save(commit=False)
        review.card = card
        review.user = request.user
        review.save()
        dispatch_event(
            "review.created",
            {
                "review_id": review.id,
                "card_id": card.id,
                "card_name": card.name,
                "user_id": request.user.id,
                "user_email": request.user.email,
                "rating": review.rating,
                "title": review.title or "",
                "comment": review.comment or "",
                "change_text": (
                    f"{request.user.email} posted a {review.rating}-star review for "
                    f"'{card.name}': {review.title or review.comment or 'No text provided.'}"
                ),
                "content_url": _absolute_url(
                    request, "directory:card_detail", pk=card.id, slug=slugify(card.name)
                ),
                "content_title": card.name,
            },
            source_info="directory.submit_review",
        )
        messages.success(request, "Thanks for your review!")
    else:
        messages.error(request, "Please correct the errors in your review.")
    return redirect("directory:card_detail", pk=card.pk, slug=slugify(card.name))


@login_required
@require_http_methods(["GET", "POST"])
def card_submit(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = CardSubmissionForm(request.POST, request.FILES)
        if form.is_valid():
            sub: CardSubmission = form.save(commit=False)
            sub.submitter = request.user
            sub.status = CardSubmissionStatus.PENDING
            sub.tags_text = ", ".join(_split_tags(form.cleaned_data.get("tags_text", "")))
            if form.cleaned_data.get("image"):
                sub.image_url = _save_business_image(form.cleaned_data["image"])
            sub.save()
            dispatch_event(
                "submission.created",
                {
                    "submission_id": sub.id,
                    "name": sub.name,
                    "submitter_id": request.user.id,
                    "submitter_email": request.user.email,
                    "status": sub.status,
                    "description": sub.description or "",
                    "change_text": (
                        f"{request.user.email} submitted new business '{sub.name}': "
                        f"{sub.description or 'No description provided.'}"
                    ),
                    "content_url": _absolute_url(request, "cms:submission_detail", pk=sub.id),
                    "content_title": sub.name,
                },
                source_info="directory.card_submit",
            )
            messages.success(request, "Submission received — it will be reviewed by an admin.")
            return redirect("directory:home")
    else:
        form = CardSubmissionForm()
    return render(request, "directory/card_submit.html", {"form": form})


@login_required
@require_http_methods(["GET", "POST"])
def card_update_submit(request: HttpRequest, pk: int) -> HttpResponse:
    card = get_object_or_404(Card, pk=pk, approved=True)
    if request.method == "POST":
        form = CardModificationForm(request.POST, request.FILES)
        if form.is_valid():
            mod: CardModification = form.save(commit=False)
            mod.card = card
            mod.submitter = request.user
            mod.status = CardSubmissionStatus.PENDING
            mod.tags_text = ", ".join(_split_tags(form.cleaned_data.get("tags_text", "")))
            if form.cleaned_data.get("image"):
                mod.image_url = _save_business_image(form.cleaned_data["image"])
            mod.save()
            changed_fields = modification_changed_fields(mod)
            dispatch_event(
                "modification.created",
                {
                    "modification_id": mod.id,
                    "card_id": card.id,
                    "card_name": card.name,
                    "submitter_id": request.user.id,
                    "submitter_email": request.user.email,
                    "status": mod.status,
                    "change_text": (
                        f"{request.user.email} submitted {len(changed_fields)} change(s) "
                        f"for '{card.name}'."
                    ),
                    "changed_fields": changed_fields,
                    "content_url": _absolute_url(request, "cms:modification_detail", pk=mod.id),
                    "content_title": card.name,
                },
                source_info="directory.card_update_submit",
            )
            messages.success(
                request,
                "Update submitted — an admin will review it before publishing changes.",
            )
            return redirect("directory:card_detail", pk=card.pk, slug=slugify(card.name))
    else:
        form = CardModificationForm(
            initial={
                "name": card.name,
                "description": card.description,
                "website_url": card.website_url,
                "phone_number": card.phone_number,
                "email": card.email,
                "address": card.address,
                "address_override_url": card.address_override_url,
                "contact_name": card.contact_name,
                "tags_text": ", ".join(t.name for t in card.tags.all()),
            }
        )
    return render(
        request,
        "directory/card_update_submit.html",
        {
            "form": form,
            "card": card,
        },
    )


def _save_business_image(image) -> str:
    suffix = Path(image.name).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        suffix = ".jpg"
    name = default_storage.save(f"business-submissions/{uuid4().hex}{suffix}", image)
    return f"{settings.MEDIA_URL}{name}"


def my_submissions(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return redirect("accounts:login")
    subs = CardSubmission.objects.filter(submitter=request.user).order_by("-created_date")
    modifications = (
        CardModification.objects.filter(submitter=request.user)
        .select_related("card")
        .order_by("-created_date")
    )
    return render(
        request,
        "directory/my_submissions.html",
        {"submissions": subs, "modifications": modifications},
    )
