from __future__ import annotations

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from apps.accounts.models import User
from apps.directory.models import CardSubmission, CardSubmissionStatus


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
