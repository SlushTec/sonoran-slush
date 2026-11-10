"""First-use SQLite contention and failure cleanup, using synthetic local data."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
import sqlite3

import pytest

from services.commerce.app import workflows


@pytest.fixture()
def database_path(tmp_path, monkeypatch):
    path = tmp_path / "commerce.sqlite3"
    monkeypatch.setenv("SONORAN_REQUESTS_ENABLED", "true")
    monkeypatch.setenv("SONORAN_STAGE", "scaffold")
    monkeypatch.setenv("SONORAN_ACCESS_SECRET", "initialization-test-only-" + "x" * 40)
    monkeypatch.setenv("SONORAN_DB_PATH", str(path))
    return path


def test_concurrent_first_use_waits_for_wal_and_preserves_writes(database_path, monkeypatch):
    # An independent reader pins DELETE mode. Every first-use connection must
    # encounter a real SQLITE_BUSY before the reader is released, not a sleep race.
    connect = sqlite3.connect
    reader = connect(database_path, isolation_level=None)
    reader.execute("CREATE TABLE seed (value INTEGER)")
    reader.execute("BEGIN")
    reader.execute("SELECT * FROM seed").fetchall()
    busy_connections = set()
    all_busy = Event()
    lock = Lock()

    class ContendedConnection(sqlite3.Connection):
        def execute(self, sql, *args):
            if sql == "PRAGMA journal_mode=WAL":
                # SQLite can report immediate BUSY on competing mode upgrades
                # even with a busy handler. Force that documented path here.
                super().execute("PRAGMA busy_timeout=0")
                try:
                    return super().execute(sql, *args)
                except sqlite3.OperationalError as exc:
                    assert exc.sqlite_errorcode & 0xFF == sqlite3.SQLITE_BUSY
                    with lock:
                        busy_connections.add(id(self))
                        if len(busy_connections) == 4:
                            all_busy.set()
                    raise
            return super().execute(sql, *args)

    monkeypatch.setattr(workflows.sqlite3, "connect", lambda *a, **kw: connect(*a, **kw, factory=ContendedConnection))

    def write(number):
        with workflows.database() as db:
            assert db.execute("PRAGMA journal_mode").fetchone() == ("wal",)
            assert db.execute("PRAGMA busy_timeout").fetchone() == (15000,)
            db.execute("INSERT INTO metadata VALUES (?, ?)", (f"worker-{number}", str(number)))

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(write, i) for i in range(4)]
        try:
            assert all_busy.wait(5), "All four independent initializers must hit real WAL contention"
        finally:
            reader.rollback()
            reader.close()
        for future in futures:
            future.result(timeout=20)
    # Reopening must neither skip initialization for a stale path nor lose writes.
    for _ in range(3):
        with workflows.database() as db:
            assert db.execute("SELECT count(*) FROM metadata WHERE key LIKE 'worker-%'").fetchone() == (4,)
            assert db.execute("PRAGMA journal_mode").fetchone() == ("wal",)


@pytest.mark.parametrize("failure_stage", ["wal", "schema"])
@pytest.mark.parametrize("error_code", [sqlite3.SQLITE_IOERR, sqlite3.SQLITE_LOCKED, None])
def test_initialization_failure_closes_connection(database_path, monkeypatch, failure_stage, error_code):
    connect = sqlite3.connect
    opened = []
    calls = []
    failure = sqlite3.OperationalError("synthetic non-contention initialization failure")
    if error_code is not None:
        failure.sqlite_errorcode = error_code

    class FailedConnection(sqlite3.Connection):
        def execute(self, sql, *args):
            if failure_stage == "wal" and sql == "PRAGMA journal_mode=WAL":
                calls.append(sql)
                raise failure
            return super().execute(sql, *args)

        def executescript(self, sql):
            if failure_stage == "schema":
                calls.append(sql)
                raise failure
            return super().executescript(sql)

    def tracked_connect(*args, **kwargs):
        connection = connect(*args, **kwargs, factory=FailedConnection)
        opened.append(connection)
        return connection

    monkeypatch.setattr(workflows.sqlite3, "connect", tracked_connect)
    with pytest.raises(sqlite3.OperationalError) as raised:
        with workflows.database():
            pytest.fail("Initialization failure must not yield a connection")
    assert raised.value is failure
    assert len(calls) == 1, "Non-BUSY failures must not be retried"
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        opened[0].execute("SELECT 1")


@pytest.mark.parametrize("error_code", [sqlite3.SQLITE_BUSY, sqlite3.SQLITE_BUSY_RECOVERY])
def test_wal_busy_deadline_is_bounded_and_closes_connection(database_path, monkeypatch, error_code):
    connect = sqlite3.connect
    opened = []
    attempts = []
    sleeps = []
    clock = iter([0, 0, 14.99, 15])
    failure = sqlite3.OperationalError("synthetic persistent WAL contention")
    failure.sqlite_errorcode = error_code

    class BusyConnection(sqlite3.Connection):
        def execute(self, sql, *args):
            if sql == "PRAGMA journal_mode=WAL":
                assert super().execute("PRAGMA busy_timeout").fetchone() == (0,)
                attempts.append(sql)
                raise failure
            return super().execute(sql, *args)

    def tracked_connect(*args, **kwargs):
        connection = connect(*args, **kwargs, factory=BusyConnection)
        opened.append(connection)
        return connection

    monkeypatch.setattr(workflows.sqlite3, "connect", tracked_connect)
    monkeypatch.setattr(workflows, "monotonic", lambda: next(clock))
    monkeypatch.setattr(workflows, "sleep", sleeps.append)
    with pytest.raises(sqlite3.OperationalError) as raised:
        with workflows.database():
            pytest.fail("Persistent contention must not yield a connection")
    assert raised.value is failure
    assert len(attempts) == 3
    assert sleeps == pytest.approx([0.05, 0.01])
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        opened[0].execute("SELECT 1")
