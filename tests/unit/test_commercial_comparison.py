import json
import os
from pathlib import Path
import sqlite3

import pytest
from test_commerce_workflows import connected, staff
from test_commercial_snapshots import BASE, SLUG, OTHER, create, review, fixture, select, assert_scope
from services.commerce.app import commercial_comparison as comparison
from services.commerce.app.workflows import database

URL = BASE + "/compare"


def compare(c, before="one", after="two", kind="snapshots", revision=1):
    body = {"before": before, "after": after}
    if kind == "snapshots":
        body = {k: {"snapshot_id": v, "revision": revision} for k, v in body.items()}
    return c.post(URL + "/" + kind, json=body, headers=staff())


def setup(c, monkeypatch, kind="catalog", rows=None):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    assert create(c, "one", kind).status_code == 200
    extra = {"rows": rows} if rows is not None else {}
    assert create(c, "two", kind, **extra).status_code == 200


def image():
    path = Path(os.environ["SONORAN_DB_PATH"])
    with sqlite3.connect(path) as db:
        return list(db.iterdump())


def test_same_and_reordered_rows_are_deterministic(connected, monkeypatch):
    rows = [{"product_slug": SLUG, "fixture_eligible": True},
            {"product_slug": OTHER, "fixture_eligible": False}]
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    for name, values in (("one", rows), ("two", list(reversed(rows)))):
        assert create(connected, name, rows=values).status_code == 200
    assert compare(connected).json()["changes"] == []
    result = compare(connected, "one", "one").json()
    assert_scope(result)
    assert result["comparison_only"] is True
    assert result["unqualified_domains"] == comparison.UNQUALIFIED


def test_catalog_add_remove_and_eligibility(connected, monkeypatch):
    setup(connected, monkeypatch, rows=[{"product_slug": OTHER, "fixture_eligible": False}])
    changes = compare(connected).json()["changes"]
    assert [c["key"]["product_slug"] for c in changes] == sorted([SLUG, OTHER])
    assert {c["change"] for c in changes} == {"added", "removed"}
    assert create(connected, "three", rows=[{"product_slug": SLUG, "fixture_eligible": False}]).status_code == 200
    change = compare(connected, "one", "three").json()["changes"][0]
    assert change["before"]["fixture_eligible"] is True and change["after"]["fixture_eligible"] is False


@pytest.mark.parametrize("amount,delta", [(1,-1233),(1234,0),(99999999,99998765)])
def test_price_integer_deltas(connected, monkeypatch, amount, delta):
    setup(connected, monkeypatch, "prices", [{"product_slug": SLUG, "variant_key": "fixture-standard",
                                           "unit_price_minor": amount}])
    data = compare(connected).json()
    assert data["changes"] == [] if delta == 0 else data["changes"][0]["unit_price_delta_minor"] == delta


def test_variant_add_remove_delta_is_not_invented(connected, monkeypatch):
    setup(connected, monkeypatch, "prices", [{"product_slug": SLUG, "variant_key": "fixture-other",
                                           "unit_price_minor": 2000}])
    changes = compare(connected).json()["changes"]
    assert {x["change"] for x in changes} == {"added", "removed"}
    assert all(x["unit_price_delta_minor"] is None for x in changes)


def test_policy_text_exact_difference(connected, monkeypatch):
    setup(connected, monkeypatch, "policies", [{"policy_key": "fixture-policy", "fixture_text": "Changed test text"}])
    assert compare(connected).json()["changes"][0]["after"]["fixture_text"] == "Changed test text"


def test_lifecycle_is_visible_without_readiness(connected, monkeypatch):
    setup(connected, monkeypatch)
    assert review(connected, "two", decision="retire_test").status_code == 200
    data = compare(connected).json()
    assert data["after"]["status"] == "retired_test" and data["lifecycle_changed"]
    assert data["changes"] == []
    assert_scope(data)


def test_cross_kind_and_missing_exact_revision(connected, monkeypatch):
    setup(connected, monkeypatch)
    assert create(connected, "price", "prices").status_code == 200
    assert compare(connected, "one", "price").status_code == 409
    assert compare(connected, revision=2).status_code == 404
    assert compare(connected, "missing", "one").status_code == 404


@pytest.mark.parametrize("bad", [True, "1", 0, -1, 1000001, None])
def test_revision_types_and_bounds(connected, monkeypatch, bad):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    r = connected.post(URL+"/snapshots", headers=staff(), json={
        "before":{"snapshot_id":"one","revision":bad},"after":{"snapshot_id":"two","revision":1}})
    assert r.status_code == 422
    assert not Path(os.environ["SONORAN_DB_PATH"]).exists()


