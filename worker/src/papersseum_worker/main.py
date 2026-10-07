import logging
import signal
import threading
import time

import psycopg

from papersseum_worker import config, db, runner, storage
from papersseum_worker.ratings import new_ratings
from papersseum_worker.replay import build_replay

log = logging.getLogger("worker")
stopping = threading.Event()
current = {"job_id": None}      # read by the heartbeat thread


def handle_validate(conn, job):
    path = storage.agent_file(job["storage_path"], job["sha256"])
    res = runner.validate(path)
    db.complete_validation(conn, job["job_id"], res["ok"], res["error"], res["violations"])
    log.info("submission %s: %s", job["submission_id"], "passed" if res["ok"] else res["error"])


def handle_match(conn, job):
    players = job["players"]
    for p in players:
        if not p["builtin"]:
            p["path"] = storage.agent_file(p["storage_path"], p["sha256"])

    result = runner.play(job["seed"], players)
    replay_path = storage.upload_replay(
        job["match_id"], build_replay(job["seed"], players, result, config.ENGINE_HASH))

    score_of = {s["pid"]: s for s in result["scores"]}
    place_of = {pid: i + 1 for i, pid in enumerate(result["placements"])}

    def compute_players(seats):
        elo_after, blended = new_ratings(seats, result["scores"])
        return [{
            "slot": slot,
            "placement": place_of[slot],
            "coverage": score_of[slot]["coverage"],
            "deaths": score_of[slot]["deaths"],
            "strikes": result["strikes"].get(slot, 0),
            "crashed": result["crashed"].get(slot, False),
            "score": blended[slot],
            "elo_after": elo_after[slot],
        } for slot, *_ in seats]

    db.finish_match(conn, job["job_id"], job["match_id"], compute_players, replay_path)
    log.info("match %s done, placements %s", job["match_id"], result["placements"])


def heartbeat_loop():
    conn = db.connect()          # its own connection: the main one is busy during a match
    while True:
        time.sleep(config.HEARTBEAT_SECONDS)
        try:
            db.heartbeat(conn, current["job_id"])
        except Exception:
            log.exception("heartbeat failed")


def run_one(conn):
    """Claim and do one job. Returns False if the queue was empty."""
    job = db.claim_job(conn)
    if job is None:
        return False
    current["job_id"] = job["job_id"]
    try:
        if job["kind"] == "validate":
            handle_validate(conn, job)
        else:
            handle_match(conn, job)
    except Exception as e:
        log.exception("job %s failed", job["job_id"])
        try:
            db.fail_job(conn, job["job_id"], f"{type(e).__name__}: {e}")
        except Exception:
            log.exception("could not report the failure; the lease will expire and it will be retried")
    finally:
        current["job_id"] = None
    return True


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    signal.signal(signal.SIGINT, lambda *_: stopping.set())     # Ctrl+C: finish the job, then stop
    signal.signal(signal.SIGTERM, lambda *_: stopping.set())    # docker stop: same

    conn = db.connect()
    db.heartbeat(conn)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    log.info("worker %s started, engine %s", config.WORKER_ID, config.ENGINE_HASH)

    while not stopping.is_set():
        try:
            if not run_one(conn):
                stopping.wait(config.POLL_SECONDS)
        except psycopg.OperationalError:
            log.warning("lost the database connection; reconnecting in 10 s")
            stopping.wait(10)
            try:
                conn = db.connect()
            except psycopg.OperationalError:
                pass
    log.info("stopped")


if __name__ == "__main__":
    main()
