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
