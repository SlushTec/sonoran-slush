"""Read-only staff comparison of disconnected commercial test fixtures."""
from contextlib import contextmanager
from hashlib import sha256
import os
from pathlib import Path
import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from services.commerce.app.commercial_snapshots import (
    SCOPE, SnapshotRef, qualified_set, read_set, read_snapshot,
)
from services.commerce.app.retail import Key, retail_enabled
from services.commerce.app.workflows import ROOT, StrictModel, enabled, staff

router = APIRouter(prefix="/v1/admin/retail-test/commercial/compare",
                   tags=["commercial test fixtures"],
                   dependencies=[Depends(retail_enabled), Depends(staff)])
UNQUALIFIED = ["options", "tax", "machine_profiles", "owner_identity", "production"]


class SnapshotComparison(StrictModel):
    before: SnapshotRef
    after: SnapshotRef


class SetComparison(StrictModel):
    before: Key
    after: Key


@contextmanager
def read_database():
    """Never initializes a database, schema, fingerprint or journal mode."""
    enabled()
    path = Path(os.environ.get("SONORAN_DB_PATH") or str(ROOT / ".state" / "commerce.sqlite3"))
    if not path.is_file():
        raise HTTPException(404, "Commercial fixture database not found.")
    db = None
    try:
        db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5,
                             isolation_level=None)
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {"metadata", "fixture_commercial_snapshots", "fixture_commercial_sets"} <= tables:
            raise HTTPException(409, "Commercial fixture registry is not initialized.")
        old = db.execute("SELECT value FROM metadata WHERE key='access_secret_fingerprint'").fetchone()
        expected = sha256(os.environ["SONORAN_ACCESS_SECRET"].encode()).hexdigest()
        if (not old or not isinstance(old[0], str) or len(old[0]) != 64
                or any(c not in '0123456789abcdef' for c in old[0])
                or not secrets.compare_digest(old[0], expected)):
            raise HTTPException(503, "The record service needs its existing access configuration restored.")
        yield db
    except sqlite3.DatabaseError as exc:
        raise HTTPException(409, "Commercial fixture storage needs reconciliation.") from exc
    finally:
        if db is not None:
            db.close()


def compare_documents(before, after):
    if before["kind"] != after["kind"]:
        raise HTTPException(409, "Compare snapshots of the same commercial kind.")
    kind = before["kind"]
    keys = {"catalog": ("product_slug",), "prices": ("product_slug", "variant_key"),
            "policies": ("policy_key",)}[kind]
    def indexed(doc):
        return {tuple(row[k] for k in keys): row for row in doc["rows"]}
    left, right = indexed(before), indexed(after)
    changes = []
    for key in sorted(left.keys() | right.keys()):
        old, new = left.get(key), right.get(key)
        if old == new:
            continue
        change = {"key": dict(zip(keys, key)), "change": "added" if old is None else
                  "removed" if new is None else "changed", "before": old, "after": new}
        if kind == "prices":
            change["unit_price_delta_minor"] = (new["unit_price_minor"] - old["unit_price_minor"]
                                                if old is not None and new is not None else None)
        changes.append(change)
    fields = ("id", "revision", "kind", "source_reference", "status", "lifecycle_version")
    return {"before": {k: before[k] for k in fields}, "after": {k: after[k] for k in fields},
            "rows_changed": bool(changes), "changes": changes,
            "lifecycle_changed": before["status"] != after["status"] or
                                 before["lifecycle_version"] != after["lifecycle_version"]}


@router.post("/snapshots")
def compare_snapshots(body: SnapshotComparison):
    with read_database() as db:
        before = read_snapshot(db, body.before.snapshot_id, body.before.revision)
        after = read_snapshot(db, body.after.snapshot_id, body.after.revision)
        result = compare_documents(before, after)
    return {**result, "comparison_only": True, "unqualified_domains": UNQUALIFIED, **SCOPE}


@router.post("/sets")
def compare_sets(body: SetComparison):
    with read_database() as db:
        before, after = read_set(db, body.before), read_set(db, body.after)
        old, _ = qualified_set(db, before["references"], before["content_hashes"])
        new, _ = qualified_set(db, after["references"], after["content_hashes"])
        comparisons = {kind: compare_documents(old[kind], new[kind])
                       for kind in ("catalog", "prices", "policies")}
    return {"before": {"id": before["id"], "references": before["references"]},
            "after": {"id": after["id"], "references": after["references"]},
            "comparisons": comparisons, "rows_changed": any(c["rows_changed"] for c in comparisons.values()),
            "comparison_only": True, "unqualified_domains": UNQUALIFIED, **SCOPE}
