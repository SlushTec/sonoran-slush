"""Owned synthetic SQLite drill, not a production backup/restore implementation.

No supplied database or asset path is accepted. All inputs originate in this
pytest fixture. Current proof links and synthetic byte references are assessed;
Bound proof revision/decision evidence is included; private assets, legacy-history migration, jobs and production recovery are not.
"""
from contextlib import closing
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from itertools import count
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import stat
import subprocess
import sys
from time import monotonic
import urllib.request
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from services.commerce.app import payments, retail, workflows
from services.commerce.app.main import app


START = datetime(2030, 1, 1, tzinfo=timezone.utc)
DEADLINE = START + timedelta(minutes=1)
SECRET = "restore-drill-only-" + "x" * 40
STAFF = "restore-drill-staff-" + "y" * 40
SLUG = "makertwist-40oz-tumbler"
FORMAT = "synthetic-sqlite-drill-v1"  # NOT an application schema version.
TABLES = ("metadata", "payment_events", "proof_decision_evidence", "proof_legacy_observations",
          "proof_material_contexts", "proof_revision_evidence", "records", "requests", "retail_offers",
          "retail_reservations", "retail_stock")
SIDECARS = ("-wal", "-shm", "-journal")
CASES = ("active", "paid", "consumed", "expired", "recovery", "cancelled")


class UnsafeDrill(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise UnsafeDrill(message)


def identity(path):
    info = path.stat()
    return info.st_dev, info.st_ino


def no_links(path):
    # Inspect every existing component, including Windows junction/reparse points.
    for part in reversed((path, *path.parents)):
        info = part.lstat()
        require(not stat.S_ISLNK(info.st_mode)
                and not getattr(info, "st_file_attributes", 0)
                & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 1024),
                "Links and reparse points are not owned drill paths")


def regular(path, expected_identity=None):
    no_links(path)
    info = path.stat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
            "An unaliased regular fixture file is required")
    if expected_identity is not None:
        require(identity(path) == expected_identity, "Fixture identity changed")


def new_directory(path):
    no_links(path.parent)
    require(not os.path.lexists(path), "Target already exists")
    path.mkdir()  # Exclusive creation; never replace or clean existing contents.
    no_links(path)


def new_file(path, content=b"", database=False):
    no_links(path.parent)
    candidates = (path, *(Path(str(path) + s) for s in SIDECARS)) if database else (path,)
    require(not any(os.path.lexists(p) for p in candidates), "Target or sidecar exists")
    with path.open("xb") as stream:
        stream.write(content)
    regular(path)


def read_database(path, *, sealed=False):
    # immutable is only for our finalized, standalone DELETE-mode snapshots.
    # Never use it for the live WAL source.
    suffix = "?mode=ro&immutable=1" if sealed else "?mode=ro"
    connection = sqlite3.connect(path.as_uri() + suffix, uri=True, timeout=1)
    try:
        connection.execute("PRAGMA query_only=ON")
        connection.execute("PRAGMA trusted_schema=OFF")
        return connection
    except Exception:
        connection.close()
        raise


def state(connection, tables=TABLES):
    schema = connection.execute(
        "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").fetchall()
    names = tuple(sorted(r[1] for r in schema if r[0] == "table"))
    require(names == tables, "Unexpected or missing fixture tables")
    # Table identifiers come exclusively from the constant allowlist, never input.
    rows = {name: tuple(sorted(connection.execute(f'SELECT * FROM "{name}"').fetchall()))
            for name in tables}
    return tuple(schema), rows


def copy_database(source, target, *, sealed=False, fault=None):
    new_file(target, database=True)
    started = monotonic()

    def progress(status, remaining, total):
        if fault is not None:
            fault(status, remaining, total)
        if monotonic() - started > 5:
            raise TimeoutError("Synthetic backup exceeded its bounded test budget")

    # Separate read connection: workflows.database() owns a write transaction and
    # must never be used here, or for pre-open snapshot validation.
    with closing(read_database(source, sealed=sealed)) as reader:
        with closing(sqlite3.connect(target)) as writer:
            reader.backup(writer, pages=4, progress=progress, sleep=0.01)
            require(writer.execute("PRAGMA journal_mode=DELETE").fetchone() == ("delete",),
                    "Snapshot must be standalone")
            writer.commit()
    require(not any(os.path.lexists(Path(str(target) + s)) for s in SIDECARS),
            "Snapshot sidecar was not finalized")


