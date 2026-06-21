from __future__ import annotations

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from apps.accounts.models import User
from apps.directory.models import Card, CardSubmission, CardSubmissionStatus, CardTag, Review, Tag

pytestmark = pytest.mark.e2e


def _uploaded_png() -> SimpleUploadedFile:
    image = BytesIO()
    Image.new("RGB", (1, 1), "white").save(image, format="PNG")
    return SimpleUploadedFile("flow.png", image.getvalue(), content_type="image/png")


def _set_captcha(client, scope: str, answer: str = "7") -> str:
    session = client.session
    session[f"accounts_captcha:{scope}:prompt"] = "What is 3 + 4?"
    session[f"accounts_captcha:{scope}:answer"] = answer
    session.save()
    return answer


class CriticalJourneyE2ETests(TestCase):
    def test_register_login_and_review_flow(self) -> None:
        card = Card.objects.create(name="Flow Coffee", approved=True)
        captcha_answer = _set_captcha(self.client, "register")
        with patch("apps.accounts.views._send_verification_email"):
            response = self.client.post(
                reverse("accounts:register"),
                {
                    "email": "journey@example.com",
                    "first_name": "Journey",
                    "last_name": "User",
                    "password1": "JourneyPass!123",
                    "password2": "JourneyPass!123",
                    "captcha_answer": captcha_answer,
                },
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))

        detail = self.client.get(reverse("directory:card_detail_short", args=[card.pk]))
        self.assertEqual(detail.status_code, 302)
        review_post = self.client.post(
            reverse("directory:submit_review", args=[card.pk]),
            {"rating": "5", "title": "Great", "comment": "Loved it"},
        )
        self.assertEqual(review_post.status_code, 302)
        self.assertTrue(Review.objects.filter(card=card, rating=5).exists())

    def test_directory_api_and_detail_journey(self) -> None:
        user = User.objects.create_user(
            "filter@example.com", "FilterPass!123", first_name="Filter", last_name="User"
        )
        coffee = Tag.objects.create(name="coffee")
        bakery = Tag.objects.create(name="bakery")
        featured = Card.objects.create(name="Featured Coffee", approved=True, featured=True)
        regular = Card.objects.create(name="Regular Bakery", approved=True, featured=False)
        CardTag.objects.create(card=featured, tag=coffee)
        CardTag.objects.create(card=regular, tag=bakery)

        self.client.force_login(user)
        api_response = self.client.get("/api/cards/", {"limit": "10"})
        self.assertEqual(api_response.status_code, 200)
        self.assertEqual(len(api_response.json()["cards"]), 2)

        detail_redirect = self.client.get(
            reverse("directory:card_detail_short", args=[featured.pk])
        )
        self.assertEqual(detail_redirect.status_code, 302)
        self.assertIn(featured.slug, detail_redirect.headers["Location"])

    @override_settings(MEDIA_URL="/media/")
    def test_submission_to_approval_journey(self) -> None:
        user = User.objects.create_user(
            "submitter-flow@example.com",
            "SubmitPass!123",
            first_name="Submitter",
            last_name="Flow",
        )
        admin = User.objects.create_superuser("admin-flow@example.com", "AdminPass!123")
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                self.client.force_login(user)
                submit = self.client.post(
                    reverse("directory:card_submit"),
                    {
                        "name": "Flow Submission",
                        "description": "End to end submission",
                        "tags_text": "coffee, featured",
                        "image": _uploaded_png(),
                    },
                )
                self.assertEqual(submit.status_code, 302)
                self.assertEqual(submit.headers["Location"], reverse("directory:home"))
                submission = CardSubmission.objects.get(name="Flow Submission")
                self.assertEqual(submission.status, CardSubmissionStatus.PENDING)
                image_url = submission.image_url or ""
                saved_path = Path(media_root) / image_url.removeprefix("/media/")
                self.assertTrue(saved_path.exists())

                self.client.force_login(admin)
                approve = self.client.post(reverse("cms:submission_approve", args=[submission.pk]))
                self.assertEqual(approve.status_code, 302)
                self.assertEqual(approve.headers["Location"], reverse("cms:submissions_list"))
                submission.refresh_from_db()
                self.assertEqual(submission.status, CardSubmissionStatus.APPROVED)
                self.assertTrue(Card.objects.filter(name="Flow Submission", approved=True).exists())
