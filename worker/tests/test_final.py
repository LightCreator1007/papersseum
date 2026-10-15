import pytest

from papersseum_worker import final


class FakeConn:
    def __init__(self, kind="final", pending=0, seats=None):
        self.kind, self.pending, self.seats = kind, pending, seats or []
        self.recorded = None

    def execute(self, sql, params=()):
        self.sql = sql
        if "record_final_standings" in sql:
            self.recorded = params
        return self

    def fetchone(self):
        if "from public.rounds" in self.sql:
            return (self.kind,) if self.kind else None
        if "count(*)" in self.sql:
            return (self.pending,)
        return None

    def fetchall(self):
        return self.seats


SEATS = [  # (match_id, bot_id, name, placement)
    (1, "a", "alpha", 1), (1, "b", "beta", 2), (1, "c", "gamma", 3),
    (2, "a", "alpha", 1), (2, "c", "gamma", 2), (2, "b", "beta", 3),
    (3, "b", "beta", 1), (3, "a", "alpha", 2), (3, "c", "gamma", 3),
]


def test_ranks_by_plackett_luce():
    out = final.standings_for_round(FakeConn(seats=SEATS), 5)
    assert [s["name"] for s in out] == ["alpha", "beta", "gamma"]
    assert [s["rank"] for s in out] == [1, 2, 3]
    assert all(s["matches"] == 3 for s in out)


def test_a_bot_in_two_seats_of_one_match_counts_once():
    seats = SEATS + [(3, "a", "alpha", 4)]
    out = final.standings_for_round(FakeConn(seats=seats), 5)
    assert next(s for s in out if s["name"] == "alpha")["matches"] == 3


def test_refuses_a_ladder_round():
    with pytest.raises(final.NotReady, match="is a ladder round"):
        final.standings_for_round(FakeConn(kind="ladder", seats=SEATS), 5)


def test_allow_ladder_overrides_the_kind_check():
    out = final.standings_for_round(FakeConn(kind="ladder", seats=SEATS), 5, allow_ladder=True)
    assert len(out) == 3


def test_refuses_while_matches_are_pending():
    with pytest.raises(final.NotReady, match="2 matches are still queued or running"):
        final.standings_for_round(FakeConn(pending=2, seats=SEATS), 5)


def test_refuses_an_empty_round():
    with pytest.raises(final.NotReady, match="no finished matches"):
        final.standings_for_round(FakeConn(seats=[]), 5)


def test_refuses_a_missing_round():
    with pytest.raises(final.NotReady, match="round 5 doesn't exist"):
        final.standings_for_round(FakeConn(kind=None), 5)


def test_write_sends_jsonb():
    conn = FakeConn(seats=SEATS)
    final.record(conn, 5, final.standings_for_round(conn, 5))
    assert conn.recorded[0] == 5


def test_main_exits_2_when_not_ready(monkeypatch, capsys):
    monkeypatch.setattr(final.db, "connect", lambda: FakeConn(kind="ladder", seats=SEATS))
    assert final.main(["--round", "5"]) == 2
    assert "not ready: round 5 is a ladder round" in capsys.readouterr().err


def test_main_prints_and_writes(monkeypatch, capsys):
    conn = FakeConn(seats=SEATS)
    monkeypatch.setattr(final.db, "connect", lambda: conn)
    assert final.main(["--round", "5", "--write"]) == 0
    out = capsys.readouterr().out
    assert "alpha" in out and "recorded 3 standings for round 5" in out
    assert conn.recorded[0] == 5


def test_main_exits_3_when_the_function_is_not_deployed(monkeypatch, capsys):
    class Undeployed(FakeConn):
        def execute(self, sql, params=()):
            if "record_final_standings" in sql:
                raise final.errors.UndefinedFunction("function internal.record_final_standings does not exist")
            return super().execute(sql, params)

    monkeypatch.setattr(final.db, "connect", lambda: Undeployed(seats=SEATS))
    assert final.main(["--round", "5", "--write"]) == 3
    captured = capsys.readouterr()
    assert "alpha" in captured.out
    assert "isn't deployed yet (ask A11)" in captured.err