@pytest.mark.parametrize("body", [
    {"before":"one","after":"two","owner_approved":True},
    {"before":1,"after":"two"}, {"before":"../one","after":"two"},
    {"before":"one"}, {"before":None,"after":"two"}])
def test_set_input_rejects_authority_and_bad_identity(connected, monkeypatch, body):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    assert connected.post(URL+"/sets",headers=staff(),json=body).status_code == 422


def test_missing_database_does_not_create_parent(connected, monkeypatch, tmp_path):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    path = tmp_path/"absent"/"nested"/"test.sqlite3"
    monkeypatch.setenv("SONORAN_DB_PATH", str(path))
    assert compare(connected).status_code == 404
    assert not path.parent.exists()


def test_missing_tables_does_not_initialize(connected, monkeypatch):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED", "true")
    path = Path(os.environ["SONORAN_DB_PATH"])
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE unrelated(value TEXT)")
    before = path.read_bytes()
    assert compare(connected).status_code == 409
    assert path.read_bytes() == before
    assert image() == ["BEGIN TRANSACTION;", "CREATE TABLE unrelated(value TEXT);", "COMMIT;"]


def test_no_writes_on_repeated_snapshot_and_set_comparison(connected, monkeypatch):
    fixture(connected, monkeypatch, "one")
    fixture(connected, monkeypatch, "two", amount=2222)
    assert select(connected).status_code == 200
    before = image()
    for _ in range(3):
        assert compare(connected,"one-prices","two-prices").status_code == 200
        result = compare(connected, kind="sets")
        assert result.status_code == 200
        assert result.json()["comparisons"]["prices"]["changes"][0]["unit_price_delta_minor"] == 988
        assert_scope(result.json())
    assert image() == before


def test_retired_reference_fails_set_comparison_closed(connected, monkeypatch):
    fixture(connected, monkeypatch, "one")
    fixture(connected, monkeypatch, "two")
    assert review(connected,"two-catalog",expected_lifecycle_version=2,decision="retire_test").status_code == 200
    before = image()
    assert compare(connected,kind="sets").status_code == 409
    assert image() == before