class Drill:
    """One fixture owns one live source, one snapshot and fresh isolated targets."""

    def __init__(self, tmp_path, monkeypatch, client, now):
        self.tables = TABLES
        self.root = tmp_path / "drill"
        new_directory(self.root)
        self.source_dir = self.root / "src"
        new_directory(self.source_dir)
        self.source = self.source_dir / "state.db"
        new_file(self.source, database=True)
        self.source_identity = identity(self.source)
        self.keeper = sqlite3.connect(self.source, isolation_level=None)
        require(self.keeper.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",),
                "WAL required for the drill")
        self.keeper.execute("PRAGMA wal_autocheckpoint=0")
        self.keeper.execute("BEGIN")
        self.keeper.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()
        self.monkeypatch, self.client, self.now = monkeypatch, client, now
        self.assets, self.asset_identities = {}, {}
        self.orders, self.carts, self.proofs, self.payloads, self.events = {}, {}, {}, {}, {}
        self.snapshot = None
        self.restored = None
        self.expected = None
        monkeypatch.setenv("SONORAN_DB_PATH", str(self.source))

    def close(self):
        self.keeper.rollback()
        self.keeper.close()

    def post(self, url, payload, receipt=None, staff=False, status=200):
        headers = {"Authorization": "Bearer " + (STAFF if staff else receipt["access_token"])} if staff or receipt else {}
        result = self.client.post(url, json=payload, headers=headers)
        assert result.status_code == status, result.text
        return result.json()

    def order_doc(self, name):
        receipt = self.orders[name]
        result = self.client.get("/v1/orders/" + receipt["id"],
                                 headers={"Authorization": "Bearer " + receipt["access_token"]})
        assert result.status_code == 200, result.text
        doc = result.json()
        doc.pop("test_payment_available", None)
        return doc

    def payment(self, name, event_id=None, outcome="paid", status=200):
        payload = {"event_id": event_id or self.events[name], "version": 1,
                   "amount_minor": 1234, "currency": "USD", "outcome": outcome}
        return self.post("/v1/admin/retail-test/orders/" + self.orders[name]["id"] + "/payments",
                         payload, staff=True, status=status)

    def release(self, name, status=200):
        return self.post("/v1/admin/orders/" + self.orders[name]["id"] + "/release",
                         {"version": 1, "inventory_reserved": True, "capacity_confirmed": True},
                         staff=True, status=status)

    def seed(self):
        self.post("/v1/admin/retail-test/stock/shared", {"expected_version": 0, "on_hand": 20}, staff=True)
        self.post("/v1/admin/retail-test/offers/" + SLUG,
                  {"expected_version": 0, "unit_price_minor": 1234, "stock_id": "shared", "units_per_item": 1}, staff=True)
        for number, name in enumerate(CASES):
            file_id = str(UUID(int=number + 1))
            filename = f"a{number}.bin"
            content = ("SYNTHETIC FILE REFERENCE " + name + "\n").encode()
            self.assets[file_id] = (filename, content)
            path = self.source_dir / filename
            new_file(path, content)
            self.asset_identities[file_id] = identity(path)
            payload = {"request_id": str(UUID(int=100 + number)), "items": [{
                "product_slug": SLUG, "quantity": 1,
                "photo_brief": {"photos": [{"local_file_id": file_id, "filename": filename}],
                                "instructions": "Synthetic bytes only; no photo uploaded."}}]}
            cart = self.post("/v1/cart", payload)
            order = self.post("/v1/cart/" + cart["id"] + "/orders", {"version": 1}, receipt=cart)
            proof = self.post("/v1/admin/proofs", {"order_id": order["id"], "expected_proof_version": 0,
                                                  "proof_text": "Synthetic proof " + name}, staff=True)
            self.carts[name], self.orders[name], self.proofs[name], self.payloads[name] = cart, order, proof, payload
            self.events[name] = str(UUID(int=200 + number))
            self.post("/v1/admin/retail-test/orders/" + order["id"] + "/hold-deadline",
                      {"version": 1, "test_hold_expires_at": DEADLINE.isoformat()}, staff=True)
            if name != "active":
                self.post("/v1/proofs/" + proof["id"] + "/approve", {"version": 1, "decision": "approve"}, receipt=proof)
            else:
                self.post("/v1/admin/proofs", {"order_id": order["id"], "expected_proof_version": 1,
                                              "proof_text": "Synthetic revised proof"}, staff=True)
            if name in {"paid", "consumed"}:
                assert self.payment(name)["applied"] is True
            if name == "consumed":
                self.post("/v1/admin/retail-test/orders/" + order["id"] + "/capacity",
                          {"version": 1, "confirmed": True}, staff=True)
                self.release(name)
            if name == "cancelled":
                self.post("/v1/orders/" + order["id"] + "/cancel-test", {"version": 1}, receipt=order)
        self.now[0] = DEADLINE
        self.post("/v1/admin/retail-test/orders/" + self.orders["expired"]["id"] + "/expire", {"version": 1}, staff=True)
        assert self.payment("recovery")["recovery_required"] is True
        with closing(read_database(self.source)) as reader:
            self.expected = state(reader, self.tables)
        self.assert_seed_contract(self.expected)
        assert Path(str(self.source) + "-wal").stat().st_size > 32
        self.assert_offline()

    def assert_seed_contract(self, saved):
        """Independent expectations, established before any backup/manifest."""
        schema, rows = saved
        docs = {r[0]: json.loads(r[3]) for r in rows["records"]}
        assert len(docs) == 18 and len(rows["requests"]) == 6
        assert len(rows["proof_material_contexts"]) == 6
        assert len(rows["proof_revision_evidence"]) == 7
        assert len(rows["proof_decision_evidence"]) == 5
        assert rows["proof_legacy_observations"] == ()
        contexts = {}
        for digest, order_id, raw in rows["proof_material_contexts"]:
            assert sha256(raw.encode("utf-8")).hexdigest() == digest
            context = json.loads(raw)
            source = docs[order_id]
            assert context == {"order_id": order_id, "items": source["items"], "lines": source["lines"],
                               "total_minor": source["total_minor"], "currency": source["currency"]}
            contexts[digest] = context
        revisions = {}
        for proof_id, version, order_id, digest, at, raw in rows["proof_revision_evidence"]:
            evidence = json.loads(raw)
            assert evidence["proof_id"] == proof_id and evidence["version"] == version
            assert evidence["order_id"] == order_id and evidence["context_hash"] == digest
            assert evidence["prepared_at"] == at and contexts[digest]["order_id"] == order_id
            assert evidence["actor_scope"] == "shared synthetic staff credential"
            revisions[(proof_id, version)] = evidence
        for proof_id, version, sequence, raw in rows["proof_decision_evidence"]:
            decision = json.loads(raw)
            assert sequence == 1 and decision["action"] == "approve"
            assert decision["version"] == version and decision["proof_id"] == proof_id
            assert decision["context_hash"] == revisions[(proof_id, version)]["context_hash"]
            assert decision["actor_scope"] == "holder of this private proof capability"
        first_active = revisions[(self.proofs["active"]["id"], 1)]
        assert first_active["proof_text"] == "Synthetic proof active"
        assert revisions[(self.proofs["active"]["id"], 2)]["proof_text"] == "Synthetic revised proof"

        assert len(rows["payment_events"]) == 3 and len(rows["retail_reservations"]) == 6
        assert rows["retail_stock"] == (("shared", 19, 2),)
        assert rows["metadata"] == (("access_secret_fingerprint", sha256(SECRET.encode()).hexdigest()),)
        expected = {
            "active": ("awaiting_payment", "unpaid", "active", "active", True),
            "paid": ("awaiting_production_checks", "paid", "active", "active", True),
            "consumed": ("in_production", "paid", "consumed", "consumed", True),
            "expired": ("reservation_expired", "unpaid", "expired", "released", False),
            "recovery": ("payment_reconciliation_required", "reconciliation_required", "expired", "released", False),
            "cancelled": ("cancelled", "unpaid", "released", "released", False),
        }
        reservations = {r[0]: r[1:] for r in rows["retail_reservations"]}
        request_rows = {r[0]: r[1:] for r in rows["requests"]}
        event_rows = {r[0]: r[1:] for r in rows["payment_events"]}
        for number, name in enumerate(CASES):
            order = docs[self.orders[name]["id"]]
            cart = docs[self.carts[name]["id"]]
            proof = docs[self.proofs[name]["id"]]
            status, paid, held, row_state, inventory = expected[name]
            assert (order["status"], order["payment_status"], order["reservation_status"],
                    order["inventory_reserved"]) == (status, paid, held, inventory)
            assert order["retail_test"] is True and order["test_mode"] is True
            assert order["total_minor"] == 1234 and order["currency"] == "USD"
            assert order["cart_id"] == cart["id"] and cart["order_id"] == order["id"]
            assert order["items"] == cart["items"] and order["lines"] == cart["lines"]
            assert len(order["items"]) == len(order["lines"]) == 1
            line = order["lines"][0]
            assert (line["stock_id"], line["stock_units"], line["unit_price_minor"],
                    line["line_total_minor"], line["offer_version"]) == ("shared", 1, 1234, 1234, 1)
            assert order["items"][0]["product_slug"] == SLUG and order["items"][0]["quantity"] == 1
            assert order["current_proof_id"] == proof["id"] and proof["order_id"] == order["id"]
            version = 2 if name == "active" else 1
            assert order["current_proof_version"] == proof["version"] == version
            assert order["approved_proof_version"] == proof["approved_version"] == (None if name == "active" else 1)
            assert order["test_hold_expires_at"] == DEADLINE.isoformat()
            assert reservations[order["id"]] == ("shared", 1, row_state)
            assert "checkout_session_id" not in order and "payment_provider" not in order
            if name in {"expired", "recovery"}:
                assert order["reservation_expired_at"] == DEADLINE.isoformat()
            if name == "recovery":
                assert order["payment_recovery_reason"] == "reservation_expired"
            brief = order["items"][0]["photo_brief"]
            file_id = str(UUID(int=number + 1))
            assert brief["media_uploaded"] is False
            assert brief["photos"] == [{"local_file_id": file_id, "filename": self.assets[file_id][0], "note": ""}]
            payload = retail.CartRequest.model_validate(self.payloads[name]).model_dump(mode="json")
            assert request_rows["retail-cart:" + payload["request_id"]] == (retail.fingerprint(payload), cart["id"])
            if name in {"paid", "consumed", "recovery"}:
                event = {"order_id": order["id"], "event_id": self.events[name], "version": 1,
                         "amount_minor": 1234, "currency": "USD", "outcome": "paid"}
                assert event_rows["local-test:" + self.events[name]] == (retail.fingerprint(event), order["id"])
        assert sum(r[2] for r in rows["retail_reservations"] if r[3] == "active") == 2
        for record_id, kind, token_hash, document in rows["records"]:
            assert docs[record_id]["id"] == record_id and docs[record_id]["kind"] == kind
            assert token_hash == sha256(workflows.access_token(record_id).encode()).hexdigest()
        self.assert_source()

    def assert_source(self):
        regular(self.source, self.source_identity)
        for file_id, (filename, content) in self.assets.items():
            path = self.source_dir / filename
            regular(path, self.asset_identities[file_id])
            require(path.read_bytes() == content, "Source fixture bytes changed")

    def source_bytes(self):
        # SHM contains transient reader locks, not committed state. Preserve the
        # main file, WAL and assets byte-for-byte while the keeper remains open.
        paths = (self.source, Path(str(self.source) + "-wal"),
                 *(self.source_dir / filename for filename, _ in self.assets.values()))
        return {p.name: p.read_bytes() for p in paths}

    def asset_manifest(self):
        return [{"id": key, "name": name, "sha256": sha256(content).hexdigest()}
                for key, (name, content) in sorted(self.assets.items())]

    def write_manifest(self, bundle):
        manifest = {"format": FORMAT, "database_sha256": sha256((bundle / "state.db").read_bytes()).hexdigest(),
                    "assets": self.asset_manifest()}
        new_file(bundle / "manifest.json", json.dumps(manifest, sort_keys=True).encode())

    def register_bundle(self, bundle):
        names = ("state.db", "manifest.json", *(name for name, _ in self.assets.values()))
        self.bundle_identities[bundle] = (identity(bundle), {name: identity(bundle / name) for name in names})

    def validate_bundle(self, bundle):
        require(bundle in self.bundle_identities, "Bundle was not created by this drill")
        no_links(bundle)
        directory_id, files = self.bundle_identities[bundle]
        require(identity(bundle) == directory_id, "Bundle identity changed")
        require(set(p.name for p in bundle.iterdir()) == set(files), "Unexpected bundle files or sidecars")
        for name, file_identity in files.items():
            regular(bundle / name, file_identity)
        path = bundle / "state.db"
        require(path.stat().st_size <= 1024 * 1024, "Synthetic snapshot exceeds bounded size")
        require((bundle / "manifest.json").stat().st_size <= 65536, "Manifest exceeds bounded size")
        try:
            manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
            require(type(manifest) is dict and set(manifest) == {"format", "database_sha256", "assets"},
                    "Invalid harness manifest")
            require(manifest["format"] == FORMAT, "Unsupported harness format, not an app schema version")
            require(manifest["assets"] == self.asset_manifest(), "Unexpected asset-reference manifest")
            require(manifest["database_sha256"] == sha256(path.read_bytes()).hexdigest(), "Snapshot digest mismatch")
            for filename, content in self.assets.values():
                require((bundle / filename).stat().st_size == len(content), "Synthetic asset size mismatch")
                require((bundle / filename).read_bytes() == content, "Synthetic asset bytes mismatch")
            with closing(read_database(path, sealed=True)) as reader:
                require(reader.execute("PRAGMA integrity_check").fetchall() == [("ok",)], "Invalid SQLite snapshot")
                require(reader.execute("PRAGMA journal_mode").fetchone() == ("delete",), "Snapshot is not standalone")
                require(reader.execute("PRAGMA user_version").fetchone() == (0,), "Unsupported fixture header")
                require(state(reader, self.tables) == self.expected, "Schema, rows or lineage differ from independent fixture expectations")
        except (sqlite3.DatabaseError, UnicodeError, json.JSONDecodeError) as exc:
            raise UnsafeDrill("Invalid synthetic snapshot") from exc

    def make_snapshot(self, fault=None):
        require(self.snapshot is None, "One snapshot per owned drill")
        self.assert_source()
        bundle = self.root / "snap"
        new_directory(bundle)
        copy_database(self.source, bundle / "state.db", fault=fault)
        for file_id, (filename, content) in self.assets.items():
            new_file(bundle / filename, (self.source_dir / filename).read_bytes())
        self.write_manifest(bundle)
        self.bundle_identities = {}
        self.register_bundle(bundle)
        self.validate_bundle(bundle)
        self.snapshot = bundle
        self.assert_source()
        return bundle

    def restore(self, name="restored", fault=None):
        require(type(name) is str and re.fullmatch(r"[a-z][a-z0-9-]{0,23}", name), "Target must be a fresh owned child")
        require(self.snapshot is not None, "No successful owned snapshot")
        self.assert_source()
        self.validate_bundle(self.snapshot)  # Before any application open or target creation.
        target = self.root / name
        new_directory(target)
        copy_database(self.snapshot / "state.db", target / "state.db", sealed=True, fault=fault)
        for filename, content in self.assets.values():
            new_file(target / filename, (self.snapshot / filename).read_bytes())
        self.write_manifest(target)
        self.register_bundle(target)
        self.validate_bundle(target)
        self.assert_source()
        # This is a validated isolated target, not a success/DR receipt. The app
        # replay checks below must finish before a test can report success.
        return target

    def assert_offline(self):
        capabilities = self.client.get("/v1/capabilities").json()
        assert all(capabilities[key] is False for key in
                   ("production_ready", "live_payments", "private_uploads", "live_email"))
        assert self.client.get("/ready").status_code == 503
        assert self.client.post("/v1/uploads", json={}).status_code == 503
        assert self.client.post("/v1/checkout/sessions", json={}).status_code == 503

    def verify_replay(self, target):
        self.validate_bundle(target)
        self.monkeypatch.setenv("SONORAN_DB_PATH", str(target / "state.db"))
        self.assert_offline()
        for name in CASES:
            cart = self.post("/v1/cart", self.payloads[name])
            assert (cart["id"], cart["access_token"]) == (self.carts[name]["id"], self.carts[name]["access_token"])
            order = self.post("/v1/cart/" + cart["id"] + "/orders", {"version": 1}, receipt=cart)
            assert (order["id"], order["access_token"]) == (self.orders[name]["id"], self.orders[name]["access_token"])
            changed = json.loads(json.dumps(self.payloads[name]))
            changed["items"][0]["quantity"] = 2
            self.post("/v1/cart", changed, status=409)
            assert self.client.get("/v1/orders/" + order["id"]).status_code == 404
            assert self.client.get("/v1/proofs/" + self.proofs[name]["id"]).status_code == 404
        for name in ("paid", "consumed", "recovery"):
            replay = self.payment(name)
            assert replay["applied"] is False and replay["recovery_required"] is (name == "recovery")
            self.payment(name, outcome="failed", status=409)
        for name in ("expired", "recovery"):
            self.release(name, status=409)
            self.post("/v1/admin/retail-test/orders/" + self.orders[name]["id"] + "/capacity",
                      {"version": 1, "confirmed": True}, staff=True, status=409)
            self.post("/v1/admin/proofs", {"order_id": self.orders[name]["id"], "expected_proof_version": 1,
                                          "proof_text": "Must remain held"}, staff=True, status=409)
        with closing(read_database(target / "state.db")) as reader:
            require(state(reader, self.tables) == self.expected, "Replay changed durable identities or state")
        self.assert_offline()
        self.restored = target  # Set only after raw validation AND API replay.


