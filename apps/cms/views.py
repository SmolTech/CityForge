from __future__ import annotations

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.accounts.models import User
from apps.directory.forms import CardModerationForm
from apps.directory.models import (
    Card,
    CardSubmission,
    CardSubmissionStatus,
    CardTag,
    Review,
    Tag,
)

from .decorators import admin_required, staff_required


def _split_tags(text: str) -> list[str]:
    return [t.strip() for t in (text or "").replace(";", ",").split(",") if t.strip()]


@staff_required
def dashboard(request: HttpRequest) -> HttpResponse:
    stats = {
        "users": User.objects.count(),
        "cards": Card.objects.count(),
        "pending_submissions": CardSubmission.objects.filter(
            status=CardSubmissionStatus.PENDING
        ).count(),
        "reported_reviews": Review.objects.filter(reported=True, hidden=False).count(),
    }
    recent_submissions = (
        CardSubmission.objects.select_related("submitter")
        .order_by("-created_date")[:5]
    )
    return render(
        request,
        "cms/dashboard.html",
        {"stats": stats, "recent_submissions": recent_submissions},
    )


# ------------ Users -----------
@admin_required
def users_list(request: HttpRequest) -> HttpResponse:
    q = (request.GET.get("q") or "").strip()
    qs = User.objects.all().order_by("-created_date")
    if q:
        qs = qs.filter(email__icontains=q)
    page = Paginator(qs, 25).get_page(request.GET.get("page"))
    return render(request, "cms/users_list.html", {"page_obj": page, "q": q})


@admin_required
@require_http_methods(["POST"])
def user_toggle_active(request: HttpRequest, pk: int) -> HttpResponse:
    user = get_object_or_404(User, pk=pk)
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    messages.success(request, f"{user.email} {'activated' if user.is_active else 'deactivated'}.")
    return redirect("cms:users_list")


@admin_required
@require_http_methods(["POST"])
def user_set_role(request: HttpRequest, pk: int) -> HttpResponse:
    user = get_object_or_404(User, pk=pk)
    role = request.POST.get("role", User.Role.USER)
    if role not in {r.value for r in User.Role}:
        messages.error(request, "Invalid role.")
        return redirect("cms:users_list")
    user.role = role
    user.is_staff = role in {User.Role.ADMIN, User.Role.SUPPORT}
    user.save(update_fields=["role", "is_staff"])
    messages.success(request, f"Role for {user.email} updated to {role}.")
    return redirect("cms:users_list")


# ------------ Cards -----------
@staff_required
def cards_list(request: HttpRequest) -> HttpResponse:
    q = (request.GET.get("q") or "").strip()
    qs = Card.objects.all().order_by("-created_date")
    if q:
        qs = qs.filter(name__icontains=q)
    page = Paginator(qs, 25).get_page(request.GET.get("page"))
    return render(request, "cms/cards_list.html", {"page_obj": page, "q": q})


@staff_required
def card_edit(request: HttpRequest, pk: int) -> HttpResponse:
    card = get_object_or_404(Card, pk=pk)
    if request.method == "POST":
        form = CardModerationForm(request.POST, instance=card)
        if form.is_valid():
            card = form.save(commit=False)
            if card.approved and card.approver_id is None:
                card.approver = request.user
                card.approved_date = timezone.now()
            card.save()
            _replace_card_tags(card, _split_tags(form.cleaned_data.get("tags_text", "")))
            messages.success(request, "Card updated.")
            return redirect("cms:cards_list")
    else:
        form = CardModerationForm(
            instance=card,
            initial={"tags_text": ", ".join(t.name for t in card.tags.all())},
        )
    return render(
        request,
        "cms/card_edit.html",
        {"card": card, "form": form},
    )


@staff_required
@require_http_methods(["POST"])
def card_delete(request: HttpRequest, pk: int) -> HttpResponse:
    card = get_object_or_404(Card, pk=pk)
    card.delete()
    messages.success(request, "Card deleted.")
    return redirect("cms:cards_list")


def _replace_card_tags(card: Card, tag_names: list[str]) -> None:
    CardTag.objects.filter(card=card).delete()
    for name in tag_names:
        clean = name.strip().lower()
        if not clean:
            continue
        tag, _ = Tag.objects.get_or_create(name=clean)
        CardTag.objects.get_or_create(card=card, tag=tag)


