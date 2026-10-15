"""The loop's decisions, with the database and storage replaced by fakes."""
import psycopg
import pytest

from papersseum_worker import db, main, notify, runner, storage

from conftest import BUILTIN_LOBBY


@pytest.fixture
def notified(monkeypatch):
    log = []
    monkeypatch.setattr(notify, "after_validation", lambda conn, sid: log.append(("validation", sid)))
    monkeypatch.setattr(notify, "after_match", lambda conn, mid: log.append(("match", mid)))
    return log


@pytest.fixture
def calls(monkeypatch, notified):
    log = []
    monkeypatch.setattr(db, "fail_job", lambda conn, job_id, error: log.append(("fail", job_id, error)))
    monkeypatch.setattr(db, "complete_validation",
                        lambda conn, job_id, ok, error, violations: log.append(("validated", job_id, ok, error)))
    monkeypatch.setattr(storage, "agent_file", lambda path, sha: f"/cache/{sha}.py")
    return log


def test_empty_queue_returns_false(monkeypatch, calls):
    monkeypatch.setattr(db, "claim_job", lambda conn: None)
    assert main.run_one(None) is False
    assert calls == []


def test_validation_result_is_reported(monkeypatch, calls):
    monkeypatch.setattr(db, "claim_job", lambda conn: {
        "job_id": 5, "kind": "validate", "submission_id": "s", "storage_path": "p", "sha256": "h"})
    monkeypatch.setattr(runner, "validate", lambda path: {"ok": False, "error": "nope", "violations": []})
    assert main.run_one(None) is True
    assert calls == [("validated", 5, False, "nope")]
    assert main.current["job_id"] is None


def test_worker_error_is_reported_with_fail_job(monkeypatch, calls):
    monkeypatch.setattr(db, "claim_job", lambda conn: {
        "job_id": 6, "kind": "validate", "submission_id": "s", "storage_path": "p", "sha256": "h"})

    def broken(path):
        raise OSError("disk full")

    monkeypatch.setattr(runner, "validate", broken)
    assert main.run_one(None) is True
    assert calls == [("fail", 6, "OSError: disk full")]
    assert main.current["job_id"] is None


def test_match_report_has_one_entry_per_seat(monkeypatch, calls):
    job = {"job_id": 7, "kind": "match", "match_id": 31, "seed": 1234,
           "players": [dict(p, storage_path=None, sha256=None) for p in BUILTIN_LOBBY]}
    monkeypatch.setattr(db, "claim_job", lambda conn: job)
    monkeypatch.setattr(storage, "upload_replay", lambda match_id, data: f"{match_id}.jsonl.gz")

    reported = {}

    def fake_finish(conn, job_id, match_id, compute_players, replay_path):
        seats = [(slot, f"bot{slot}", 1000.0, 3) for slot in range(5)]   # as lock_match_bots returns
        reported.update(job_id=job_id, match_id=match_id, replay_path=replay_path,
                        players=compute_players(seats))

    monkeypatch.setattr(db, "finish_match", fake_finish)
    assert main.run_one(None) is True

    assert calls == []
    assert reported["job_id"] == 7 and reported["match_id"] == 31
    assert reported["replay_path"] == "31.jsonl.gz"
    players = reported["players"]
    assert [p["slot"] for p in players] == [0, 1, 2, 3, 4]
    assert sorted(p["placement"] for p in players) == [1, 2, 3, 4, 5]
    winner = next(p for p in players if p["placement"] == 1)
    loser = next(p for p in players if p["placement"] == 5)
    assert winner["elo_after"] > 1000 > loser["elo_after"]
    assert set(players[0]) == {"slot", "placement", "coverage", "deaths", "strikes", "crashed", "score", "elo_after",
                                "status", "error"}


def test_match_payload_carries_seat_status(monkeypatch, calls):
    job = {"job_id": 8, "kind": "match", "match_id": 9, "seed": 7,
           "players": [dict(p, storage_path=None, sha256=None) for p in BUILTIN_LOBBY]}
    monkeypatch.setattr(db, "claim_job", lambda conn: job)
    monkeypatch.setattr(storage, "upload_replay", lambda match_id, data: f"{match_id}.jsonl.gz")
    monkeypatch.setattr(runner, "play", lambda seed, players: {
        "scores": [{"pid": i, "coverage": 10.0, "time_avg_coverage": 10.0, "deaths": 0} for i in range(5)],
        "placements": [0, 1, 2, 3, 4], "action_log": [], "strikes": {}, "crashed": {2: True},
        "seats": {i: {"status": "crashed" if i == 2 else "ok", "error": "boom" if i == 2 else None}
                  for i in range(5)},
        "replay": b"",
    })
    sent = {}
    monkeypatch.setattr(db, "finish_match", lambda conn, job_id, match_id, compute, path: sent.update(
        players=compute([(i, f"b{i}", 1500.0, 0) for i in range(5)])))
    assert main.run_one(None) is True
    assert calls == []
    seat2 = next(p for p in sent["players"] if p["slot"] == 2)
    assert seat2["status"] == "crashed" and seat2["error"] == "boom" and seat2["crashed"] is True
    seat0 = next(p for p in sent["players"] if p["slot"] == 0)
    assert seat0["status"] == "ok" and seat0["error"] is None


def test_notifications_follow_a_validation_verdict(monkeypatch, calls, notified):
    monkeypatch.setattr(db, "claim_job", lambda conn: {
        "job_id": 5, "kind": "validate", "submission_id": "sub-5", "storage_path": "p", "sha256": "h"})
    monkeypatch.setattr(runner, "validate", lambda path: {"ok": True, "error": None, "violations": []})
    assert main.run_one(None) is True
    assert calls == [("validated", 5, True, None)]
    assert notified == [("validation", "sub-5")]


