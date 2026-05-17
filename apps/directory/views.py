from __future__ import annotations

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.text import slugify
from django.views.decorators.http import require_http_methods

from .forms import CardSubmissionForm, ReviewForm
from .models import Card, CardSubmission, CardSubmissionStatus, Review, Tag


def _split_tags(text: str) -> list[str]:
    return [t.strip() for t in (text or "").replace(";", ",").split(",") if t.strip()]


def home(request: HttpRequest) -> HttpResponse:
    search = (request.GET.get("q") or "").strip()
    selected_tags = request.GET.getlist("tag")
    tag_mode = (request.GET.get("tag_mode") or "and").lower()
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
        messages.success(request, "Thanks for your review!")
    else:
        messages.error(request, "Please correct the errors in your review.")
    return redirect("directory:card_detail", pk=card.pk, slug=slugify(card.name))


@login_required
@require_http_methods(["GET", "POST"])
def card_submit(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = CardSubmissionForm(request.POST)
        if form.is_valid():
            sub: CardSubmission = form.save(commit=False)
            sub.submitter = request.user
            sub.status = CardSubmissionStatus.PENDING
            sub.tags_text = ", ".join(_split_tags(form.cleaned_data.get("tags_text", "")))
            sub.save()
            messages.success(request, "Submission received — it will be reviewed by an admin.")
            return redirect("directory:home")
    else:
        form = CardSubmissionForm()
    return render(request, "directory/card_submit.html", {"form": form})


def my_submissions(request: HttpRequest) -> HttpResponse:
    if not request.user.is_authenticated:
        return redirect("accounts:login")
    subs = CardSubmission.objects.filter(submitter=request.user).order_by("-created_date")
    return render(request, "directory/my_submissions.html", {"submissions": subs})
