from __future__ import annotations

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import require_http_methods

from apps.accounts.models import User
from apps.cms.forms import SiteSettingsForm
from apps.core.site_config import get_site_config, set_site_config
from apps.directory.forms import CardModerationForm
from apps.directory.models import (
    Card,
    CardModification,
    CardSubmission,
    CardSubmissionStatus,
    CardTag,
    Review,
    Tag,
)
from apps.directory.modification_diff import (
    modification_changed_fields,
    modification_comparison_rows,
)
from apps.webhooks.models import WebhookEndpoint
from apps.webhooks.service import dispatch_event

from .decorators import admin_required, staff_required


def _split_tags(text: str) -> list[str]:
    return [t.strip() for t in (text or "").replace(";", ",").split(",") if t.strip()]


def _modification_comparison_rows(modification: CardModification) -> list[dict[str, object]]:
    return modification_comparison_rows(modification)


def _absolute_url(request: HttpRequest, view_name: str, **kwargs) -> str:
    return request.build_absolute_uri(reverse(view_name, kwargs=kwargs))


@staff_required
def dashboard(request: HttpRequest) -> HttpResponse:
    stats = {
        "users": User.objects.count(),
        "cards": Card.objects.count(),
        "pending_submissions": CardSubmission.objects.filter(
            status=CardSubmissionStatus.PENDING
        ).count(),
        "pending_modifications": CardModification.objects.filter(
            status=CardSubmissionStatus.PENDING
        ).count(),
        "reported_reviews": Review.objects.filter(reported=True, hidden=False).count(),
    }
    recent_submissions = CardSubmission.objects.select_related("submitter").order_by(
        "-created_date"
    )[:5]
    return render(
        request,
        "cms/dashboard.html",
        {"stats": stats, "recent_submissions": recent_submissions},
    )


@admin_required
def site_settings(request: HttpRequest) -> HttpResponse:
    endpoint = WebhookEndpoint.objects.filter(name="Mattermost Admin Digest").first()
    config = get_site_config()
    initial = {
        "site_name": config["SITE_NAME"],
        "site_tagline": config["SITE_TAGLINE"],
        "mattermost_webhook_url": endpoint.url if endpoint else "",
        "mattermost_webhook_enabled": bool(endpoint and endpoint.enabled),
    }
    if request.method == "POST":
        form = SiteSettingsForm(request.POST)
        if form.is_valid():
            set_site_config(
                form.cleaned_data["site_name"],
                form.cleaned_data["site_tagline"],
            )
            _save_mattermost_endpoint(
                form.cleaned_data["mattermost_webhook_url"],
                enabled=form.cleaned_data["mattermost_webhook_enabled"],
            )
            messages.success(request, "Site settings updated.")
            return redirect("cms:site_settings")
    else:
        form = SiteSettingsForm(initial=initial)
    return render(request, "cms/site_settings.html", {"form": form})


def _save_mattermost_endpoint(url: str, *, enabled: bool) -> None:
    endpoint = WebhookEndpoint.objects.filter(name="Mattermost Admin Digest").first()
    clean_url = (url or "").strip()
    if not clean_url:
        if endpoint:
            endpoint.enabled = False
            endpoint.save(update_fields=["enabled"])
        return

    defaults = {
        "url": clean_url,
        "enabled": enabled,
        "events": '["*"]',
        "format": "mattermost",
        "timeout_seconds": 30,
    }
    if endpoint:
        for key, value in defaults.items():
            setattr(endpoint, key, value)
        endpoint.save()
    else:
        WebhookEndpoint.objects.create(name="Mattermost Admin Digest", **defaults)


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
    if user.pk == request.user.pk:
        messages.error(request, "You cannot deactivate your own account.")
        return redirect("cms:users_list")
    if user.is_active and _is_last_active_admin(user):
        messages.error(request, "You cannot deactivate the last active admin.")
        return redirect("cms:users_list")
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    dispatch_event(
        "user.activation_toggled",
        {
            "user_id": user.id,
            "user_email": user.email,
            "is_active": user.is_active,
            "actor_id": request.user.id,
            "actor_email": request.user.email,
            "change_text": (
                f"{request.user.email} {'activated' if user.is_active else 'deactivated'} "
                f"user {user.email}."
            ),
            "content_url": _absolute_url(request, "cms:users_list"),
            "content_title": "User status updated",
        },
        source_info="cms.user_toggle_active",
    )
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
    if user.pk == request.user.pk and role != User.Role.ADMIN:
        messages.error(request, "You cannot remove your own admin role.")
        return redirect("cms:users_list")
    if role != User.Role.ADMIN and _is_last_active_admin(user):
        messages.error(request, "You cannot remove the last active admin.")
        return redirect("cms:users_list")
    old_role = user.role
    user.role = role
    user.is_staff = role in {User.Role.ADMIN, User.Role.SUPPORT}
    user.is_superuser = role == User.Role.ADMIN
    user.save(update_fields=["role", "is_staff", "is_superuser"])
    dispatch_event(
        "user.role_changed",
        {
            "user_id": user.id,
            "user_email": user.email,
            "old_role": old_role,
            "new_role": role,
            "actor_id": request.user.id,
            "actor_email": request.user.email,
            "change_text": (
                f"{request.user.email} changed {user.email}'s role from {old_role} to {role}."
            ),
            "content_url": _absolute_url(request, "cms:users_list"),
            "content_title": "User role changed",
        },
        source_info="cms.user_set_role",
    )
    messages.success(request, f"Role for {user.email} updated to {role}.")
    return redirect("cms:users_list")