def test_no_notification_when_the_job_itself_fails(monkeypatch, calls, notified):
    monkeypatch.setattr(db, "claim_job", lambda conn: {
        "job_id": 6, "kind": "validate", "submission_id": "sub-6", "storage_path": "p", "sha256": "h"})

    def broken(path):
        raise OSError("disk full")

    monkeypatch.setattr(runner, "validate", broken)
    assert main.run_one(None) is True
    assert notified == []


def test_notifications_follow_a_finished_match(monkeypatch, calls, notified):
    job = {"job_id": 8, "kind": "match", "match_id": 9, "seed": 7,
           "players": [dict(p, storage_path=None, sha256=None) for p in BUILTIN_LOBBY]}
    monkeypatch.setattr(db, "claim_job", lambda conn: job)
    monkeypatch.setattr(storage, "upload_replay", lambda match_id, data: f"{match_id}.jsonl.gz")
    monkeypatch.setattr(runner, "play", lambda seed, players: {
        "scores": [{"pid": i, "coverage": 10.0, "time_avg_coverage": 10.0, "deaths": 0} for i in range(5)],
        "placements": [0, 1, 2, 3, 4], "action_log": [], "strikes": {}, "crashed": {},
        "seats": {i: {"status": "ok", "error": None} for i in range(5)},
        "replay": b"",
    })
    order = []
    monkeypatch.setattr(db, "finish_match", lambda *a: order.append("finished"))
    monkeypatch.setattr(notify, "after_match", lambda conn, mid: order.append(("notified", mid)))
    assert main.run_one(None) is True
    assert order == ["finished", ("notified", 9)]


def test_a_malformed_notification_row_does_not_fail_the_job(monkeypatch):
    log = []

    class WideRows:
        def execute(self, sql, params):
            return self

        def fetchall(self):
            return [("u1", "a@b.c", True, "submission_passed", {}, "extra")]

    monkeypatch.setattr(db, "fail_job", lambda conn, job_id, error: log.append(("fail", job_id, error)))
    monkeypatch.setattr(db, "complete_validation",
                        lambda conn, job_id, ok, error, violations: log.append(("validated", job_id, ok, error)))
    monkeypatch.setattr(storage, "agent_file", lambda path, sha: "/cache/h.py")
    monkeypatch.setattr(db, "claim_job", lambda conn: {
        "job_id": 5, "kind": "validate", "submission_id": "sub-5", "storage_path": "p", "sha256": "h"})
    monkeypatch.setattr(runner, "validate", lambda path: {"ok": True, "error": None, "violations": []})
    assert main.run_one(WideRows()) is True
    assert log == [("validated", 5, True, None)]


def test_heartbeat_reconnects_after_losing_the_connection(monkeypatch):
    class FakeConn:
        def __init__(self, n):
            self.n, self.closed = n, False

        def close(self):
            self.closed = True

    opened, beats = [], []

    def fake_connect():
        opened.append(FakeConn(len(opened)))
        return opened[-1]

    def fake_heartbeat(conn, job_id=None):
        if conn.n == 0:
            raise psycopg.OperationalError("server closed the connection")
        beats.append((conn.n, job_id))

    monkeypatch.setattr(db, "connect", fake_connect)
    monkeypatch.setattr(db, "heartbeat", fake_heartbeat)
    monkeypatch.setitem(main.current, "job_id", 9)

    conn = main.heartbeat_once(None)        # first connection dies mid-heartbeat
    assert conn is None and opened[0].closed
    conn = main.heartbeat_once(conn)        # next beat opens a fresh one
    assert conn is opened[1] and beats == [(1, 9)]
    assert main.heartbeat_once(conn) is conn and beats == [(1, 9), (1, 9)]
    assert len(opened) == 2


class FakeStopping:
    """Stands in for main.stopping: records each wait and stops the loop after `rounds`."""
    def __init__(self, rounds):
        self.rounds = rounds
        self.waits = []

    def is_set(self):
        return len(self.waits) >= self.rounds

    def wait(self, seconds):
        self.waits.append(seconds)


def test_engine_mismatch_waits_instead_of_crashing(monkeypatch, calls, caplog):
    claims = []

    def claim_job(conn):
        claims.append(conn)
        raise psycopg.errors.RaiseException("Engine hash mismatch: worker has aaa, season expects bbb")

    monkeypatch.setattr(db, "claim_job", claim_job)
    stopping = FakeStopping(rounds=2)
    monkeypatch.setattr(main, "stopping", stopping)
    main.loop("conn")

    assert len(claims) == 2
    assert stopping.waits == [main.ENGINE_MISMATCH_SECONDS] * 2
    assert calls == []
    errors = [r for r in caplog.records if r.levelname == "ERROR"]
    assert len(errors) == 2 and all(r.exc_info is None for r in errors)    # one line each, no traceback
    assert "worker has aaa, season expects bbb" in errors[0].getMessage()
    assert "update.sh" in errors[0].getMessage()


def test_other_database_errors_still_stop_the_worker(monkeypatch, calls):
    def claim_job(conn):
        raise psycopg.errors.RaiseException("something else broke")

    monkeypatch.setattr(db, "claim_job", claim_job)
    monkeypatch.setattr(main, "stopping", FakeStopping(rounds=5))
    with pytest.raises(psycopg.errors.RaiseException, match="something else"):
        main.loop("conn")
