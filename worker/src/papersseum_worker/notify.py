"""Record notifications through the database and email people who opted in.

Nothing here may fail a job: every entry point logs and returns.
"""
import datetime as dt
import logging

import httpx
import psycopg

from papersseum_worker import config

log = logging.getLogger("notify")
EMAIL_KINDS = {"submission_rejected", "submission_passed", "first_match"}
_warned = set()


class DailyCap:
    def __init__(self, limit=90):
        self.limit, self.day, self.used = limit, None, 0

    def take(self, now=None):
        today = (now or dt.datetime.now(dt.timezone.utc)).date()
        if today != self.day:
            self.day, self.used = today, 0
        if self.used >= self.limit:
            return False
        self.used += 1
        return True


_cap = DailyCap()


def _subject_and_text(kind, payload):
    site = config.SITE_URL
    version = payload.get("version")
    label = f"Version {version}" if version not in (None, "") else "Your version"
    if kind == "submission_rejected":
        return (f"{label} was rejected",
                f"{payload.get('error') or 'Open your bot page to see why.'}\n\n{site}/me")
    if kind == "submission_passed":
        return (f"{label} passed",
                f"It plays from the next round.\n\n{site}/me")
    return ("Your first match is in",
            f"See how it went: {site}/matches/{payload.get('match_id', '')}")


def send_email(to, kind, payload, key):
    if not (config.RESEND_API_KEY and config.NOTIFY_FROM):
        if "email-config" not in _warned:
            _warned.add("email-config")
            log.warning("RESEND_API_KEY or NOTIFY_FROM is not set; notifications are recorded but no email is sent")
        return False
    if not _cap.take():
        log.warning("email cap reached for today; skipped %s", key)
        return False
    subject, text = _subject_and_text(kind, payload)
    r = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "Idempotency-Key": key},
        json={"from": config.NOTIFY_FROM, "to": [to], "subject": subject, "text": text},
        timeout=10,
    )
    if r.status_code >= 300:
        log.error("email %s failed: %s %s", key, r.status_code, r.text[:300])
        return False
    return True


def _deliver(conn, fn, arg, ref):
    try:
        rows = conn.execute(f"select * from internal.{fn}(%s)", (arg,)).fetchall()
    except psycopg.errors.UndefinedFunction:
        if fn not in _warned:
            _warned.add(fn)
            log.warning("internal.%s is not deployed yet; notifications are off", fn)
        return
    except Exception:
        log.exception("could not record notifications for %s", ref)
        return
    for row in rows:
        try:
            user_id, email, opt_in, kind, payload = row
            if not (opt_in and email and kind in EMAIL_KINDS):
                continue
            send_email(email, kind, payload or {}, f"{kind}:{ref}:{user_id}")
        except Exception:
            log.exception("handling a notification row for %s failed", ref)


def after_validation(conn, submission_id):
    _deliver(conn, "notify_validation", submission_id, submission_id)


def after_match(conn, match_id):
    _deliver(conn, "notify_match", match_id, match_id)