# ------------ Submissions -----------
@staff_required
def submissions_list(request: HttpRequest) -> HttpResponse:
    status = request.GET.get("status") or CardSubmissionStatus.PENDING
    qs = (
        CardSubmission.objects.filter(status=status)
        .select_related("submitter")
        .order_by("-created_date")
    )
    page = Paginator(qs, 20).get_page(request.GET.get("page"))
    return render(
        request,
        "cms/submissions_list.html",
        {"page_obj": page, "status": status, "statuses": CardSubmissionStatus.choices},
    )


@staff_required
def submission_detail(request: HttpRequest, pk: int) -> HttpResponse:
    sub = get_object_or_404(
        CardSubmission.objects.select_related("submitter"), pk=pk
    )
    return render(request, "cms/submission_detail.html", {"submission": sub})


@staff_required
@require_http_methods(["POST"])
def submission_approve(request: HttpRequest, pk: int) -> HttpResponse:
    sub = get_object_or_404(CardSubmission, pk=pk)
    if sub.status != CardSubmissionStatus.PENDING:
        messages.error(request, "Submission already reviewed.")
        return redirect("cms:submissions_list")

    card = Card.objects.create(
        name=sub.name,
        description=sub.description,
        website_url=sub.website_url,
        phone_number=sub.phone_number,
        email=sub.email,
        address=sub.address,
        address_override_url=sub.address_override_url,
        contact_name=sub.contact_name,
        image_url=sub.image_url,
        creator=sub.submitter,
        approved=True,
        approver=request.user,
        approved_date=timezone.now(),
    )
    _replace_card_tags(card, _split_tags(sub.tags_text or ""))
    sub.status = CardSubmissionStatus.APPROVED
    sub.reviewer = request.user
    sub.reviewed_date = timezone.now()
    sub.review_notes = request.POST.get("review_notes", "")
    sub.card = card
    sub.save()
    messages.success(request, f"Approved and published '{card.name}'.")
    return redirect("cms:submissions_list")


@staff_required
@require_http_methods(["POST"])
def submission_reject(request: HttpRequest, pk: int) -> HttpResponse:
    sub = get_object_or_404(CardSubmission, pk=pk)
    if sub.status != CardSubmissionStatus.PENDING:
        messages.error(request, "Submission already reviewed.")
        return redirect("cms:submissions_list")
    sub.status = CardSubmissionStatus.REJECTED
    sub.reviewer = request.user
    sub.reviewed_date = timezone.now()
    sub.review_notes = request.POST.get("review_notes", "")
    sub.save()
    messages.info(request, "Submission rejected.")
    return redirect("cms:submissions_list")


# ------------ Tags -----------
@staff_required
def tags_list(request: HttpRequest) -> HttpResponse:
    qs = Tag.objects.annotate(used=Count("cards")).order_by("name")
    return render(request, "cms/tags_list.html", {"tags": qs})


@staff_required
@require_http_methods(["POST"])
def tag_delete(request: HttpRequest, pk: int) -> HttpResponse:
    tag = get_object_or_404(Tag, pk=pk)
    tag.delete()
    messages.success(request, "Tag deleted.")
    return redirect("cms:tags_list")


# ------------ Reviews -----------
@staff_required
def reviews_list(request: HttpRequest) -> HttpResponse:
    only_reported = request.GET.get("reported") == "1"
    qs = Review.objects.select_related("card", "user").order_by("-created_date")
    if only_reported:
        qs = qs.filter(reported=True)
    page = Paginator(qs, 25).get_page(request.GET.get("page"))
    return render(
        request,
        "cms/reviews_list.html",
        {"page_obj": page, "only_reported": only_reported},
    )


@staff_required
@require_http_methods(["POST"])
def review_toggle_hidden(request: HttpRequest, pk: int) -> HttpResponse:
    review = get_object_or_404(Review, pk=pk)
    review.hidden = not review.hidden
    review.save(update_fields=["hidden"])
    messages.success(request, "Review visibility updated.")
    return redirect("cms:reviews_list")