@pytest.fixture
def drill(tmp_path, monkeypatch, request):
    # Never import the existing connected fixture: it enables sandbox payment
    # configuration. These overrides live only in this isolated test process.
    for name in ("SQUARE_ENVIRONMENT", "SQUARE_SANDBOX_ACCESS_TOKEN", "SQUARE_SANDBOX_LOCATION_ID",
                 "SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_SANDBOX_WEBHOOK_KEY", "SQUARE_WEBHOOK_NOTIFICATION_URL"):
        monkeypatch.delenv(name, raising=False)
    for key, value in {"SONORAN_STAGE": "scaffold", "SONORAN_REQUESTS_ENABLED": "true",
                       "SONORAN_RETAIL_TEST_ENABLED": "true", "SONORAN_TEST_PAYMENTS_ENABLED": "false",
                       "SONORAN_ACCESS_SECRET": SECRET, "SONORAN_STAFF_TOKEN": STAFF}.items():
        monkeypatch.setenv(key, value)
    attempted = []

    def no_external(*args, **kwargs):
        attempted.append("blocked")  # No arguments, URLs or environment values are recorded.
        raise AssertionError("External transport forbidden in synthetic restore drill")

    monkeypatch.setattr(payments, "square_checkout", no_external)
    monkeypatch.setattr(urllib.request.OpenerDirector, "open", no_external)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", no_external)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", no_external)
    monkeypatch.setattr(socket, "create_connection", no_external)
    monkeypatch.setattr(socket, "getaddrinfo", no_external)
    ids = count(1000)
    for module in (retail, workflows):
        monkeypatch.setattr(module, "uuid4", lambda: UUID(int=next(ids)))
        monkeypatch.setattr(module, "NOW", lambda: START.isoformat())
    now = [START]
    monkeypatch.setitem(app.dependency_overrides, retail.reservation_clock, lambda: lambda: now[0])
    with TestClient(app) as client:
        # Windows constructs asyncio's internal socketpair during portal startup.
        # Block raw connects before any source, seed, backup or restore operation.
        monkeypatch.setattr(socket.socket, "connect", no_external)
        monkeypatch.setattr(socket.socket, "connect_ex", no_external)
        cls = drill_profile(getattr(request, "param", False))
        instance = cls(tmp_path, monkeypatch, client, now)
        try:
            instance.seed()
            yield instance
        finally:
            instance.close()
            assert not attempted, "No external action may be attempted before or after restore"


def reseal_digest(bundle):
    """Adversarial fixture helper: a matching digest is deliberately insufficient."""
    path = bundle / "manifest.json"
    manifest = json.loads(path.read_text())
    manifest["database_sha256"] = sha256((bundle / "state.db").read_bytes()).hexdigest()
    path.write_text(json.dumps(manifest), encoding="utf-8")


def change_document(path, record_id, change):
    with closing(sqlite3.connect(path)) as db:
        doc = json.loads(db.execute("SELECT document FROM records WHERE id=?", (record_id,)).fetchone()[0])
        change(doc)
        db.execute("UPDATE records SET document=? WHERE id=?", (json.dumps(doc, sort_keys=True), record_id))
        db.commit()


def test_wal_roundtrip(drill):
    before = drill.source_bytes()
    # Hold an uncommitted write on a DIFFERENT connection. A WAL reader must see
    # all committed seed transitions, but never this uncommitted sentinel.
    writer = sqlite3.connect(drill.source, isolation_level=None)
    writer.execute("BEGIN IMMEDIATE")
    writer.execute("INSERT INTO metadata VALUES('uncommitted-drill-marker','not-backed-up')")
    try:
        snapshot = drill.make_snapshot()
        target = drill.restore()
        assert drill.restored is None
        drill.verify_replay(target)
        assert drill.restored == target
        with closing(read_database(snapshot / "state.db", sealed=True)) as reader:
            assert state(reader) == drill.expected
            assert reader.execute("SELECT value FROM metadata WHERE key='uncommitted-drill-marker'").fetchone() is None
        assert before == drill.source_bytes()
    finally:
        writer.rollback()
        writer.close()


def test_restored_expiry(drill):
    drill.make_snapshot()
    before = drill.source_bytes()
    target = drill.restore()
    drill.verify_replay(target)
    for name, status in (("active", 200), ("paid", 409)):
        url = "/v1/admin/retail-test/orders/" + drill.orders[name]["id"] + "/expire"
        result = drill.post(url, {"version": 1}, staff=True, status=status)
        if name == "active":
            assert result["reservation_status"] == "expired"
            assert drill.post(url, {"version": 1}, staff=True) == result
            assert drill.payment(name)["recovery_required"] is True
            drill.release(name, status=409)
    with closing(read_database(target / "state.db")) as reader:
        assert reader.execute("SELECT on_hand FROM retail_stock").fetchone() == (19,)
        assert reader.execute("SELECT SUM(units) FROM retail_reservations WHERE state='active'").fetchone() == (1,)
    assert drill.order_doc("recovery")["payment_recovery_reason"] == "reservation_expired"
    assert before == drill.source_bytes()


def test_wrong_access_secret(drill, monkeypatch):
    drill.make_snapshot()
    before = drill.source_bytes()
    target = drill.restore()
    monkeypatch.setenv("SONORAN_DB_PATH", str(target / "state.db"))
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", "wrong-drill-secret-" + "z" * 40)
    receipt = drill.orders["active"]
    result = drill.client.get("/v1/orders/" + receipt["id"],
                              headers={"Authorization": "Bearer " + receipt["access_token"]})
    assert result.status_code == 503
    with closing(read_database(target / "state.db")) as reader:
        assert state(reader) == drill.expected
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", SECRET)
    # The intentional failed application open switched only the isolated target
    # to WAL. Recheck its state and successful access without resealing it.
    assert drill.order_doc("active")["test_hold_expires_at"] == DEADLINE.isoformat()
    assert before == drill.source_bytes()


BAD_DATABASES = ("junk", "truncated", "main-only", "extra-table", "missing-fingerprint",
                 "wrong-fingerprint", "missing-request", "proof-link", "stock", "reservation",
                 "deadline", "recovery", "missing-event", "file-reference", "header-version")


@pytest.mark.parametrize("damage", BAD_DATABASES, ids=BAD_DATABASES)
def test_bad_database(drill, damage):
    bundle = drill.make_snapshot()
    before = drill.source_bytes()
    path = bundle / "state.db"
    if damage == "junk":
        path.write_bytes(b"not a SQLite snapshot")
    elif damage == "truncated":
        path.write_bytes(path.read_bytes()[:512])
    elif damage == "main-only":
        path.write_bytes(drill.source.read_bytes())
    elif damage in {"proof-link", "deadline", "recovery", "file-reference"}:
        record = drill.orders["recovery" if damage == "recovery" else "active"]["id"]
        if damage == "proof-link":
            change = lambda d: d.update(current_proof_id=drill.proofs["paid"]["id"])
        elif damage == "deadline":
            change = lambda d: d.update(test_hold_expires_at=(DEADLINE + timedelta(days=1)).isoformat())
        elif damage == "recovery":
            change = lambda d: d.update(payment_status="paid", status="awaiting_production_checks")
        else:
            change = lambda d: d["items"][0]["photo_brief"]["photos"][0].update(local_file_id=str(UUID(int=999)))
        change_document(path, record, change)
    else:
        sql = {
            "extra-table": "CREATE TABLE unexpected(value TEXT)",
            "missing-fingerprint": "DELETE FROM metadata",
            "wrong-fingerprint": "UPDATE metadata SET value='wrong'",
            "missing-request": "DELETE FROM requests WHERE id=(SELECT MIN(id) FROM requests)",
            "stock": "UPDATE retail_stock SET on_hand=100",
            "reservation": "DELETE FROM retail_reservations WHERE order_id=(SELECT MIN(order_id) FROM retail_reservations)",
            "missing-event": "DELETE FROM payment_events WHERE id=(SELECT MIN(id) FROM payment_events)",
            "header-version": "PRAGMA user_version=1",
        }[damage]
        with closing(sqlite3.connect(path)) as db:
            db.execute(sql)
            db.commit()
    reseal_digest(bundle)
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert drill.restored is None and not (drill.root / "restored").exists()
    assert before == drill.source_bytes()


@pytest.mark.parametrize("damage", ("format", "manifest-json", "asset-missing", "asset-bytes", "asset-path", "digest"),
                         ids=("format", "json", "missing", "bytes", "traversal", "digest"))
def test_bad_manifest_asset(drill, damage):
    bundle = drill.make_snapshot()
    before = drill.source_bytes()
    path = bundle / "manifest.json"
    manifest = json.loads(path.read_text())
    if damage == "manifest-json":
        path.write_text("{invalid", encoding="utf-8")
    elif damage == "asset-missing":
        (bundle / "a0.bin").unlink()  # Only an owned synthetic negative fixture.
    elif damage == "asset-bytes":
        (bundle / "a0.bin").write_bytes(b"wrong synthetic bytes")
    else:
        if damage == "format":
            manifest["format"] = "synthetic-sqlite-drill-v2"
        elif damage == "asset-path":
            manifest["assets"][0]["name"] = "../../outside.bin"
        else:
            manifest["database_sha256"] = "0" * 64
        path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert drill.restored is None and not (drill.root / "restored").exists()
    assert before == drill.source_bytes()


@pytest.mark.parametrize("suffix", SIDECARS, ids=("wal", "shm", "journal"))
def test_snapshot_sidecars(drill, suffix):
    bundle = drill.make_snapshot()
    before = drill.source_bytes()
    new_file(Path(str(bundle / "state.db") + suffix), b"existing synthetic sidecar")
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert before == drill.source_bytes()


@pytest.mark.parametrize("stage", ("backup", "restore"), ids=("backup", "restore"))
def test_copy_failure(drill, stage):
    def fail(status, remaining, total):
        raise OSError("Injected synthetic copy failure")

    before = drill.source_bytes()
    if stage == "backup":
        with pytest.raises(OSError, match="Injected"):
            drill.make_snapshot(fault=fail)
        assert drill.snapshot is None
        with pytest.raises(UnsafeDrill):
            drill.make_snapshot()
    else:
        drill.make_snapshot()
        with pytest.raises(OSError, match="Injected"):
            drill.restore(fault=fail)
        with pytest.raises(UnsafeDrill):
            drill.restore()
    assert drill.restored is None and before == drill.source_bytes()


def test_target_validation_failure(drill, monkeypatch):
    drill.make_snapshot()
    before = drill.source_bytes()
    original = copy_database

    def incomplete(source, target, **kwargs):
        original(source, target, **kwargs)
        with closing(sqlite3.connect(target)) as db:
            db.execute("DELETE FROM metadata")
            db.commit()

    monkeypatch.setattr(sys.modules[__name__], "copy_database", incomplete)
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert drill.restored is None and before == drill.source_bytes()
    with closing(read_database(drill.root / "restored" / "state.db", sealed=True)) as reader:
        assert reader.execute("SELECT * FROM metadata").fetchall() == []
    # No app open recreated the missing fingerprint, and no source path changed.
    assert os.environ["SONORAN_DB_PATH"] == str(drill.source)


@pytest.mark.parametrize("name", ("../outside", "/outside", "C:\\outside", "a/b", "..", "", "x" * 25),
                         ids=("parent", "absolute", "drive", "nested", "dot", "empty", "long"))
def test_unsafe_target_names(drill, name):
    drill.make_snapshot()
    before = drill.source_bytes()
    entries = set(drill.root.iterdir())
    with pytest.raises(UnsafeDrill):
        drill.restore(name)
    assert entries == set(drill.root.iterdir()) and before == drill.source_bytes()


