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
        cls = LedgerDrill if getattr(request, "param", False) else Drill
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
