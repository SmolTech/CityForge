from __future__ import annotations

from unittest.mock import Mock, patch

from django.http import HttpResponse
from django.test import TestCase
from django.test.client import RequestFactory

from apps.search.views import _safe_int, search


class SearchViewTests(TestCase):
    def test_safe_int_bounds(self) -> None:
        self.assertEqual(_safe_int("9", default=1, minimum=1, maximum=5), 5)
        self.assertEqual(_safe_int("-3", default=1, minimum=1, maximum=5), 1)
        self.assertEqual(_safe_int("bad", default=4, minimum=1, maximum=5), 4)

    def test_search_without_query_returns_empty_state(self) -> None:
        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        request = RequestFactory().get("/search/")
        with patch("apps.search.views.render", side_effect=fake_render):
            response = search(request)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(captured["results"])

    @patch("apps.search.views._client", return_value=None)
    def test_search_without_opensearch_client_sets_error(self, _client_mock: Mock) -> None:
        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        request = RequestFactory().get("/search/", {"q": "city"})
        with patch("apps.search.views.render", side_effect=fake_render):
            response = search(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("not configured", captured["error"])
        self.assertEqual(captured["results"], [])

    @patch("apps.search.views._client")
    def test_search_parses_hits(self, client_factory: Mock) -> None:
        fake_client = Mock()
        fake_client.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [
                    {
                        "_score": 3.2,
                        "_source": {
                            "title": "Result Title",
                            "description": "Desc",
                            "content": "Body content",
                            "url": "https://example.com",
                            "domain": "example.com",
                            "category": "guides",
                        },
                        "highlight": {"title": ["<em>Result</em> Title"]},
                    }
                ],
            }
        }
        client_factory.return_value = fake_client

        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        request = RequestFactory().get("/search/", {"q": "result", "page": "1", "size": "20"})
        with patch("apps.search.views.render", side_effect=fake_render):
            response = search(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["total"], 1)
        self.assertEqual(len(captured["results"]), 1)
        self.assertEqual(captured["results"][0]["title"], "Result Title")

    @patch("apps.search.views._client")
    def test_search_prefers_page_url_when_present(self, client_factory: Mock) -> None:
        fake_client = Mock()
        fake_client.search.return_value = {
            "hits": {
                "total": {"value": 1},
                "hits": [
                    {
                        "_score": 3.2,
                        "_source": {
                            "title": "Result Title",
                            "description": "Desc",
                            "content": "Body content",
                            "url": "https://example.com/",
                            "page_url": "https://example.com/about",
                            "domain": "example.com",
                            "category": "guides",
                        },
                        "highlight": {},
                    }
                ],
            }
        }
        client_factory.return_value = fake_client

        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        request = RequestFactory().get("/search/", {"q": "result"})
        with patch("apps.search.views.render", side_effect=fake_render):
            response = search(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["results"][0]["url"], "https://example.com/about")

    @patch("apps.search.views._client")
    def test_search_handles_backend_exception(self, client_factory: Mock) -> None:
        fake_client = Mock()
        fake_client.search.side_effect = RuntimeError("backend down")
        client_factory.return_value = fake_client
        captured: dict = {}

        def fake_render(_request, _template, context):
            captured.update(context)
            return HttpResponse("ok")

        request = RequestFactory().get("/search/", {"q": "result"})
        with patch("apps.search.views.render", side_effect=fake_render):
            response = search(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("backend unavailable", captured["error"])