def _is_last_active_admin(user: User) -> bool:
    if not user.is_active or not (user.is_admin or user.is_superuser):
        return False
    return (
        User.objects.filter(is_active=True)
        .filter(Q(role=User.Role.ADMIN) | Q(is_superuser=True))
        .count()
        <= 1
    )


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
            dispatch_event(
                "card.updated",
                {
                    "card_id": card.id,
                    "card_name": card.name,
                    "approved": card.approved,
                    "actor_id": request.user.id,
                    "actor_email": request.user.email,
                    "change_text": f"{request.user.email} updated card '{card.name}'.",
                    "content_url": _absolute_url(
                        request,
                        "directory:card_detail",
                        pk=card.id,
                        slug=slugify(card.name),
                    ),
                    "content_title": card.name,
                },
                source_info="cms.card_edit",
            )
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
    payload = {
        "card_id": card.id,
        "card_name": card.name,
        "actor_id": request.user.id,
        "actor_email": request.user.email,
        "change_text": f"{request.user.email} deleted card '{card.name}'.",
        "content_title": card.name,
    }
    card.delete()
    dispatch_event("card.deleted", payload, source_info="cms.card_delete")
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
    sub = get_object_or_404(CardSubmission.objects.select_related("submitter"), pk=pk)
    return render(request, "cms/submission_detail.html", {"submission": sub})


@staff_required
def modifications_list(request: HttpRequest) -> HttpResponse:
    status = request.GET.get("status") or CardSubmissionStatus.PENDING
    qs = (
        CardModification.objects.filter(status=status)
        .select_related("submitter", "card")
        .order_by("-created_date")
    )
    page = Paginator(qs, 20).get_page(request.GET.get("page"))
    return render(
        request,
        "cms/modifications_list.html",
        {"page_obj": page, "status": status, "statuses": CardSubmissionStatus.choices},
    )


@staff_required
def modification_detail(request: HttpRequest, pk: int) -> HttpResponse:
    modification = get_object_or_404(
        CardModification.objects.select_related("submitter", "card").prefetch_related("card__tags"),
        pk=pk,
    )
    comparison_rows = _modification_comparison_rows(modification)
    return render(
        request,
        "cms/modification_detail.html",
        {
            "modification": modification,
            "comparison_rows": comparison_rows,
            "changed_count": sum(1 for row in comparison_rows if row["changed"]),
        },
    )


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
    dispatch_event(
        "submission.approved",
        {
            "submission_id": sub.id,
            "submission_name": sub.name,
            "card_id": card.id,
            "card_name": card.name,
            "submitter_id": sub.submitter_id,
            "reviewer_id": request.user.id,
            "reviewer_email": request.user.email,
            "review_notes": sub.review_notes or "",
            "change_text": (
                f"{request.user.email} approved submission '{sub.name}' and published "
                f"'{card.name}'. Description: {sub.description or 'No description provided.'}"
            ),
            "content_url": _absolute_url(
                request, "directory:card_detail", pk=card.id, slug=slugify(card.name)
            ),
            "content_title": card.name,
        },
        source_info="cms.submission_approve",
    )
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
    dispatch_event(
        "submission.rejected",
        {
            "submission_id": sub.id,
            "submission_name": sub.name,
            "submitter_id": sub.submitter_id,
            "reviewer_id": request.user.id,
            "reviewer_email": request.user.email,
            "review_notes": sub.review_notes or "",
            "change_text": (
                f"{request.user.email} rejected submission '{sub.name}'. "
                f"Notes: {sub.review_notes or 'No notes provided.'}"
            ),
            "content_url": _absolute_url(request, "cms:submission_detail", pk=sub.id),
            "content_title": sub.name,
        },
        source_info="cms.submission_reject",
    )
    messages.info(request, "Submission rejected.")
    return redirect("cms:submissions_list")


