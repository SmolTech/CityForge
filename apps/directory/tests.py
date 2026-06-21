from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import OperationalError
from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.test.client import RequestFactory
from django.urls import reverse
from PIL import Image

from apps.accounts.auth import issue_mobile_auth_token
from apps.accounts.models import User
from apps.directory.models import (
    Card,
    CardModification,
    CardSubmission,
    CardSubmissionStatus,
    CardTag,
    Review,
    Tag,
)
from apps.directory.views import _safe_int, _split_tags, card_detail, home
from apps.resources.models import ResourceItem


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
                with patch("apps.directory.views.dispatch_event") as mocked_dispatch:
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
                assert submission.image_url is not None
                self.assertTrue(submission.image_url.startswith("/media/business-submissions/"))
                saved_path = Path(media_root) / submission.image_url.removeprefix("/media/")
                self.assertTrue(saved_path.exists())
                mocked_dispatch.assert_called_once()
                self.assertEqual(mocked_dispatch.call_args.args[0], "submission.created")
                payload = mocked_dispatch.call_args.args[1]
                self.assertIn("submitted new business", payload["change_text"])
                self.assertIn(str(submission.id), payload["content_url"])

    def test_uploaded_submission_image_is_served_through_media_route(self) -> None:
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, DEBUG=True):
                self.client.force_login(self.user)
                with patch("apps.directory.views.dispatch_event"):
                    response = self.client.post(
                        reverse("directory:card_submit"),
                        {
                            "name": "Served Business",
                            "description": "Business with a photo",
                            "tags_text": "coffee, bakery",
                            "image": _uploaded_png(),
                        },
                    )

                self.assertEqual(response.status_code, 302)
                submission = CardSubmission.objects.get(name="Served Business")

                assert submission.image_url is not None
                image_response = self.client.get(submission.image_url)
                self.assertEqual(image_response.status_code, 200)
                self.assertEqual(image_response.headers["Content-Type"], "image/png")

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
        assert submission.card is not None
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
        self.resource = ResourceItem.objects.create(
            title="Community Clinic",
            url="https://clinic.example",
            description="Free health services for residents.",
            category="Health",
            icon="hospital",
            is_active=True,
        )

    def test_helpers_split_tags_and_safe_int(self) -> None:
        self.assertEqual(_split_tags("a, b; c"), ["a", "b", "c"])
        self.assertEqual(_safe_int("500", default=10, minimum=1, maximum=100), 100)
        self.assertEqual(_safe_int("bad", default=10, minimum=1, maximum=100), 10)

    @override_settings(
        DEBUG=False,
        ALLOWED_HOSTS=[
            "cityforge-service",
            "cityforge-service.cityforge",
            "cityforge-service.cityforge.svc",
            "cityforge-service.cityforge.svc.cluster.local",
        ],
        SECURE_SSL_REDIRECT=True,
        USE_X_FORWARDED_HOST=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
    )
    def test_cards_api_allows_internal_service_host(self) -> None:
        response = self.client.get(
            "/api/cards/",
            {"limit": "10"},
            HTTP_HOST="cityforge-service.cityforge",
            HTTP_X_FORWARDED_PROTO="https",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["cards"]), 2)

    def test_cards_api_includes_tags_and_supports_tag_filter(self) -> None:
        response = self.client.get("/api/cards/", {"tags": "coffee"})

        self.assertEqual(response.status_code, 200)
        cards = response.json()["cards"]
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["name"], "Alpha Coffee")
        self.assertEqual(cards[0]["tags"], ["coffee"])

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

    def test_home_gracefully_handles_database_outage(self) -> None:
        with patch("apps.directory.views.Card.objects.filter", side_effect=OperationalError):
            response = self.client.get(reverse("directory:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "temporarily unavailable")

    def test_home_renders_scaled_business_image_thumbnail(self) -> None:
        self.card_a.image_url = "https://images.example/alpha.jpg"
        self.card_a.save(update_fields=["image_url"])

        response = self.client.get(reverse("directory:home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="card-thumbnail"', html=False)
        self.assertContains(response, 'src="https://images.example/alpha.jpg"', html=False)

    def test_home_ignores_unsafe_business_image_url(self) -> None:
        self.card_a.image_url = "javascript:alert(1)"
        self.card_a.save(update_fields=["image_url"])

        response = self.client.get(reverse("directory:home"))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'src="javascript:alert(1)"', html=False)

    def test_api_opensearch_falls_back_to_local_resources_when_search_unavailable(self) -> None:
        with patch("apps.search.views._client", return_value=None):
            response = self.client.get("/api/cards/search/", {"q": "clinic"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["source"], "local")
        self.assertEqual(body["results"][0]["title"], self.resource.title)
        self.assertEqual(body["results"][0]["url"], self.resource.url)

    def test_api_opensearch_collapses_results_by_business(self) -> None:
        with patch("apps.search.views._client") as client_factory:
            client_factory.return_value.search.return_value = {
                "aggregations": {"resource_count": {"value": 1}},
                "hits": {
                    "total": {"value": 2},
                    "hits": [
                        {
                            "_score": 5.1,
                            "_source": {
                                "business_name": "Alpha Coffee",
                                "title": "About Alpha Coffee",
                                "content": "Fresh coffee and pastries all day",
                                "page_url": "https://alpha.example/about",
                            },
                        }
                    ],
                },
            }

            response = self.client.get("/api/cards/search/", {"q": "alpha"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["results"][0]["title"], "About Alpha Coffee")
        self.assertEqual(body["results"][0]["url"], "https://alpha.example/about")

        search_body = client_factory.return_value.search.call_args.kwargs["body"]
        self.assertEqual(search_body["collapse"], {"field": "resource_id"})
        self.assertEqual(
            search_body["aggs"]["resource_count"]["cardinality"]["field"],
            "resource_id",
        )

    def test_card_detail_redirects_to_canonical_slug(self) -> None:
        response = self.client.get(reverse("directory:card_detail_short", args=[self.card_a.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.card_a.slug, response.headers["Location"])

    def test_card_detail_displays_all_collected_business_fields(self) -> None:
        self.card_a.description = "Specialty coffee and pastries"
        self.card_a.website_url = "https://alpha.example"
        self.card_a.phone_number = "555-0100"
        self.card_a.email = "hello@alpha.example"
        self.card_a.address = "1 Main Street"
        self.card_a.address_override_url = "https://maps.example/alpha"
        self.card_a.contact_name = "Taylor Owner"
        self.card_a.image_url = "https://images.example/alpha.jpg"
        self.card_a.save(
            update_fields=[
                "description",
                "website_url",
                "phone_number",
                "email",
                "address",
                "address_override_url",
                "contact_name",
                "image_url",
            ]
        )

        request = RequestFactory().get(
            reverse("directory:card_detail", args=[self.card_a.pk, self.card_a.slug])
        )
        request.user = self.user
        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        with patch("apps.directory.views.render", side_effect=fake_render):
            response = card_detail(request, pk=self.card_a.pk, slug=self.card_a.slug)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["card"].name, "Alpha Coffee")
        self.assertEqual(captured["card"].description, "Specialty coffee and pastries")
        self.assertEqual(captured["card"].website_url, "https://alpha.example")
        self.assertEqual(captured["card"].phone_number, "555-0100")
        self.assertEqual(captured["card"].email, "hello@alpha.example")
        self.assertEqual(captured["card"].address, "1 Main Street")
        self.assertEqual(captured["card"].address_override_url, "https://maps.example/alpha")
        self.assertEqual(captured["card"].contact_name, "Taylor Owner")
        self.assertEqual(captured["card"].image_url, "https://images.example/alpha.jpg")
        self.assertEqual(list(captured["card"].tags.values_list("name", flat=True)), ["coffee"])

    def test_card_detail_renders_image_before_about_section(self) -> None:
        self.card_a.description = "Specialty coffee and pastries"
        self.card_a.image_url = "https://images.example/alpha.jpg"
        self.card_a.save(update_fields=["description", "image_url"])

        response = self.client.get(
            reverse("directory:card_detail", args=[self.card_a.pk, self.card_a.slug])
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            'src="https://images.example/alpha.jpg"',
            html=False,
        )
        self.assertContains(response, "<h2>About</h2>", html=False)
        self.assertLess(
            response.content.decode().index('src="https://images.example/alpha.jpg"'),
            response.content.decode().index("<h2>About</h2>"),
        )

    def test_submit_review_creates_review(self) -> None:
        self.client.force_login(self.user)
        with patch("apps.directory.views.dispatch_event") as mocked_dispatch:
            response = self.client.post(
                reverse("directory:submit_review", args=[self.card_a.pk]),
                {"rating": "5", "title": "Great", "comment": "Excellent service"},
            )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Review.objects.filter(card=self.card_a, user=self.user).exists())
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "review.created")
        payload = mocked_dispatch.call_args.args[1]
        self.assertIn("posted a 5-star review", payload["change_text"])
        self.assertIn(str(self.card_a.id), payload["content_url"])

    def test_duplicate_review_is_rejected(self) -> None:
        Review.objects.create(card=self.card_a, user=self.user, rating=5)
        self.client.force_login(self.user)
        with patch("apps.directory.views.dispatch_event") as mocked_dispatch:
            response = self.client.post(
                reverse("directory:submit_review", args=[self.card_a.pk]),
                {"rating": "4", "title": "Again", "comment": "Second"},
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Review.objects.filter(card=self.card_a, user=self.user).count(), 1)
        mocked_dispatch.assert_not_called()

    def test_my_submissions_requires_authentication(self) -> None:
        response = self.client.get(reverse("directory:my_submissions"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("accounts:login"), response.headers["Location"])

    def test_card_update_submit_requires_authentication(self) -> None:
        response = self.client.get(reverse("directory:card_update_submit", args=[self.card_a.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("accounts:login"), response.headers["Location"])

    def test_card_update_submit_creates_pending_modification(self) -> None:
        self.client.force_login(self.user)
        with patch("apps.directory.views.dispatch_event") as mocked_dispatch:
            response = self.client.post(
                reverse("directory:card_update_submit", args=[self.card_a.pk]),
                {
                    "name": "Alpha Coffee Roasters",
                    "description": "Updated description",
                    "website_url": "https://alpha.example",
                    "phone_number": "555-0100",
                    "email": "hello@alpha.example",
                    "address": "1 Main Street",
                    "address_override_url": "",
                    "contact_name": "Owner",
                    "tags_text": "coffee,roasters",
                },
            )
        self.assertEqual(response.status_code, 302)
        modification = CardModification.objects.get(card=self.card_a, submitter=self.user)
        self.assertEqual(modification.status, CardSubmissionStatus.PENDING)
        self.assertEqual(modification.name, "Alpha Coffee Roasters")
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "modification.created")
        payload = mocked_dispatch.call_args.args[1]
        self.assertIn("changed_fields", payload)
        changed_names = {item["field"] for item in payload["changed_fields"]}
        self.assertIn("Name", changed_names)
        self.assertIn("Description", changed_names)
        name_change = next(item for item in payload["changed_fields"] if item["field"] == "Name")
        self.assertEqual(name_change["old_value"], "Alpha Coffee")
        self.assertEqual(name_change["new_value"], "Alpha Coffee Roasters")

    def test_api_submissions_create_and_list_user_history(self) -> None:
        self.client.force_login(self.user)
        with patch("apps.directory.views.dispatch_event"):
            create_response = self.client.post(
                "/api/submissions",
                data=json.dumps(
                    {
                        "name": "Mobile Submission",
                        "description": "Submitted from the app",
                        "websiteUrl": "https://mobile.example",
                        "phoneNumber": "555-0199",
                        "email": "hello@mobile.example",
                        "address": "10 Main Street",
                        "contactName": "Casey",
                        "imageUrl": "https://mobile.example/image.jpg",
                        "tagsText": "coffee,local",
                    }
                ),
                content_type="application/json",
            )
            edit_response = self.client.post(
                f"/api/cards/{self.card_a.pk}/suggest-edit",
                data=json.dumps(
                    {
                        "name": "Alpha Coffee Roasters",
                        "description": "Updated description",
                        "websiteUrl": "https://alpha.example",
                        "phoneNumber": "555-0100",
                        "email": "hello@alpha.example",
                        "address": "1 Main Street",
                        "contactName": "Owner",
                        "tagsText": "coffee,roasters",
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(edit_response.status_code, 201)
        self.assertEqual(CardSubmission.objects.filter(name="Mobile Submission").count(), 1)
        self.assertTrue(
            CardModification.objects.filter(
                card=self.card_a,
                submitter=self.user,
                name="Alpha Coffee Roasters",
            ).exists()
        )

        history_response = self.client.get("/api/submissions")
        self.assertEqual(history_response.status_code, 200)
        history = history_response.json()
        self.assertEqual([item["kind"] for item in history], ["modification", "submission"])
        self.assertEqual(history[0]["name"], "Alpha Coffee Roasters")
        self.assertEqual(history[1]["name"], "Mobile Submission")

    def test_api_submissions_accepts_multipart_image_upload(self) -> None:
        self.client.force_login(self.user)
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                with patch("apps.directory.views.dispatch_event"):
                    response = self.client.post(
                        "/api/submissions",
                        {
                            "name": "Mobile Upload",
                            "description": "Sent with image file",
                            "tagsText": "coffee,local",
                            "image": _uploaded_png(),
                        },
                    )

                self.assertEqual(response.status_code, 201)
                submission = CardSubmission.objects.get(name="Mobile Upload")
                assert submission.image_url is not None
                self.assertTrue(submission.image_url.startswith("/media/business-submissions/"))
                saved_path = Path(media_root) / submission.image_url.removeprefix("/media/")
                self.assertTrue(saved_path.exists())


class DirectoryApiBearerAuthTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "bearer@example.com",
            "BearerPass!123",
            first_name="Bearer",
            last_name="User",
            email_verified=True,
        )
        self.token = issue_mobile_auth_token(self.user)

    def _auth_header(self) -> dict[str, str]:
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def test_api_submissions_accepts_bearer_token(self) -> None:
        response = self.client.get("/api/submissions", **self._auth_header())  # type: ignore[arg-type]
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_api_submissions_rejects_anonymous(self) -> None:
        response = self.client.get("/api/submissions")
        self.assertEqual(response.status_code, 401)

    def test_api_suggest_edit_accepts_bearer_token(self) -> None:
        card = Card.objects.create(name="Suggestable", approved=True)
        response = self.client.post(
            f"/api/cards/{card.pk}/suggest-edit",
            data=json.dumps(
                {
                    "name": "Suggested Name",
                    "description": "Suggested description",
                    "tagsText": "coffee",
                }
            ),
            content_type="application/json",
            **self._auth_header(),  # type: ignore[arg-type]
        )
        self.assertEqual(response.status_code, 201)
        modification = CardModification.objects.get(card=card)
        self.assertEqual(modification.submitter, self.user)


class DirectorySearchApiTests(TestCase):
    def test_api_search_returns_matching_cards(self) -> None:
        Card.objects.create(name="Alpha Coffee", approved=True, description="Great coffee")
        Card.objects.create(name="Beta Bakery", approved=True, description="Fresh bread")
        Card.objects.create(name="Hidden", approved=False, description="Great coffee")

        response = self.client.get("/api/search?q=coffee")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Alpha Coffee")
        self.assertEqual(data[0]["score"], 1.0)

    def test_api_search_empty_query(self) -> None:
        response = self.client.get("/api/search")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])


class CardReviewApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "reviewer@example.com",
            "ReviewPass!123",
            first_name="Review",
            last_name="User",
            email_verified=True,
        )
        self.card = Card.objects.create(name="Reviewable Cafe", approved=True)

    def test_list_reviews_with_summary(self) -> None:
        Review.objects.create(card=self.card, user=self.user, rating=5, title="Great")
        Review.objects.create(
            card=self.card,
            user=User.objects.create_user(
                "other@example.com", "OtherPass!123", first_name="Other", last_name="User"
            ),
            rating=3,
        )
        Review.objects.create(card=self.card, user=self.user, rating=1, hidden=True)

        response = self.client.get(f"/api/cards/{self.card.pk}/reviews")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["reviews"]), 2)
        self.assertEqual(data["summary"]["total_reviews"], 2)
        self.assertEqual(data["summary"]["average_rating"], 4.0)
        self.assertEqual(data["summary"]["rating_distribution"]["5"], 1)
        self.assertEqual(data["summary"]["rating_distribution"]["3"], 1)

    def test_create_review_requires_auth(self) -> None:
        response = self.client.post(
            f"/api/cards/{self.card.pk}/reviews",
            data=json.dumps({"rating": 5}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    def test_create_review(self) -> None:
        self.client.force_login(self.user)
        response = self.client.post(
            f"/api/cards/{self.card.pk}/reviews",
            data=json.dumps({"rating": 4, "title": "Good", "comment": "Nice place"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["rating"], 4)
        self.assertEqual(data["title"], "Good")
        self.assertEqual(Review.objects.filter(card=self.card).count(), 1)

    def test_create_review_invalid_rating(self) -> None:
        self.client.force_login(self.user)
        response = self.client.post(
            f"/api/cards/{self.card.pk}/reviews",
            data=json.dumps({"rating": 6}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