@pytest.mark.parametrize("kind", ("file", "directory", "wal", "shm", "journal", "source", "snapshot"),
                         ids=("file", "dir", "wal", "shm", "journal", "source", "snapshot"))
def test_existing_target(drill, kind):
    drill.make_snapshot()
    before = drill.source_bytes()
    name = "src" if kind == "source" else "snap" if kind == "snapshot" else "occupied"
    target = drill.root / name
    if kind == "file":
        new_file(target, b"existing owned sentinel")
    elif kind not in {"source", "snapshot"}:
        new_directory(target)
        new_file(target / ("state.db-" + kind if kind in {"wal", "shm", "journal"} else "sentinel"), b"existing owned sentinel")
    sentinel = {str(p.relative_to(target)): p.read_bytes() for p in target.rglob("*") if p.is_file()} if target.is_dir() else target.read_bytes()
    with pytest.raises(UnsafeDrill):
        drill.restore(name)
    unchanged = {str(p.relative_to(target)): p.read_bytes() for p in target.rglob("*") if p.is_file()} if target.is_dir() else target.read_bytes()
    assert unchanged == sentinel and before == drill.source_bytes()


def directory_link(link, target):
    # Real reparse-point coverage on Windows without requiring symlink privilege;
    # both paths are fresh fixture-owned siblings. No shell deletion or cleanup.
    if os.name == "nt":
        subprocess.run(["cmd", "/d", "/c", "mklink", "/J", str(link), str(target)],
                       check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        link.symlink_to(target, target_is_directory=True)


@pytest.mark.parametrize("kind", ("source-hardlink", "snapshot-hardlink", "snapshot-link", "target-link", "replacement"),
                         ids=("source-hard", "snapshot-hard", "snapshot-link", "target-link", "replaced"))
def test_aliases_rejected(drill, kind):
    bundle = drill.make_snapshot()
    before = drill.source_bytes()
    if kind == "source-hardlink":
        os.link(drill.source, drill.root / "alias.db")
    elif kind == "snapshot-hardlink":
        os.link(bundle / "state.db", drill.root / "alias.db")
    elif kind == "snapshot-link":
        saved = drill.root / "saved"
        bundle.rename(saved)
        directory_link(bundle, saved)
    elif kind == "target-link":
        directory_link(drill.root / "restored", drill.source_dir)
    else:
        path = bundle / "state.db"
        data = path.read_bytes()
        path.rename(drill.root / "saved.db")
        new_file(path, data, database=True)
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert drill.restored is None and before == drill.source_bytes()


def test_unowned_snapshot_rejected(drill):
    original = drill.make_snapshot()
    before = drill.source_bytes()
    unowned = drill.root / "unregistered"
    new_directory(unowned)
    for path in original.iterdir():
        new_file(unowned / path.name, path.read_bytes())
    # Even byte-identical files with a matching manifest are not admitted source.
    drill.snapshot = unowned
    with pytest.raises(UnsafeDrill, match="not created"):
        drill.restore()
    assert drill.restored is None and before == drill.source_bytes()


@pytest.mark.parametrize("suffix", SIDECARS, ids=("wal", "shm", "journal"))
def test_sidecar_creation_race(drill, monkeypatch, suffix):
    drill.make_snapshot()
    before = drill.source_bytes()
    original = new_file

    def competing_sidecar(path, content=b"", database=False):
        if database and path.parent.name == "restored":
            original(Path(str(path) + suffix), b"synthetic concurrent sentinel")
        return original(path, content, database=database)

    monkeypatch.setattr(sys.modules[__name__], "new_file", competing_sidecar)
    with pytest.raises(UnsafeDrill, match="sidecar"):
        drill.restore()
    assert not (drill.root / "restored" / "state.db").exists()
    assert (drill.root / "restored" / ("state.db" + suffix)).read_bytes() == b"synthetic concurrent sentinel"
    assert drill.restored is None and before == drill.source_bytes()


@pytest.mark.parametrize("part", ("database", "manifest", "asset"), ids=("db", "manifest", "asset"))
def test_size_limits(drill, part):
    bundle = drill.make_snapshot()
    before = drill.source_bytes()
    filename, size = {"database": ("state.db", 1024 * 1024 + 1),
                      "manifest": ("manifest.json", 65537), "asset": ("a0.bin", 1024 * 1024)}[part]
    (bundle / filename).write_bytes(b"x" * size)
    with pytest.raises(UnsafeDrill, match="size"):
        drill.restore()
    assert drill.restored is None and before == drill.source_bytes()


def test_backup_budget(drill, monkeypatch):
    before = drill.source_bytes()
    clock = iter((0, 6))
    monkeypatch.setattr(sys.modules[__name__], "monotonic", lambda: next(clock))
    with pytest.raises(TimeoutError, match="bounded test budget"):
        drill.make_snapshot()
    assert drill.snapshot is None and drill.restored is None
    assert before == drill.source_bytes()


# A distinct, explicitly selected profile. No table discovery or sqlite_% bypass.
LEDGER_TABLES = tuple(sorted((*TABLES, "fixture_components", "fixture_locations",
    "fixture_lots", "fixture_balances", "fixture_movements", "fixture_boms",
    "fixture_holds", "fixture_allocations", "fixture_hold_commands",
    "fixture_hold_events", "sqlite_sequence")))
LEDGER = "/v1/admin/retail-test/component-ledger"
BILL_URL = LEDGER + "/boms/restore-gift/versions/1"


def digest_document(value):
    # Independently spell the public canonical request contract, not call producer fingerprint.
    return sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class LedgerDrill(Drill):
    def put(self, url, payload):
        response = self.client.put(url, json=payload, headers={"Authorization": "Bearer " + STAFF})
        assert response.status_code == 200, response.text
        return response.json()

    def seed(self):
        super().seed()  # Keep the legacy profile independently valid before adding the namespace.
        self.commands, self.movement_commands, self.holds = [], [], {}
        for component, kind in (("blank", "blank"), ("base", "base")):
            self.put(LEDGER + "/components/" + component, {"kind": kind, "unit": "piece"})
        for location, kind in (("shop", "workshop"), ("market", "market")):
            self.put(LEDGER + "/locations/" + location, {"kind": kind})
        for number, (lot, component, units) in enumerate((("blank-lot", "blank", 10), ("base-lot", "base", 20))):
            self.put(LEDGER + "/lots/" + lot,
                     {"component_id": component, "supplier_reference": "synthetic", "lot_reference": lot})
            self.seed_movement(lot, number + 300, 0, units, None, {"location_id": "shop", "condition": "available"})
        self.seed_movement("blank-lot", 302, 1, 2,
                           {"location_id": "shop", "condition": "available"},
                           {"location_id": "market", "condition": "available"})
        self.seed_movement("base-lot", 303, 1, 3,
                           {"location_id": "shop", "condition": "available"},
                           {"location_id": "shop", "condition": "damaged"})
        self.bill = self.put(BILL_URL, {"product_slug": SLUG, "components": [
            {"component_id": "blank", "units_per_item": 1},
            {"component_id": "base", "units_per_item": 2}]})
        version = 2
        for number, name in enumerate(("active", "released", "consumed")):
            payload = {"request_id": str(UUID(int=400 + number)), "quantity": 1,
                       "allocations": [{"lot_id": "blank-lot", "location_id": "shop", "units": 1},
                                       {"lot_id": "base-lot", "location_id": "shop", "units": 2}],
                       "lot_versions": {"blank-lot": version, "base-lot": version}, "reason": "Synthetic reserve"}
            hold = self.post(BILL_URL + "/reservations", payload, staff=True)
            self.commands.append((BILL_URL + "/reservations", payload, hold,
                                  {"operation": "reserve", "bom_id": "restore-gift", "revision": 1, **payload}))
            version += 1
            if name != "active":
                action = "release" if name == "released" else "consume"
                transition = {"request_id": str(UUID(int=500 + number)), "expected_version": 1,
                              "lot_versions": {"blank-lot": version, "base-lot": version},
                              "reason": "Synthetic transition"}
                url = LEDGER + "/reservations/" + hold["id"] + "/" + action
                hold = self.post(url, transition, staff=True)
                self.commands.append((url, transition, hold,
                                      {"operation": name, "hold_id": hold["id"], **transition}))
                version += 1
            self.holds[name] = hold
        self.tables = LEDGER_TABLES
        with closing(read_database(self.source)) as reader:
            self.expected = state(reader, self.tables)
        self.assert_seed_contract(self.expected)
        self.assert_ledger_contract(self.expected)

    def seed_movement(self, lot, number, version, units, source, destination):
        payload = {"request_id": str(UUID(int=number)), "expected_version": version,
                   "quantity": units, "source": source, "destination": destination,
                   "purpose": "transfer" if source else "receipt", "reason": "Synthetic movement"}
        url = LEDGER + "/lots/" + lot + "/movements"
        result = self.post(url, payload, staff=True)
        self.movement_commands.append((url, payload, result, {"lot_id": lot, **payload}))

    def assert_ledger_contract(self, saved):
        schema, rows = saved
        assert tuple(sorted(rows)) == LEDGER_TABLES
        assert rows["sqlite_sequence"] == (("fixture_hold_events", 10), ("fixture_movements", 4))
        assert [r[0] for r in rows["fixture_movements"]] == list(range(1, 5))
        assert [r[0] for r in rows["fixture_hold_events"]] == list(range(1, 11))
        components = {key: json.loads(raw) for key, raw in rows["fixture_components"]}
        locations = {key: json.loads(raw) for key, raw in rows["fixture_locations"]}
        lots = {key: (json.loads(raw), version) for key, raw, version in rows["fixture_lots"]}
        assert set(components) == {"blank", "base"} and set(locations) == {"shop", "market"}
        for key, kind in (("blank", "blank"), ("base", "base")):
            assert components[key] == {"id": key, "kind": kind, "unit": "piece",
                                       "test_mode": True, "checkout_authoritative": False}
        for key, kind in (("shop", "workshop"), ("market", "market")):
            assert locations[key] == {"id": key, "kind": kind, "test_mode": True, "checkout_authoritative": False}
        assert set(lots) == {"blank-lot", "base-lot"}
        for key, (doc, version) in lots.items():
            assert version == 7 and doc["component_id"] == key.removesuffix("-lot")
            assert doc["component_id"] in components
            assert doc["supplier_reference"] == "synthetic" and doc["lot_reference"] == key
        assert rows["fixture_balances"] == (
            ("base-lot", "shop", "available", 15), ("base-lot", "shop", "damaged", 3),
            ("base-lot", "shop", "in_production", 2), ("blank-lot", "market", "available", 2),
            ("blank-lot", "shop", "available", 7), ("blank-lot", "shop", "in_production", 1))
        assert {lot: sum(r[3] for r in rows["fixture_balances"] if r[0] == lot)
                for lot in lots} == {"blank-lot": 10, "base-lot": 20}
        assert len(rows["fixture_boms"]) == 1
        bom_id, revision, raw = rows["fixture_boms"][0]
        bom = json.loads(raw)
        assert (bom_id, revision) == ("restore-gift", 1)
        assert bom == {"id": bom_id, "revision": 1, "product_slug": SLUG, "components": [
            {"component_id": "base", "units_per_item": 2, "unit": "piece"},
            {"component_id": "blank", "units_per_item": 1, "unit": "piece"}],
            "test_mode": True, "checkout_authoritative": False}
        allocations = []
        for name, expected in self.holds.items():
            hold = json.loads(dict(rows["fixture_holds"])[expected["id"]])
            assert hold["state"] == name and hold["version"] == (1 if name == "active" else 2)
            assert hold["bom"] == bom and hold["quantity"] == 1
            assert hold["test_mode"] is True and hold["checkout_authoritative"] is False
            assert sorted(hold["allocations"], key=lambda a: a["lot_id"]) == [
                {"lot_id": "base-lot", "location_id": "shop", "units": 2, "component_id": "base", "unit": "piece"},
                {"lot_id": "blank-lot", "location_id": "shop", "units": 1, "component_id": "blank", "unit": "piece"}]
            assert [a["action"] for a in hold["audit"]] == (["reserved"] if name == "active" else ["reserved", name])
            for allocation in hold["allocations"]:
                assert lots[allocation["lot_id"]][0]["component_id"] == allocation["component_id"]
                assert allocation["location_id"] in locations
                allocations.append((hold["id"], allocation["lot_id"], "shop", allocation["units"], name))
        assert rows["fixture_allocations"] == tuple(sorted(allocations))
        assert len(rows["fixture_holds"]) == 3
        for lot, location, condition, units in rows["fixture_balances"]:
            if condition == "available":
                assert sum(a[3] for a in allocations if a[1:3] == (lot, location) and a[4] == "active") <= units
        moves = {r[1]: r for r in rows["fixture_movements"]}
        commands = {r[0]: r for r in rows["fixture_hold_commands"]}
        assert len(moves) == 4 and len(commands) == 5 and not (moves.keys() & commands.keys())
        for _, payload, receipt, canonical in self.movement_commands:
            sequence, key, fingerprint, lot, raw = moves[payload["request_id"]]
            assert fingerprint == digest_document(canonical) and lot == canonical["lot_id"]
            assert json.loads(raw) == receipt
            assert receipt["version"] == payload["expected_version"] + 1
            assert receipt["actor"] == "synthetic_staff" and receipt["checkout_authoritative"] is False
        events = rows["fixture_hold_events"]
        expected_event_versions = (3, 4, 5, 6, 7)
        for index, (_, payload, receipt, canonical) in enumerate(self.commands):
            key, fingerprint, raw = commands[payload["request_id"]]
            assert fingerprint == digest_document(canonical) and json.loads(raw) == receipt
            matched = [r for r in events if r[1] == key]
            assert len(matched) == 2 and {r[2] for r in matched} == set(lots)
            for sequence, request_id, lot_id, raw in matched:
                event = json.loads(raw)
                assert sequence == index * 2 + (1 if lot_id == "base-lot" else 2)
                assert event["hold_id"] == receipt["id"] and event["request_id"] == key
                assert event["state"] == receipt["state"] and event["hold_version"] == receipt["version"]
                assert event["lot_id"] == lot_id and event["lot_version"] == expected_event_versions[index]
                assert event["audit"] == receipt["audit"][-1]
                assert event["allocations"] == [a for a in receipt["allocations"] if a["lot_id"] == lot_id]
                assert event["checkout_authoritative"] is False and event["test_mode"] is True

    def verify_ledger_replay(self, target):
        self.verify_replay(target)  # Existing retail/proof/payment replay still qualifies.
        for url, payload, expected, _ in (*self.movement_commands, *self.commands):
            assert self.post(url, payload, staff=True) == expected
            self.post(url, {**payload, "reason": "Changed contents"}, staff=True, status=409)
        # The command namespace remains shared in both directions after restore.
        move_url, move_body, _, _ = self.movement_commands[0]
        hold_url, hold_body, _, _ = self.commands[0]
        self.post(move_url, {**move_body, "request_id": hold_body["request_id"]}, staff=True, status=409)
        self.post(hold_url, {**hold_body, "request_id": move_body["request_id"]}, staff=True, status=409)
        self.post(move_url, {**move_body, "request_id": str(UUID(int=9990))}, staff=True, status=409)
        with closing(read_database(target / "state.db")) as reader:
            saved = state(reader, self.tables)
        assert saved == self.expected
        self.assert_ledger_contract(saved)


@pytest.mark.parametrize("drill", [True], indirect=True)
def test_ledger_bom_wal_restore_replay_and_sequence_continuity(drill):
    before = drill.source_bytes()
    writer = sqlite3.connect(drill.source, isolation_level=None)
    writer.execute("BEGIN IMMEDIATE")
    writer.execute("UPDATE fixture_balances SET units=999 WHERE lot_id='blank-lot'")
    try:
        drill.make_snapshot()
        target = drill.restore()
        drill.verify_ledger_replay(target)
        assert before == drill.source_bytes()
    finally:
        writer.rollback()
        writer.close()
    # A new eligible transition allocates fresh event sequences, not recycled IDs.
    active = drill.holds["active"]
    response = drill.post(LEDGER + "/reservations/" + active["id"] + "/release",
        {"request_id": str(UUID(int=9000)), "expected_version": 1,
         "lot_versions": {"base-lot": 7, "blank-lot": 7}, "reason": "Restored transition"}, staff=True)
    assert response["state"] == "released" and response["version"] == 2
    move = {**drill.movement_commands[0][1], "request_id": str(UUID(int=9001)),
            "expected_version": 8, "quantity": 1}
    drill.post(drill.movement_commands[0][0], move, staff=True)
    with closing(read_database(target / "state.db")) as reader:
        rows = state(reader, drill.tables)[1]
    assert rows["sqlite_sequence"] == (("fixture_hold_events", 12), ("fixture_movements", 5))
    assert [r[0] for r in rows["fixture_hold_events"]] == list(range(1, 13))
    assert [r[0] for r in rows["fixture_movements"]] == list(range(1, 6))
    assert json.loads(rows["fixture_hold_events"][-1][3])["hold_id"] == active["id"]
    assert dict((r[0], r[2]) for r in rows["fixture_lots"]) == {"base-lot": 8, "blank-lot": 9}
    assert sum(r[3] for r in rows["fixture_balances"] if r[0] == "blank-lot") == 11
    assert before == drill.source_bytes()


LEDGER_DAMAGE = {
    "missing-component": "DELETE FROM fixture_components WHERE id='blank'",
    "orphan-lot-component": "UPDATE fixture_lots SET document=json_set(document,'$.component_id','missing') WHERE id='blank-lot'",
    "missing-location": "DELETE FROM fixture_locations WHERE id='shop'",
    "orphan-balance-lot": "UPDATE fixture_balances SET lot_id='orphan' WHERE lot_id='blank-lot'",
    "balance-conservation": "UPDATE fixture_balances SET units=units+1 WHERE condition='available'",
    "allocation-units": "UPDATE fixture_allocations SET units=units+1 WHERE state='active'",
    "allocation-state": "UPDATE fixture_allocations SET state='released' WHERE state='active'",
    "orphan-allocation-hold": "UPDATE fixture_allocations SET hold_id='orphan' WHERE state='active'",
    "orphan-allocation-location": "UPDATE fixture_allocations SET location_id='orphan' WHERE state='active'",
    "bom-snapshot": "UPDATE fixture_holds SET document=json_set(document,'$.bom.revision',2)",
    "bom-definition": "UPDATE fixture_boms SET document=json_set(document,'$.product_slug','unknown')",
    "hold-command-fingerprint": "UPDATE fixture_hold_commands SET fingerprint='wrong'",
    "hold-command-receipt": "UPDATE fixture_hold_commands SET document=json_set(document,'$.state','released')",
    "movement-fingerprint": "UPDATE fixture_movements SET fingerprint='wrong'",
    "movement-receipt": "UPDATE fixture_movements SET document=json_set(document,'$.quantity',999)",
    "event-lot-reference": "UPDATE fixture_hold_events SET lot_id='orphan' WHERE sequence=1",
    "event-audit": "UPDATE fixture_hold_events SET document=json_set(document,'$.audit.actor','invented') WHERE sequence=1",
    "event-missing": "DELETE FROM fixture_hold_events WHERE sequence=1",
    "sequence-counter": "UPDATE sqlite_sequence SET seq=999 WHERE name='fixture_movements'",
    "sequence-event-counter": "UPDATE sqlite_sequence SET seq=0 WHERE name='fixture_hold_events'",
    "sequence-orphan": "INSERT INTO sqlite_sequence(name,seq) VALUES('orphan',42)",
    "sequence-missing": "DELETE FROM sqlite_sequence WHERE name='fixture_hold_events'",
    "unknown-table": "CREATE TABLE unrelated(value TEXT)",
    "missing-table": "DROP TABLE fixture_allocations",
    "missing-index": "DROP INDEX fixture_hold_events_by_lot",
}


@pytest.mark.parametrize("drill", [True], indirect=True)
@pytest.mark.parametrize("damage", LEDGER_DAMAGE)
def test_ledger_bom_rehashed_corruption_rejected_before_target(drill, damage):
    snapshot = drill.make_snapshot()
    before = drill.source_bytes()
    with closing(sqlite3.connect(snapshot / "state.db")) as db:
        db.execute(LEDGER_DAMAGE[damage])
        db.commit()
    reseal_digest(snapshot)
    with pytest.raises(UnsafeDrill):
        drill.restore()
    assert not (drill.root / "restored").exists()
    assert before == drill.source_bytes()
    assert drill.restored is None


@pytest.mark.parametrize("drill", [True], indirect=True)
def test_ledger_bom_preserves_active_allocation_floor_after_restore(drill):
    before = drill.source_bytes()
    drill.make_snapshot()
    target = drill.restore()
    drill.verify_ledger_replay(target)
    payload = {"request_id": str(UUID(int=9100)), "expected_version": 7, "quantity": 7,
               "source": {"location_id": "shop", "condition": "available"},
               "destination": {"location_id": "market", "condition": "available"},
               "purpose": "transfer", "reason": "Must retain active hold"}
    drill.post(LEDGER + "/lots/blank-lot/movements", payload, staff=True, status=409)
    active = drill.holds["active"]
    drill.post(LEDGER + "/reservations/" + active["id"] + "/consume",
        {"request_id": str(UUID(int=9101)), "expected_version": 1,
         "lot_versions": {"base-lot": 6, "blank-lot": 7}, "reason": "Stale one-lot CAS"}, staff=True, status=409)
    with closing(read_database(target / "state.db")) as reader:
        assert state(reader, drill.tables) == drill.expected
    assert before == drill.source_bytes()


def drill_profile(value):
    if value is False:
        return Drill
    if value is True:
        return LedgerDrill
    if type(value) is str and value == "proof":
        return ProofDrill
    if type(value) is str and value == "commercial":
        return CommercialDrill
    raise UnsafeDrill("Unknown explicit synthetic profile")


class ProofDrill(Drill):
    """Small personalized/legacy fixture; never migrates supplied databases."""

    def history(self, name, version=None, status=200):
        proof = self.proofs[name]
        url = "/v1/proofs/" + proof["id"] + "/history"
        if version is not None:
            url += "/" + str(version)
        response = self.client.get(url, headers={"Authorization": "Bearer " + proof["access_token"]})
        assert response.status_code == status, response.text
        return response.json()

    def seed(self):
        from services.commerce.app import proof_evidence
        for module in (retail, workflows, proof_evidence):
            self.monkeypatch.setattr(module, "NOW", lambda: self.now[0].isoformat())
        self.post("/v1/admin/retail-test/stock/shared", {"expected_version": 0, "on_hand": 30}, staff=True)
        self.post("/v1/admin/retail-test/offers/" + SLUG,
                  {"expected_version": 0, "unit_price_minor": 1234, "stock_id": "shared",
                   "units_per_item": 3, "pieces_per_item": 2}, staff=True)
        self.mappings = {
            "legacy": [{"set_index": 0, "piece_index": p, "text": "Synthetic café 🌼"} for p in range(2)],
            "pieces": [{"set_index": i, "piece_index": p, "text": f"Synthetic É {i}-{p} 🌼"}
                       for i in range(2) for p in range(2)],
        }
        self.decisions = {}
        for number, name in enumerate(("legacy", "pieces")):
            self.now[0] = START + timedelta(seconds=number * 3)
            personalization = ({"mode": "identical", "text": "Synthetic café 🌼"} if name == "legacy"
                               else {"mode": "per_piece", "pieces": list(reversed(self.mappings[name]))})
            payload = {"request_id": str(UUID(int=700 + number)), "items": [{
                "product_slug": SLUG, "quantity": number + 1, "personalization": personalization}]}
            cart = self.post("/v1/cart", payload)
            order = self.post("/v1/cart/" + cart["id"] + "/orders", {"version": 1}, receipt=cart)
            proof = self.post("/v1/admin/proofs", {"order_id": order["id"], "expected_proof_version": 0,
                                                  "proof_text": "Synthetic original " + name}, staff=True)
            self.carts[name], self.orders[name], self.proofs[name], self.payloads[name] = cart, order, proof, payload
            if name == "legacy":
                # Explicit fixture shaping BEFORE another history exists. This is
                # not a real migration or recovery technique for production data.
                with sqlite3.connect(self.source) as db:
                    row = db.execute("SELECT document FROM records WHERE id=?", (proof["id"],)).fetchone()
                    old = json.loads(row[0])
                    for key in ("binding_schema", "context_hash", "limitations"):
                        old.pop(key, None)
                    self.legacy_original = old
                    db.execute("UPDATE records SET document=? WHERE id=?", (json.dumps(old), proof["id"]))
                    for table in ("proof_revision_evidence", "proof_decision_evidence",
                                  "proof_material_contexts", "proof_legacy_observations"):
                        db.execute("DROP TABLE " + table)
                before = self.source_bytes()
                assert self.history(name)["items"] == []
                self.history(name, 1, status=409)
                self.post("/v1/proofs/" + proof["id"] + "/approve",
                          {"version": 1, "decision": "approve"}, receipt=proof, status=409)
                assert self.source_bytes() == before
                self.now[0] = START + timedelta(seconds=1)
                self.post("/v1/admin/proofs", {"order_id": order["id"], "expected_proof_version": 1,
                                              "proof_text": "Synthetic newly bound legacy"}, staff=True)
            version = 2 if name == "legacy" else 1
            decision = {"version": version, "decision": "approve", "comment": "Synthetic decision " + name}
            self.decisions[name] = decision
            self.now[0] = START + timedelta(seconds=2 if name == "legacy" else 4)
            self.post("/v1/proofs/" + proof["id"] + "/approve", decision, receipt=proof)
        with closing(read_database(self.source)) as reader:
            self.expected = state(reader, self.tables)
        self.assert_proof_contract(self.expected)
        self.assert_offline()

    def assert_proof_contract(self, saved):
        _, rows = saved
        docs = {r[0]: json.loads(r[3]) for r in rows["records"]}
        assert len(docs) == 6 and len(rows["requests"]) == 2
        assert len(rows["proof_material_contexts"]) == 2
        assert len(rows["proof_revision_evidence"]) == 2
        assert len(rows["proof_decision_evidence"]) == 2
        assert len(rows["proof_legacy_observations"]) == 1
        assert rows["payment_events"] == ()
        assert rows["retail_stock"] == (("shared", 30, 1),)
        assert rows["metadata"] == (("access_secret_fingerprint", sha256(SECRET.encode()).hexdigest()),)
        offer = json.loads(rows["retail_offers"][0][-1])
        assert offer["pieces_per_item"] == 2 and offer["units_per_item"] == 3
        request_rows = {r[0]: r[1:] for r in rows["requests"]}
        contexts = {r[0]: (r[1], r[2]) for r in rows["proof_material_contexts"]}
        revisions = {(r[0], r[1]): r for r in rows["proof_revision_evidence"]}
        decisions = {(r[0], r[1]): r for r in rows["proof_decision_evidence"]}
        reservations = {r[0]: r[1:] for r in rows["retail_reservations"]}
        assert len(reservations) == 2
        for number, name in enumerate(("legacy", "pieces")):
            order, cart, proof = [docs[r[name]["id"]] for r in (self.orders, self.carts, self.proofs)]
            quantity, version = number + 1, 2 if name == "legacy" else 1
            assert order["items"] == cart["items"] and order["lines"] == cart["lines"]
            assert len(order["items"]) == len(order["lines"]) == 1
            assert order["total_minor"] == 1234 * quantity and order["currency"] == "USD"
            assert order["payment_status"] == "unpaid" and order["reservation_status"] == "active"
            assert (order["current_proof_id"], order["current_proof_version"],
                    order["approved_proof_version"]) == (proof["id"], version, version)
            assert proof["approved_version"] == proof["version"] == version
            assert proof["status"] == "approved" and order["status"] == "awaiting_payment"
            normalized = retail.CartRequest.model_validate(self.payloads[name]).model_dump(mode="json")
            assert request_rows["retail-cart:" + normalized["request_id"]] == (retail.fingerprint(normalized), cart["id"])
            assert order["cart_id"] == cart["id"] and cart["order_id"] == order["id"]
            item, line = order["items"][0], order["lines"][0]
            expected_item = {"product_slug": SLUG, "quantity": quantity, "text": "", "secondary": "",
                             "font": "Classic serif", "options": {}, "notes": "", "artwork_name": "",
                             "gift": False, "gift_message": "", "photo_brief": None,
                             "personalization": self.payloads[name]["items"][0]["personalization"]}
            assert item == expected_item
            assert item["personalization"] == self.payloads[name]["items"][0]["personalization"]
            assert line["item"] == item
            assert (line["stock_id"], line["stock_units"], line["unit_price_minor"],
                    line["line_total_minor"], line["offer_version"]) == ("shared", 3 * quantity, 1234, 1234 * quantity, 1)
            assert line["personalization_snapshot"] == {
                "schema_version": 1, "mode": "identical" if name == "legacy" else "per_piece",
                "line_index": 0, "quantity": quantity, "pieces_per_item": 2, "pieces": self.mappings[name]}
            assert reservations[order["id"]] == ("shared", 3 * quantity, "active")
            row = revisions[(proof["id"], version)]
            _, _, oid, digest, at, raw = row
            assert oid == order["id"] and contexts[digest][0] == oid
            raw_context = contexts[digest][1]
            expected_mapping = {"schema_version": 1, "mode": "identical" if name == "legacy" else "per_piece",
                                "line_index": 0, "quantity": quantity, "pieces_per_item": 2,
                                "pieces": self.mappings[name]}
            expected_line = {"item": expected_item, "offer_version": 1, "unit_price_minor": 1234,
                             "line_total_minor": 1234 * quantity, "stock_id": "shared",
                             "stock_units": 3 * quantity, "personalization_snapshot": expected_mapping}
            expected_material = {"order_id": oid, "items": [expected_item], "lines": [expected_line],
                                 "total_minor": 1234 * quantity, "currency": "USD"}
            expected_bytes = json.dumps(expected_material, sort_keys=True, separators=(",", ":"),
                                        ensure_ascii=False, allow_nan=False).encode("utf-8")
            assert raw_context.encode("utf-8") == expected_bytes
            assert sha256(expected_bytes).hexdigest() == digest
            assert json.loads(raw_context) == {"order_id": oid, "items": order["items"], "lines": order["lines"],
                                               "total_minor": 1234 * quantity, "currency": "USD"}
            revision = json.loads(raw)
            wording = "Synthetic newly bound legacy" if name == "legacy" else "Synthetic original pieces"
            assert revision["proof_text"] == proof["proof_text"] == wording
            assert (revision["proof_id"], revision["order_id"], revision["version"], revision["context_hash"],
                    revision["prepared_at"]) == (proof["id"], oid, version, digest, at)
            assert revision["actor_scope"] == "shared synthetic staff credential"
            assert type(revision["schema_version"]) is int and revision["schema_version"] == 1
            assert at == (START + timedelta(seconds=1 if name == "legacy" else 3)).isoformat()
            decision_row = decisions[(proof["id"], version)]
            assert decision_row[2] == 1
            decision = json.loads(decision_row[3])
            assert (decision["proof_id"], decision["order_id"], decision["version"], decision["context_hash"],
                    decision["action"], decision["comment"]) == (proof["id"], oid, version, digest,
                                                                "approve", "Synthetic decision " + name)
            assert decision["actor_scope"] == "holder of this private proof capability"
            assert type(decision["schema_version"]) is int and decision["schema_version"] == 1
            assert decision["sequence"] == 1
            assert decision["recorded_at"] == (START + timedelta(seconds=2 if name == "legacy" else 4)).isoformat()
        pid, version, captured, raw = rows["proof_legacy_observations"][0]
        assert (pid, version) == (self.proofs["legacy"]["id"], 1)
        observed = json.loads(raw)
        assert observed == self.legacy_original
        assert observed["proof_text"] == "Synthetic original legacy" and observed["approved_version"] is None
        assert "context_hash" not in observed and "binding_schema" not in observed
        assert (pid, 1) not in revisions and (pid, 1) not in decisions
        assert captured == (START + timedelta(seconds=1)).isoformat()
        assert observed["created_at"] == START.isoformat()
        for record_id, kind, token_hash, raw in rows["records"]:
            assert docs[record_id]["id"] == record_id and docs[record_id]["kind"] == kind
            assert token_hash == sha256(workflows.access_token(record_id).encode()).hexdigest()

    def verify_replay(self, target):
        self.validate_bundle(target)
        self.monkeypatch.setenv("SONORAN_DB_PATH", str(target / "state.db"))
        self.assert_offline()
        for name in ("legacy", "pieces"):
            cart = self.post("/v1/cart", self.payloads[name])
            assert (cart["id"], cart["access_token"]) == (self.carts[name]["id"], self.carts[name]["access_token"])
            order = self.post("/v1/cart/" + cart["id"] + "/orders", {"version": 1}, receipt=cart)
            assert (order["id"], order["access_token"]) == (self.orders[name]["id"], self.orders[name]["access_token"])
            changed_payload = json.loads(json.dumps(self.payloads[name]))
            customization = changed_payload["items"][0]["personalization"]
            if name == "legacy":
                customization["text"] = "Changed synthetic inscription"
            else:
                customization["pieces"][0]["text"] = "Changed synthetic inscription"
            self.post("/v1/cart", changed_payload, status=409)
            proof = self.proofs[name]
            version = 2 if name == "legacy" else 1
            history = self.history(name)
            assert [r["version"] for r in history["items"]] == [version]
            assert history["legacy_history_unknown"] is (name == "legacy")
            detail = self.history(name, version)
            assert detail["revision"]["version"] == version
            self.post("/v1/proofs/" + proof["id"] + "/approve", self.decisions[name], receipt=proof)
            changed = {**self.decisions[name], "comment": "Changed synthetic decision"}
            self.post("/v1/proofs/" + proof["id"] + "/approve", changed, receipt=proof, status=409)
            assert self.client.get("/v1/proofs/" + proof["id"] + "/history").status_code == 404
        self.history("legacy", 1, status=409)
        self.post("/v1/proofs/" + self.proofs["legacy"]["id"] + "/approve",
                  {"version": 1, "decision": "approve"}, receipt=self.proofs["legacy"], status=409)
        with closing(read_database(target / "state.db")) as reader:
            actual = state(reader, self.tables)
        assert actual == self.expected
        self.assert_proof_contract(actual)
        self.restored = target


@pytest.mark.parametrize("drill", ["proof"], indirect=True)
def test_personalized_legacy_proof_roundtrip(drill):
    original = drill.source_bytes()
    drill.make_snapshot()
    target = drill.restore()
    drill.verify_replay(target)
    assert drill.source_bytes() == original


@pytest.mark.parametrize("value", [None, 0, 1, "", "ledger", "unknown", [], {}])
def test_restore_profile_rejects_unknown_selection(value):
    with pytest.raises(UnsafeDrill, match="Unknown explicit"):
        drill_profile(value)


@pytest.mark.parametrize("drill", ["proof"], indirect=True)
@pytest.mark.parametrize("damage", [
    "mapping", "stock_piece_confusion", "context_text", "context_hash", "context_order",
    "legacy_wording", "legacy_approval", "legacy_bound", "legacy_version", "legacy_owner",
    "revision_wording", "revision_version", "revision_context", "decision_comment", "decision_version",
    "decision_context", "unknown_table", "orphan_observation",
])
def test_personalized_legacy_rehashed_corruption_rejected(drill, damage):
    original = drill.source_bytes()
    bundle = drill.make_snapshot()
    path = bundle / "state.db"
    pid = drill.proofs["legacy"]["id"]
    with sqlite3.connect(path) as db:
        if damage == "unknown_table":
            db.execute("CREATE TABLE unexpected (value TEXT)")
        elif damage in {"mapping", "stock_piece_confusion"}:
            oid = drill.orders["pieces"]["id"]
            doc = json.loads(db.execute("SELECT document FROM records WHERE id=?", (oid,)).fetchone()[0])
            if damage == "mapping":
                doc["lines"][0]["personalization_snapshot"]["pieces"][0]["text"] = "Changed"
            else:
                doc["lines"][0]["personalization_snapshot"]["pieces_per_item"] = 3
            db.execute("UPDATE records SET document=? WHERE id=?", (json.dumps(doc), oid))
        elif damage.startswith("legacy_"):
            doc = json.loads(db.execute("SELECT document FROM proof_legacy_observations").fetchone()[0])
            key, value = {"legacy_wording": ("proof_text", "Invented"), "legacy_approval": ("approved_version", 1),
                          "legacy_bound": ("context_hash", "0"*64), "legacy_version": ("version", 2),
                          "legacy_owner": ("order_id", "wrong")}[damage]
            doc[key] = value
            db.execute("UPDATE proof_legacy_observations SET document=?", (json.dumps(doc),))
        elif damage == "orphan_observation":
            db.execute("UPDATE proof_legacy_observations SET proof_id='unknown'")
        elif damage.startswith("context_"):
            if damage == "context_hash":
                db.execute("UPDATE proof_material_contexts SET hash=? WHERE order_id=?", ("0"*64, drill.orders["legacy"]["id"]))
            elif damage == "context_order":
                db.execute("UPDATE proof_material_contexts SET order_id='unknown'")
            else:
                raw = db.execute("SELECT document FROM proof_material_contexts LIMIT 1").fetchone()[0]
                doc = json.loads(raw); doc["items"][0]["personalization"]["text"] = "Changed"
                db.execute("UPDATE proof_material_contexts SET document=? WHERE document=?", (json.dumps(doc), raw))
        else:
            table = "proof_revision_evidence" if damage.startswith("revision") else "proof_decision_evidence"
            doc = json.loads(db.execute("SELECT document FROM " + table + " WHERE proof_id=?", (pid,)).fetchone()[0])
            key = {"revision_wording": "proof_text", "revision_version": "version", "revision_context": "context_hash",
                   "decision_comment": "comment", "decision_version": "version", "decision_context": "context_hash"}[damage]
            doc[key] = 1 if key == "version" else "changed"
            db.execute("UPDATE " + table + " SET document=? WHERE proof_id=?", (json.dumps(doc), pid))
    reseal_digest(bundle)
    with pytest.raises(UnsafeDrill):
        drill.restore("rejected")
    assert not (drill.root / "rejected").exists()
    assert drill.source_bytes() == original


# Commercial test fixtures are a separate explicit profile, not a discovered whitelist.
COMMERCIAL = "/v1/admin/retail-test/commercial"
COMMERCIAL_TABLES = tuple(sorted((*TABLES, "fixture_commercial_snapshots",
    "fixture_commercial_commands", "fixture_commercial_sets",
    "fixture_commercial_pointer", "fixture_commercial_publications")))
COMMERCIAL_SCOPE = {"test_mode": True, "owner_approved": False, "production_approved": False}
COMMERCIAL_DOMAINS = ["options", "tax", "machine_profiles", "owner_identity", "production"]
COMMERCIAL_AT = (START + timedelta(seconds=10)).isoformat()


class CommercialDrill(Drill):
    def audit(self, action, reason):
        return {"action": action, "reason": reason, "recorded_at": COMMERCIAL_AT,
                "actor": "synthetic_staff",
                "actor_scope": "shared staff test credential; not an owner or individual reviewer"}

    def command(self, url, body, canonical, expected):
        # Establish the oracle before observing the API response.
        expected = json.loads(json.dumps(expected))
        result = self.post(url, body, staff=True)
        assert result == expected
        self.commercial_commands.append((url, body, canonical, expected))
        return expected

    def references(self, revision):
        return {kind: {"snapshot_id": "restore-" + kind, "revision": revision}
                for kind in ("catalog", "prices", "policies")}

    def seed(self):
        from services.commerce.app import commercial_snapshots
        super().seed()
        self.monkeypatch.setattr(commercial_snapshots, "NOW", lambda: COMMERCIAL_AT)
        self.commercial_commands = []
        self.snapshots, self.manifests, self.publications = {}, {}, {}
        self.retired = False
        serial = 20000
        for revision in (1, 2):
            for kind in ("catalog", "prices", "policies"):
                key = "restore-" + kind
                rows = {"catalog": [{"product_slug": SLUG, "fixture_eligible": True}],
                        "prices": [{"product_slug": SLUG, "variant_key": "fixture-standard",
                                    "unit_price_minor": 1234 if revision == 1 else 2345, "currency": "USD"}],
                        "policies": [{"policy_key": "fixture-policy",
                                      "fixture_text": "Synthetic café policy " + str(revision)}]}[kind]
                body = {"request_id": str(UUID(int=serial)), "previous_revision": revision - 1,
                        "source_reference": "fixture-source", "kind": kind, "rows": rows}
                serial += 1
                doc = {"id": key, "revision": revision, "kind": kind,
                       "source_reference": "fixture-source", "rows": rows,
                       "audit": [self.audit("draft_created", "Explicit synthetic fixture draft")],
                       **COMMERCIAL_SCOPE, "status": "draft", "lifecycle_version": 1}
                url = COMMERCIAL + "/snapshots/" + key + "/versions/" + str(revision)
                self.command(url, body, {"operation": "create_snapshot", "id": key,
                                        "revision": revision, **body}, doc)
                review = {"request_id": str(UUID(int=serial)), "expected_lifecycle_version": 1,
                          "decision": "approve_test", "reason": "Synthetic approval"}
                serial += 1
                doc = {**doc, "audit": doc["audit"] + [self.audit("approve_test", "Synthetic approval")],
                       "status": "approved_test", "lifecycle_version": 2}
                self.command(url + "/review-test", review,
                             {"operation": "review_snapshot", "id": key, "revision": revision, **review}, doc)
                self.snapshots[(key, revision)] = doc
            set_id = "set-a" if revision == 1 else "set-b"
            refs = self.references(revision)
            hashes = {kind: digest_document({k: self.snapshots[("restore-" + kind, revision)][k]
                        for k in ("id", "revision", "kind", "source_reference", "rows")})
                      for kind in ("catalog", "prices", "policies")}
            manifest = {"id": set_id, "references": refs, "content_hashes": hashes,
                        "audit": [self.audit("test_set_created", "Exact synthetic snapshot composition")],
                        "unqualified_domains": COMMERCIAL_DOMAINS, **COMMERCIAL_SCOPE}
            body = {"request_id": str(UUID(int=serial)), **refs}; serial += 1
            self.command(COMMERCIAL + "/sets/" + set_id, body,
                         {"operation": "create_set", "id": set_id, **body}, manifest)
            self.manifests[set_id] = manifest
        for version, set_id, action in ((1, "set-a", "publish_test"),
                                       (2, "set-b", "publish_test"), (3, "set-a", "rollback_test")):
            body = {"request_id": str(UUID(int=serial)), "expected_pointer_version": version - 1,
                    "set_id": set_id, "action": action, "reason": "Synthetic selection"}
            serial += 1
            pointer = {"set_id": set_id, "pointer_version": version,
                       "audit": self.audit(action, "Synthetic selection"), **COMMERCIAL_SCOPE}
            self.command(COMMERCIAL + "/current-test", body, {"operation": "select_set", **body}, pointer)
            self.publications[version] = pointer
        self.tables = COMMERCIAL_TABLES
        self.refresh_expectation()

    def refresh_expectation(self):
        with closing(read_database(self.source)) as reader:
            saved = state(reader, self.tables)
        self.assert_seed_contract(saved)
        self.assert_commercial_contract(saved)
        self.expected = saved  # Accepted only after independent exact namespace assertions.

    def assert_commercial_contract(self, saved):
        schema, rows = saved
        assert tuple(sorted(rows)) == COMMERCIAL_TABLES
        assert "sqlite_sequence" not in rows
        expected_schema = {
            "fixture_commercial_snapshots": "CREATE TABLE fixture_commercial_snapshots (id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved_test','retired_test')), lifecycle_version INTEGER NOT NULL, document TEXT NOT NULL, PRIMARY KEY(id,revision))",
            "fixture_commercial_commands": "CREATE TABLE fixture_commercial_commands (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, document TEXT NOT NULL)",
            "fixture_commercial_sets": "CREATE TABLE fixture_commercial_sets (id TEXT PRIMARY KEY, document TEXT NOT NULL)",
            "fixture_commercial_pointer": "CREATE TABLE fixture_commercial_pointer (slot TEXT PRIMARY KEY CHECK(slot='current'), version INTEGER NOT NULL, document TEXT NOT NULL)",
            "fixture_commercial_publications": "CREATE TABLE fixture_commercial_publications (version INTEGER PRIMARY KEY, set_id TEXT NOT NULL, document TEXT NOT NULL)",
        }
        assert {name: sql for kind, name, table, sql in schema
                if kind == "table" and name.startswith("fixture_commercial_")} == expected_schema
        expected_indexes = {
            ("index", "sqlite_autoindex_fixture_commercial_snapshots_1", "fixture_commercial_snapshots", None),
            ("index", "sqlite_autoindex_fixture_commercial_commands_1", "fixture_commercial_commands", None),
            ("index", "sqlite_autoindex_fixture_commercial_sets_1", "fixture_commercial_sets", None),
            ("index", "sqlite_autoindex_fixture_commercial_pointer_1", "fixture_commercial_pointer", None),
            ("index", "fixture_commercial_publication_sets", "fixture_commercial_publications",
             "CREATE INDEX fixture_commercial_publication_sets ON fixture_commercial_publications(set_id)"),
        }
        assert {entry for entry in schema if entry[0] == "index" and entry[2] in expected_schema} == expected_indexes
        assert ("index", "fixture_commercial_publication_sets", "fixture_commercial_publications",
                "CREATE INDEX fixture_commercial_publication_sets ON fixture_commercial_publications(set_id)") in schema
        expected_snapshots = tuple(sorted((key, rev, doc["kind"], doc["status"],
            doc["lifecycle_version"], json.dumps(doc)) for (key, rev), doc in self.snapshots.items()))
        assert rows["fixture_commercial_snapshots"] == expected_snapshots
        assert rows["fixture_commercial_sets"] == tuple(sorted(
            (key, json.dumps(doc)) for key, doc in self.manifests.items()))
        assert rows["fixture_commercial_publications"] == tuple(
            (v, doc["set_id"], json.dumps(doc)) for v, doc in sorted(self.publications.items()))
        assert rows["fixture_commercial_pointer"] == (("current", 3, json.dumps(self.publications[3])),)
        assert rows["fixture_commercial_commands"] == tuple(sorted(
            (body["request_id"], digest_document(canonical), json.dumps(receipt))
            for _, body, canonical, receipt in self.commercial_commands))
        # No relationship is inferred from runtime-returned data.
        for manifest in self.manifests.values():
            for kind, ref in manifest["references"].items():
                doc = self.snapshots[(ref["snapshot_id"], ref["revision"])]
                assert doc["kind"] == kind
                assert manifest["content_hashes"][kind] == digest_document(
                    {k: doc[k] for k in ("id", "revision", "kind", "source_reference", "rows")})
        for doc in (*self.snapshots.values(), *self.manifests.values(), *self.publications.values()):
            assert doc["test_mode"] is True
            assert doc["owner_approved"] is False and doc["production_approved"] is False

    def retire_current(self):
        key, revision = "restore-prices", 1
        body = {"request_id": str(UUID(int=29990)), "expected_lifecycle_version": 2,
                "decision": "retire_test", "reason": "Synthetic retirement"}
        old = self.snapshots[(key, revision)]
        doc = {**old, "status": "retired_test", "lifecycle_version": 3,
               "audit": old["audit"] + [self.audit("retire_test", "Synthetic retirement")]}
        self.command(COMMERCIAL + "/snapshots/" + key + "/versions/1/review-test", body,
                     {"operation": "review_snapshot", "id": key, "revision": 1, **body}, doc)
        self.snapshots[(key, revision)] = doc
        self.retired = True
        self.refresh_expectation()

    def verify_commercial_replay(self, target):
        self.restored = None
        try:
            super().verify_replay(target)
        finally:
            # Base replay success is not completion of this larger profile.
            self.restored = None
        for url, body, _, expected in self.commercial_commands:
            assert self.post(url, body, staff=True) == expected
            altered = json.loads(json.dumps(body))
            if "reason" in altered:
                altered["reason"] = "Conflicting synthetic reason"
            elif "source_reference" in altered:
                altered["source_reference"] = "conflicting-source"
            else:
                altered["catalog"]["revision"] = 2 if altered["catalog"]["revision"] == 1 else 1
            self.post(url, altered, staff=True, status=409)
        current = self.client.get(COMMERCIAL + "/current-test",
                                  headers={"Authorization": "Bearer " + STAFF})
        assert current.status_code == (409 if self.retired else 200)
        if not self.retired:
            expected = {**self.publications[3], "manifest": self.manifests["set-a"],
                        "snapshots": {k: self.snapshots[("restore-" + k, 1)]
                                      for k in ("catalog", "prices", "policies")}}
            assert current.json() == expected
        self.post(COMMERCIAL + "/current-test",
            {"request_id": str(UUID(int=29991)), "expected_pointer_version": 2,
             "set_id": "set-b", "action": "publish_test", "reason": "Stale synthetic pointer"},
            staff=True, status=409)
        comparison = self.post(COMMERCIAL + "/compare/snapshots",
            {"before": {"snapshot_id": "restore-prices", "revision": 2},
             "after": {"snapshot_id": "restore-prices", "revision": 2}}, staff=True)
        assert comparison["changes"] == []
        assert comparison["owner_approved"] is False and comparison["production_approved"] is False
        with closing(read_database(target / "state.db")) as reader:
            saved = state(reader, self.tables)
        assert saved == self.expected
        self.assert_commercial_contract(saved)
        self.restored = target


@pytest.mark.parametrize("drill", ["commercial"], indirect=True)
@pytest.mark.parametrize("retired", [False, True])
def test_commercial_restore_exact_replay_retirement_and_continuation(drill, retired):
    if retired:
        drill.retire_current()
    original = drill.source_bytes()
    drill.make_snapshot()
    target = drill.restore()
    drill.verify_commercial_replay(target)
    # The next valid publication advances the restored version, without reusing history.
    result = drill.post(COMMERCIAL + "/current-test",
        {"request_id": str(UUID(int=29992)), "expected_pointer_version": 3,
         "set_id": "set-b", "action": "publish_test", "reason": "Restored synthetic publication"}, staff=True)
    expected = {"set_id": "set-b", "pointer_version": 4,
        "audit": drill.audit("publish_test", "Restored synthetic publication"), **COMMERCIAL_SCOPE}
    assert result == expected
    with closing(read_database(target / "state.db")) as reader:
        rows = state(reader, drill.tables)[1]
    assert rows["fixture_commercial_publications"][:3] == drill.expected[1]["fixture_commercial_publications"]
    assert rows["fixture_commercial_publications"][3] == (4, "set-b", json.dumps(expected))
    assert rows["fixture_commercial_pointer"] == (("current", 4, json.dumps(expected)),)
    assert drill.source_bytes() == original


COMMERCIAL_DAMAGE = {
    "missing-snapshot": "DELETE FROM fixture_commercial_snapshots WHERE id='restore-prices' AND revision=1",
    "orphan-reference": "UPDATE fixture_commercial_sets SET document=json_set(document,'$.references.prices.snapshot_id','orphan') WHERE id='set-a'",
    "lifecycle": "UPDATE fixture_commercial_snapshots SET lifecycle_version=9 WHERE id='restore-prices' AND revision=1",
    "audit": "UPDATE fixture_commercial_snapshots SET document=json_set(document,'$.audit[0].actor','invented-owner') WHERE id='restore-prices' AND revision=1",
    "pointer": "UPDATE fixture_commercial_pointer SET version=2",
    "publication": "DELETE FROM fixture_commercial_publications WHERE version=2",
    "receipt": "UPDATE fixture_commercial_commands SET document=json_set(document,'$.owner_approved',json('true'))",
    "fingerprint": "UPDATE fixture_commercial_commands SET fingerprint='changed'",
    "unknown-table": "CREATE TABLE unauthorized_fixture(value TEXT)",
    "index": "DROP INDEX fixture_commercial_publication_sets",
}


@pytest.mark.parametrize("drill", ["commercial"], indirect=True)
@pytest.mark.parametrize("damage", list(COMMERCIAL_DAMAGE) + ["recomputed-content"])
def test_commercial_resealed_corruption_rejected_before_target(drill, damage):
    original = drill.source_bytes()
    bundle = drill.make_snapshot()
    with sqlite3.connect(bundle / "state.db") as db:
        if damage != "recomputed-content":
            db.execute(COMMERCIAL_DAMAGE[damage])
        else:
            raw = db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='restore-prices' AND revision=1").fetchone()[0]
            doc = json.loads(raw)
            doc["rows"][0]["unit_price_minor"] = 9999
            db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='restore-prices' AND revision=1", (json.dumps(doc),))
            manifest = json.loads(db.execute("SELECT document FROM fixture_commercial_sets WHERE id='set-a'").fetchone()[0])
            manifest["content_hashes"]["prices"] = digest_document({k: doc[k] for k in ("id","revision","kind","source_reference","rows")})
            db.execute("UPDATE fixture_commercial_sets SET document=? WHERE id='set-a'", (json.dumps(manifest),))
    reseal_digest(bundle)
    with pytest.raises(UnsafeDrill):
        drill.restore("rejected")
    assert not (drill.root / "rejected").exists()
    assert drill.source_bytes() == original


@pytest.mark.parametrize("drill", ["commercial"], indirect=True)
def test_commercial_wal_snapshot_excludes_uncommitted_pointer_change(drill):
    original = drill.source_bytes()
    writer = sqlite3.connect(drill.source, isolation_level=None)
    writer.execute("BEGIN IMMEDIATE")
    writer.execute("UPDATE fixture_commercial_pointer SET version=999")
    try:
        drill.make_snapshot()
        target = drill.restore()
        drill.verify_commercial_replay(target)
        assert drill.source_bytes() == original
    finally:
        writer.rollback()
        writer.close()
    assert drill.source_bytes() == original
@pytest.mark.parametrize("drill", ["commercial"], indirect=True)
@pytest.mark.parametrize("failure_stage", ["first-command", "final-contract"])
def test_commercial_interruption_never_marks_profile_complete(drill, monkeypatch, failure_stage):
    drill.make_snapshot()
    target = drill.restore()
    drill.verify_commercial_replay(target)
    assert drill.restored == target
    target = drill.restore("interrupted-target")
    original_post = drill.post
    original_contract = drill.assert_commercial_contract

    def interrupted_post(url, *args, **kwargs):
        if url.startswith(COMMERCIAL):
            assert drill.restored is None
            raise RuntimeError("Synthetic commercial interruption")
        return original_post(url, *args, **kwargs)

    def interrupted_contract(saved):
        assert drill.restored is None
        raise RuntimeError("Synthetic commercial interruption")

    if failure_stage == "first-command":
        monkeypatch.setattr(drill, "post", interrupted_post)
    else:
        monkeypatch.setattr(drill, "assert_commercial_contract", interrupted_contract)
    with pytest.raises(RuntimeError, match="Synthetic commercial interruption"):
        drill.verify_commercial_replay(target)
    assert drill.restored is None
    monkeypatch.setattr(drill, "post", original_post)
    monkeypatch.setattr(drill, "assert_commercial_contract", original_contract)
    target = drill.restore("retry-target")
    drill.verify_commercial_replay(target)
    assert drill.restored == target


@pytest.mark.parametrize("drill", ["commercial"], indirect=True)
def test_commercial_rechecking_used_target_clears_prior_success(drill):
    drill.make_snapshot()
    target = drill.restore()
    drill.verify_commercial_replay(target)
    assert drill.restored == target
    # Replaying the app may leave WAL sidecars: existing bundle guards still apply.
    with pytest.raises(UnsafeDrill):
        drill.verify_commercial_replay(target)
    assert drill.restored is None
