from __future__ import annotations

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.test.client import RequestFactory
from django.urls import reverse
from PIL import Image

from apps.accounts.models import User
from apps.directory.models import Card, CardSubmission, CardSubmissionStatus, CardTag, Review, Tag
from apps.directory.views import _safe_int, _split_tags, home


def _uploaded_png() -> SimpleUploadedFile:
    image = BytesIO()
    Image.new("RGB", (1, 1), "white").save(image, format="PNG")
    return SimpleUploadedFile(
        "business.png",
        image.getvalue(),
        content_type="image/png",
    )


class CardSubmissionUploadTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "submitter@example.com",
            "password",
            first_name="Submitter",
            last_name="User",
            email_verified=True,
        )

    def test_business_submission_upload_saves_image_in_media_root(self) -> None:
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                self.client.force_login(self.user)
                response = self.client.post(
                    reverse("directory:card_submit"),
                    {
                        "name": "Uploaded Business",
                        "description": "Business with a photo",
                        "tags_text": "coffee, bakery",
                        "image": _uploaded_png(),
                    },
                )

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.headers["Location"], reverse("directory:home"))
                submission = CardSubmission.objects.get(name="Uploaded Business")
                self.assertEqual(submission.status, CardSubmissionStatus.PENDING)
                self.assertTrue(submission.image_url.startswith("/media/business-submissions/"))
                saved_path = Path(media_root) / submission.image_url.removeprefix("/media/")
                self.assertTrue(saved_path.exists())

    @override_settings(MEDIA_URL="/media/")
    def test_submission_approval_copies_uploaded_image_to_card(self) -> None:
        admin = User.objects.create_superuser(
            "admin@example.com",
            "password",
            first_name="Admin",
            last_name="User",
        )
        submission = CardSubmission.objects.create(
            name="Ready Business",
            submitter=self.user,
            image_url="/media/business-submissions/example.png",
            status=CardSubmissionStatus.PENDING,
        )

        self.client.force_login(admin)
        response = self.client.post(reverse("cms:submission_approve", args=[submission.pk]))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:submissions_list"))
        submission.refresh_from_db()
        self.assertEqual(submission.card.image_url, "/media/business-submissions/example.png")


class DirectoryViewTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "reviewer@example.com",
            "ReviewPass!123",
            first_name="Review",
            last_name="User",
            email_verified=True,
        )
        self.tag_a = Tag.objects.create(name="coffee")
        self.tag_b = Tag.objects.create(name="bakery")
        self.card_a = Card.objects.create(name="Alpha Coffee", approved=True, featured=True)
        self.card_b = Card.objects.create(name="Beta Bakery", approved=True, featured=False)
        CardTag.objects.create(card=self.card_a, tag=self.tag_a)
        CardTag.objects.create(card=self.card_b, tag=self.tag_b)

    def test_helpers_split_tags_and_safe_int(self) -> None:
        self.assertEqual(_split_tags("a, b; c"), ["a", "b", "c"])
        self.assertEqual(_safe_int("500", default=10, minimum=1, maximum=100), 100)
        self.assertEqual(_safe_int("bad", default=10, minimum=1, maximum=100), 10)

    def test_home_filters_by_featured_and_tags(self) -> None:
        request = RequestFactory().get("/", {"featured": "1", "tag": ["coffee"]})
        request.user = self.user
        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        with override_settings(PAGINATION_DEFAULT_LIMIT=24):
            from unittest.mock import patch

            with patch("apps.directory.views.render", side_effect=fake_render):
                response = home(request)

        self.assertEqual(response.status_code, 200)
        card_names = [card.name for card in captured["cards"]]
        self.assertEqual(card_names, ["Alpha Coffee"])

    def test_card_detail_redirects_to_canonical_slug(self) -> None:
        response = self.client.get(reverse("directory:card_detail_short", args=[self.card_a.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.card_a.slug, response.headers["Location"])

    def test_submit_review_creates_review(self) -> None:
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("directory:submit_review", args=[self.card_a.pk]),
            {"rating": "5", "title": "Great", "comment": "Excellent service"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Review.objects.filter(card=self.card_a, user=self.user).exists())

    def test_duplicate_review_is_rejected(self) -> None:
        Review.objects.create(card=self.card_a, user=self.user, rating=5)
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("directory:submit_review", args=[self.card_a.pk]),
            {"rating": "4", "title": "Again", "comment": "Second"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Review.objects.filter(card=self.card_a, user=self.user).count(), 1)

    def test_my_submissions_requires_authentication(self) -> None:
        response = self.client.get(reverse("directory:my_submissions"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("accounts:login"), response.headers["Location"])
