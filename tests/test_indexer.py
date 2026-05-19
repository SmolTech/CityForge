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