@staff_required
@require_http_methods(["POST"])
def modification_approve(request: HttpRequest, pk: int) -> HttpResponse:
    mod = get_object_or_404(CardModification.objects.select_related("card"), pk=pk)
    if mod.status != CardSubmissionStatus.PENDING:
        messages.error(request, "Modification already reviewed.")
        return redirect("cms:modifications_list")

    card = mod.card
    changed_fields = modification_changed_fields(mod)
    card.name = mod.name
    card.description = mod.description
    card.website_url = mod.website_url
    card.phone_number = mod.phone_number
    card.email = mod.email
    card.address = mod.address
    card.address_override_url = mod.address_override_url
    card.contact_name = mod.contact_name
    card.image_url = mod.image_url
    card.approver = request.user
    card.approved = True
    card.approved_date = timezone.now()
    card.save()
    _replace_card_tags(card, _split_tags(mod.tags_text or ""))

    mod.status = CardSubmissionStatus.APPROVED
    mod.reviewer = request.user
    mod.reviewed_date = timezone.now()
    mod.review_notes = request.POST.get("review_notes", "")
    mod.save()

    dispatch_event(
        "modification.approved",
        {
            "modification_id": mod.id,
            "card_id": card.id,
            "card_name": card.name,
            "submitter_id": mod.submitter_id,
            "reviewer_id": request.user.id,
            "reviewer_email": request.user.email,
            "review_notes": mod.review_notes or "",
            "change_text": f"{request.user.email} approved {len(changed_fields)} change(s) for '{card.name}'.",
            "changed_fields": changed_fields,
            "content_url": _absolute_url(
                request, "directory:card_detail", pk=card.id, slug=slugify(card.name)
            ),
            "content_title": card.name,
        },
        source_info="cms.modification_approve",
    )
    messages.success(request, f"Approved updates for '{card.name}'.")
    return redirect("cms:modifications_list")


@staff_required
@require_http_methods(["POST"])
def modification_reject(request: HttpRequest, pk: int) -> HttpResponse:
    mod = get_object_or_404(CardModification, pk=pk)
    if mod.status != CardSubmissionStatus.PENDING:
        messages.error(request, "Modification already reviewed.")
        return redirect("cms:modifications_list")
    mod.status = CardSubmissionStatus.REJECTED
    mod.reviewer = request.user
    mod.reviewed_date = timezone.now()
    mod.review_notes = request.POST.get("review_notes", "")
    mod.save()
    dispatch_event(
        "modification.rejected",
        {
            "modification_id": mod.id,
            "card_id": mod.card_id,
            "card_name": mod.card.name,
            "submitter_id": mod.submitter_id,
            "reviewer_id": request.user.id,
            "reviewer_email": request.user.email,
            "review_notes": mod.review_notes or "",
            "change_text": (
                f"{request.user.email} rejected updates for '{mod.card.name}'. "
                f"Notes: {mod.review_notes or 'No notes provided.'}"
            ),
            "content_url": _absolute_url(request, "cms:modification_detail", pk=mod.id),
            "content_title": mod.card.name,
        },
        source_info="cms.modification_reject",
    )
    messages.info(request, "Modification rejected.")
    return redirect("cms:modifications_list")


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
    dispatch_event(
        "review.visibility_toggled",
        {
            "review_id": review.id,
            "card_id": review.card_id,
            "hidden": review.hidden,
            "actor_id": request.user.id,
            "actor_email": request.user.email,
            "change_text": (
                f"{request.user.email} {'hid' if review.hidden else 'unhid'} review #{review.id}."
            ),
            "content_url": _absolute_url(
                request,
                "directory:card_detail",
                pk=review.card_id,
                slug=slugify(review.card.name),
            ),
            "content_title": review.card.name,
        },
        source_info="cms.review_toggle_hidden",
    )
    messages.success(request, "Review visibility updated.")
    return redirect("cms:reviews_list")
