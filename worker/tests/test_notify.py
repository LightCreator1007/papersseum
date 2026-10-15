import datetime as dt

import psycopg

from papersseum_worker import notify


class FakeConn:
    def __init__(self, rows=None, error=None):
        self.rows, self.error, self.calls = rows or [], error, []

    def execute(self, sql, params):
        self.calls.append((sql, params))
        if self.error:
            raise self.error
        return self

    def fetchall(self):
        return self.rows


ROW = ("u1", "a@b.c", True, "submission_rejected", {"version": 2, "error": "too slow"})


def test_sends_email_for_opted_in_rows(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "send_email", lambda to, kind, payload, key: sent.append((to, kind, key)) or True)
    notify.after_validation(FakeConn([ROW]), "sub-1")
    assert sent == [("a@b.c", "submission_rejected", "submission_rejected:sub-1:u1")]


def test_skips_opted_out_rows(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "send_email", lambda *a: sent.append(a) or True)
    notify.after_validation(FakeConn([("u1", "a@b.c", False, "submission_passed", {})]), "sub-1")
    assert sent == []


def test_skips_kinds_that_never_email(monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "send_email", lambda *a: sent.append(a) or True)
    notify.after_match(FakeConn([("u1", "a@b.c", True, "round_started", {})]), 9)
    assert sent == []


def test_calls_the_right_function_with_the_id():
    conn = FakeConn([])
    notify.after_match(conn, 9)
    notify.after_validation(conn, "sub-1")
    assert conn.calls == [("select * from internal.notify_match(%s)", (9,)),
                          ("select * from internal.notify_validation(%s)", ("sub-1",))]


def test_missing_function_is_logged_once_and_never_raises(caplog):
    err = psycopg.errors.UndefinedFunction("function internal.notify_match does not exist")
    notify._warned.clear()
    notify.after_match(FakeConn(error=err), 9)
    notify.after_match(FakeConn(error=err), 10)
    assert sum("not deployed" in r.message for r in caplog.records) == 1


def test_database_error_is_logged_and_never_raises(caplog):
    notify.after_match(FakeConn(error=RuntimeError("connection reset")), 9)
    assert any("could not record notifications for 9" in r.message for r in caplog.records)


def test_email_failure_never_raises(monkeypatch, caplog):
    def boom(*a):
        raise RuntimeError("resend down")
    monkeypatch.setattr(notify, "send_email", boom)
    notify.after_validation(FakeConn([ROW]), "sub-1")
    assert any("failed" in r.message for r in caplog.records)


def test_one_failed_email_does_not_stop_the_next(monkeypatch):
    sent = []

    def flaky(to, kind, payload, key):
        if to == "a@b.c":
            raise RuntimeError("bad address")
        sent.append(to)
        return True

    monkeypatch.setattr(notify, "send_email", flaky)
    notify.after_match(FakeConn([ROW, ("u2", "x@y.z", True, "first_match", {})]), 9)
    assert sent == ["x@y.z"]


def test_no_key_means_no_request(monkeypatch):
    monkeypatch.setattr(notify.config, "RESEND_API_KEY", None)
    called = []
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: called.append(1))
    assert notify.send_email("a@b.c", "first_match", {"match_id": 1, "placement": 2}, "k") is False
    assert called == []


class Resp:
    def __init__(self, status, text=""):
        self.status_code, self.text = status, text


def _configure(monkeypatch):
    monkeypatch.setattr(notify.config, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(notify.config, "NOTIFY_FROM", "Papersseum <arena@example.org>")
    monkeypatch.setattr(notify.config, "SITE_URL", "https://site.test")
    monkeypatch.setattr(notify, "_cap", notify.DailyCap())


def test_request_shape_and_idempotency_key(monkeypatch):
    _configure(monkeypatch)
    seen = {}

    def post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json, timeout=timeout)
        return Resp(200)

    monkeypatch.setattr(notify.httpx, "post", post)
    assert notify.send_email("a@b.c", "submission_rejected", {"version": 2, "error": "too slow"},
                             "submission_rejected:sub-1:u1") is True
    assert seen["url"] == "https://api.resend.com/emails"
    assert seen["headers"] == {"Authorization": "Bearer re_test",
                               "Idempotency-Key": "submission_rejected:sub-1:u1"}
    assert seen["json"]["from"] == "Papersseum <arena@example.org>"
    assert seen["json"]["to"] == ["a@b.c"]
    assert seen["json"]["subject"] == "Version 2 was rejected"
    assert "too slow" in seen["json"]["text"] and "https://site.test/me" in seen["json"]["text"]


def test_subject_survives_a_missing_version(monkeypatch):
    _configure(monkeypatch)
    seen = {}
    monkeypatch.setattr(notify.httpx, "post",
                        lambda url, headers, json, timeout: seen.update(json=json) or Resp(200))
    notify.send_email("a@b.c", "submission_passed", {}, "k")
    assert seen["json"]["subject"] == "Your version passed"


def test_resend_error_status_returns_false(monkeypatch, caplog):
    _configure(monkeypatch)
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: Resp(422, "invalid from"))
    assert notify.send_email("a@b.c", "first_match", {"match_id": 1}, "k") is False
    assert any("422" in r.message for r in caplog.records)


def test_daily_cap_blocks_the_request(monkeypatch):
    _configure(monkeypatch)
    monkeypatch.setattr(notify, "_cap", notify.DailyCap(limit=0))
    called = []
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: called.append(1))
    assert notify.send_email("a@b.c", "first_match", {"match_id": 1}, "k") is False
    assert called == []


def test_daily_cap_resets_at_midnight():
    cap = notify.DailyCap(limit=2)
    day1 = dt.datetime(2026, 10, 15, 23, 59, tzinfo=dt.timezone.utc)
    assert cap.take(day1) and cap.take(day1) and not cap.take(day1)
    assert cap.take(day1 + dt.timedelta(minutes=2))


def test_row_with_an_extra_column_never_raises(monkeypatch, caplog):
    sent = []
    monkeypatch.setattr(notify, "send_email", lambda to, kind, payload, key: sent.append(to) or True)
    wide = ("u1", "a@b.c", True, "submission_rejected", {}, "extra")
    good = ("u2", "x@y.z", True, "first_match", {})
    notify.after_validation(FakeConn([wide, good]), "sub-1")
    assert sent == ["x@y.z"]
    assert any("sub-1" in r.message for r in caplog.records)


def test_missing_email_config_is_logged_once(monkeypatch, caplog):
    monkeypatch.setattr(notify.config, "RESEND_API_KEY", None)
    monkeypatch.setattr(notify.config, "NOTIFY_FROM", None)
    notify._warned.clear()
    assert notify.send_email("a@b.c", "first_match", {}, "k1") is False
    assert notify.send_email("a@b.c", "first_match", {}, "k2") is False
    hits = [r for r in caplog.records if "RESEND_API_KEY" in r.message]
    assert len(hits) == 1
