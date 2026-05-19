from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest.mock import Mock, patch


def _load_indexer_module():
    indexer_dir = Path(__file__).resolve().parent.parent / "indexer"
    sys.path.insert(0, str(indexer_dir))
    try:
        spec = importlib.util.spec_from_file_location(
            "cityforge_indexer", indexer_dir / "indexer.py"
        )
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path.pop(0)


def test_fetch_cards_sends_forwarded_proto_header() -> None:
    module = _load_indexer_module()
    indexer = module.ResourceIndexer(use_tracking=False)

    response = Mock()
    response.json.return_value = {"cards": [{"id": 1, "name": "Test"}]}
    response.raise_for_status.return_value = None

    with patch.object(module.requests, "get", return_value=response) as mocked_get:
        cards = indexer.fetch_cards()

    assert cards == [{"id": 1, "name": "Test"}]
    mocked_get.assert_called_once()
    assert mocked_get.call_args.kwargs["headers"]["X-Forwarded-Proto"] == "https"


def test_build_database_url_prefers_explicit_database_url() -> None:
    module = _load_indexer_module()

    with patch.dict(
        module.os.environ,
        {
            "DATABASE_URL": "postgresql://cityforge:secret@db.internal:5432/community_db",
            "POSTGRES_USER": "ignored-user",
            "POSTGRES_PASSWORD": "ignored-password",
            "POSTGRES_HOST": "ignored-host",
            "POSTGRES_PORT": "9999",
            "POSTGRES_DB": "ignored-db",
        },
        clear=False,
    ):
        indexer = module.ResourceIndexer(use_tracking=False)
        assert (
            indexer._build_database_url()
            == "postgresql://cityforge:secret@db.internal:5432/community_db"
        )


def test_build_database_url_falls_back_to_postgres_parts() -> None:
    module = _load_indexer_module()

    with patch.dict(
        module.os.environ,
        {
            "DATABASE_URL": "",
            "POSTGRES_USER": "cityforge",
            "POSTGRES_PASSWORD": "secret",
            "POSTGRES_HOST": "db.internal",
            "POSTGRES_PORT": "5433",
            "POSTGRES_DB": "community_db",
        },
        clear=False,
    ):
        indexer = module.ResourceIndexer(use_tracking=False)
        assert (
            indexer._build_database_url()
            == "postgresql://cityforge:secret@db.internal:5433/community_db"
        )


def test_scrape_page_content_extracts_same_site_links() -> None:
    module = _load_indexer_module()
    indexer = module.ResourceIndexer(use_tracking=False)
    response = Mock()
    response.url = "https://example.com/about"
    response.text = """
    <html>
      <head>
        <title>About Us</title>
        <meta name="description" content="About page">
      </head>
      <body>
        <p>Hello world</p>
        <a href="/services">Services</a>
        <a href="https://example.com/contact#team">Contact</a>
        <a href="https://other.example/offsite">Offsite</a>
      </body>
    </html>
    """
    response.raise_for_status.return_value = None

    with (
        patch.object(indexer, "is_url_allowed", return_value=True),
        patch.object(module.requests, "get", return_value=response),
    ):
        scraped = indexer.scrape_page_content("https://example.com/about")

    assert scraped["page_url"] == "https://example.com/about"
    assert scraped["page_title"] == "About Us"
    assert scraped["page_description"] == "About page"
    assert scraped["links"] == [
        "https://example.com/services",
        "https://example.com/contact",
    ]


def test_index_resource_indexes_each_crawled_page_with_page_url() -> None:
    module = _load_indexer_module()
    indexer = module.ResourceIndexer(use_tracking=False)
    indexer.client = Mock()

    with patch.object(
        indexer,
        "scrape_site_pages",
        return_value=[
            {
                "page_title": "Example Home",
                "page_description": "Homepage",
                "content": "Welcome to the homepage",
                "page_url": "https://example.com/",
                "links": ["https://example.com/about"],
            },
            {
                "page_title": "About Example",
                "page_description": "About page",
                "content": "This is the content we searched for",
                "page_url": "https://example.com/about",
                "links": [],
            },
        ],
    ):
        indexer.index_resource(
            {
                "id": 42,
                "name": "Example Co",
                "description": "Directory description",
                "website_url": "https://example.com/",
                "phone_number": "555-0100",
                "address": "123 Main St",
            }
        )

    indexer.client.delete_by_query.assert_called_once_with(
        index="default-resources",
        body={"query": {"term": {"resource_id": 42}}},
        conflicts="proceed",
        refresh=True,
    )
    assert indexer.client.index.call_count == 2

    homepage_call = indexer.client.index.call_args_list[0]
    assert homepage_call.kwargs["id"] == "resource_42"
    assert homepage_call.kwargs["body"]["page_url"] == "https://example.com/"
    assert homepage_call.kwargs["body"]["url"] == "https://example.com/"
    assert homepage_call.kwargs["body"]["is_homepage"] is True

    subpage_call = indexer.client.index.call_args_list[1]
    assert subpage_call.kwargs["id"].startswith("resource_42_")
    assert subpage_call.kwargs["body"]["page_url"] == "https://example.com/about"
    assert subpage_call.kwargs["body"]["url"] == "https://example.com/"
    assert subpage_call.kwargs["body"]["is_homepage"] is False
