"""The loop's decisions, with the database and storage replaced by fakes."""
import pytest

from papersseum_worker import db, main, runner, storage

from conftest import BUILTIN_LOBBY


@pytest.fixture
def calls(monkeypatch):
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
    assert set(players[0]) == {"slot", "placement", "coverage", "deaths", "strikes", "crashed", "score", "elo_after"}