@pytest.mark.parametrize("mutation", ["rows","audit","references","hash","kind"])
def test_corrupt_state_fails_closed_without_write(connected,monkeypatch,mutation):
    fixture(connected,monkeypatch,"one")
    fixture(connected,monkeypatch,"two")
    with database() as db:
        if mutation in ("references","hash"):
            doc=json.loads(db.execute("SELECT document FROM fixture_commercial_sets WHERE id='two'").fetchone()[0])
            doc["references" if mutation=="references" else "content_hashes"]=[]
            db.execute("UPDATE fixture_commercial_sets SET document=? WHERE id='two'",(json.dumps(doc),))
        else:
            doc=json.loads(db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='two-catalog'").fetchone()[0])
            doc[mutation]=None
            db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='two-catalog'",(json.dumps(doc),))
    before=image()
    assert compare(connected,kind="sets").status_code == 409
    assert image()==before


def test_storage_corruption_bounded(connected,monkeypatch):
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED","true")
    path=Path(os.environ["SONORAN_DB_PATH"]);path.write_bytes(b"not sqlite")
    assert compare(connected).status_code==409
    assert path.read_bytes()==b"not sqlite"


def test_secret_binding_preserved_without_repair(connected,monkeypatch):
    setup(connected,monkeypatch)
    before=image()
    monkeypatch.setenv("SONORAN_ACCESS_SECRET","different-fixture-secret-"+"z"*40)
    assert compare(connected).status_code==503
    assert image()==before


def test_missing_secret_binding_not_initialized(connected,monkeypatch):
    setup(connected,monkeypatch)
    with database() as db:
        db.execute("DELETE FROM metadata")
    before=image()
    assert compare(connected).status_code==503
    assert image()==before


def test_staff_stage_and_feature_gates(connected,monkeypatch):
    setup(connected,monkeypatch)
    body={"before":"one","after":"two"}
    assert connected.post(URL+"/sets",json=body).status_code==401
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED","false")
    assert compare(connected).status_code==503
    monkeypatch.setenv("SONORAN_RETAIL_TEST_ENABLED","true")
    monkeypatch.setenv("SONORAN_STAGE","production")
    assert compare(connected).status_code==503


def test_read_connection_cannot_write(connected,monkeypatch):
    setup(connected,monkeypatch)
    with comparison.read_database() as db:
        with pytest.raises(sqlite3.OperationalError):
            db.execute("CREATE TABLE forbidden(x)")
        with pytest.raises(sqlite3.OperationalError):
            db.execute("DELETE FROM fixture_commercial_snapshots")


def test_consistent_snapshot_under_concurrent_retirement(connected,monkeypatch):
    fixture(connected,monkeypatch,"one")
    fixture(connected,monkeypatch,"two")
    original=comparison.read_set
    called=False
    def interleaved(db,key):
        nonlocal called
        result=original(db,key)
        if not called:
            called=True
            assert review(connected,"two-catalog",expected_lifecycle_version=2,decision="retire_test").status_code==200
        return result
    monkeypatch.setattr(comparison,"read_set",interleaved)
    assert compare(connected,kind="sets").status_code==200
    assert compare(connected,kind="sets").status_code==409


@pytest.mark.parametrize('amount',[True,1.5,'100',0,-1,100000000])
def test_persisted_price_types_fail_closed(connected,monkeypatch,amount):
    setup(connected,monkeypatch,'prices')
    with database() as db:
        doc=json.loads(db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='two'").fetchone()[0])
        doc['rows'][0]['unit_price_minor']=amount
        db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='two'",(json.dumps(doc),))
    before=image()
    assert compare(connected).status_code==409
    assert image()==before


def test_valid_shape_but_changed_content_hash_fails(connected,monkeypatch):
    fixture(connected,monkeypatch,'one')
    fixture(connected,monkeypatch,'two')
    with database() as db:
        doc=json.loads(db.execute("SELECT document FROM fixture_commercial_snapshots WHERE id='two-prices'").fetchone()[0])
        doc['rows'][0]['unit_price_minor']=5555
        db.execute("UPDATE fixture_commercial_snapshots SET document=? WHERE id='two-prices'",(json.dumps(doc),))
    assert compare(connected,kind='sets').status_code==409

@pytest.mark.parametrize('writer_open',[False,True])
def test_directory_entries_allow_only_sqlite_reader_sidecars(connected,monkeypatch,writer_open):
    setup(connected,monkeypatch)
    path=Path(os.environ['SONORAN_DB_PATH'])
    holder=sqlite3.connect(path) if writer_open else None
    if holder is not None:
        holder.execute('PRAGMA journal_mode=WAL')
        holder.execute('SELECT * FROM fixture_commercial_snapshots').fetchall()
    try:
        before_names={p.name for p in path.parent.iterdir()}
        before=image()
        with comparison.read_database() as db:
            assert db.execute('SELECT count(*) FROM fixture_commercial_snapshots').fetchone()[0]==2
            during_names={p.name for p in path.parent.iterdir()}
            assert during_names-before_names <= {path.name+'-wal',path.name+'-shm'}
            assert db.execute('PRAGMA query_only').fetchone()[0]==1
        assert image()==before
        assert {p.name for p in path.parent.iterdir()}-before_names <= {path.name+'-wal',path.name+'-shm'}
    finally:
        if holder is not None:
            holder.close()

@pytest.mark.parametrize('value',['é'*64,b'bad',123,'x'*64])
def test_malformed_fingerprint_is_bounded(connected,monkeypatch,value):
    setup(connected,monkeypatch)
    with database() as db:
        db.execute("UPDATE metadata SET value=? WHERE key='access_secret_fingerprint'",(value,))
    before=image()
    assert compare(connected).status_code==503
    assert image()==before


@pytest.mark.parametrize('table,key',[('fixture_commercial_snapshots','two-catalog'),('fixture_commercial_sets','two')])
@pytest.mark.parametrize('blob',[b'\xff',b'{}'])
def test_blob_document_not_accepted(connected,monkeypatch,table,key,blob):
    fixture(connected,monkeypatch,'one')
    fixture(connected,monkeypatch,'two')
    with database() as db:
        db.execute('UPDATE '+table+' SET document=? WHERE id=?',(blob,key))
    before=image()
    assert compare(connected,kind='sets').status_code==409
    assert image()==before


@pytest.mark.parametrize('kind',['snapshot','set','pointer','publication','command receipt'])
def test_shared_document_boundary_rejects_blob_for_all_containers(kind):
    from fastapi import HTTPException
    from services.commerce.app.commercial_fixture_validation import parse_document
    with pytest.raises(HTTPException) as exc:
        parse_document(b'\xff',kind)
    assert exc.value.status_code==409
