"""Link verification must not depend on the host's default text codepage."""
import json
from pathlib import Path

import pytest
from scripts import check_links


@pytest.fixture
def fixture_repo(tmp_path, monkeypatch):
    root = tmp_path / "repo"
    archive = root / "archive" / "2026-10-14-pre-native"
    archive.mkdir(parents=True)
    (archive / "manifest.json").write_text(json.dumps({"files": [{"original_path": "retained.md", "retained_active_unchanged": True}]}), encoding="utf-8")
    (root / "retained.md").write_text("[historical](missing-historical.md)", encoding="utf-8")
    (root / "target.md").write_text("Target", encoding="utf-8")
    (root / "active.md").write_text("Curly quote: \u201d [target](target.md) [heading](#intro) [external](https://example.invalid)", encoding="utf-8")
    monkeypatch.setattr(check_links, "ROOT", root)
    monkeypatch.setattr(check_links.subprocess, "check_output", lambda *args, **kwargs: b"active.md\0retained.md\0target.md\0")
    original = Path.read_text
    def legacy_default(path, encoding=None, errors=None):
        return original(path, encoding=encoding or "cp1252", errors=errors)
    monkeypatch.setattr(Path, "read_text", legacy_default)
    return root


def test_utf8_links_work_with_legacy_host_default(fixture_repo):
    assert check_links.check() == 1


def test_utf8_fix_does_not_hide_broken_links(fixture_repo):
    (fixture_repo / "active.md").write_text("Curly quote: \u201d [bad](missing.md)", encoding="utf-8")
    with pytest.raises(ValueError, match="Broken internal link"):
        check_links.check()


def test_invalid_utf8_is_rejected_not_silently_replaced(fixture_repo):
    (fixture_repo / "active.md").write_bytes(b"invalid\xff [target](target.md)")
    with pytest.raises(UnicodeDecodeError):
        check_links.check()
