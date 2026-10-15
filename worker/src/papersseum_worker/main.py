import logging
import signal
import threading
import time

import psycopg

from papersseum_worker import config, db, notify, runner, storage
from papersseum_worker.ratings import new_ratings

log = logging.getLogger("worker")
stopping = threading.Event()
current = {"job_id": None}      # read by the heartbeat thread
RECONNECT_SECONDS = 10
ENGINE_MISMATCH_SECONDS = 60


def handle_validate(conn, job):
    path = storage.agent_file(job["storage_path"], job["sha256"])
    res = runner.validate(path)
    db.complete_validation(conn, job["job_id"], res["ok"], res["error"], res["violations"])
    log.info("submission %s: %s", job["submission_id"], "passed" if res["ok"] else res["error"])
    notify.after_validation(conn, job["submission_id"])


def handle_match(conn, job):
    players = job["players"]
    for p in players:
        if not p["builtin"]:
            p["path"] = storage.agent_file(p["storage_path"], p["sha256"])

    result = runner.play(job["seed"], players)
    replay_path = storage.upload_replay(job["match_id"], result["replay"])

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
            "status": result["seats"][slot]["status"],
            "error": result["seats"][slot]["error"],
            "score": blended[slot],
            "elo_after": elo_after[slot],
        } for slot, *_ in seats]

    db.finish_match(conn, job["job_id"], job["match_id"], compute_players, replay_path)
    log.info("match %s done, placements %s", job["match_id"], result["placements"])
    notify.after_match(conn, job["match_id"])


def heartbeat_once(conn):
    """Send one heartbeat (it extends the running job's lease). Returns the
    connection to use next time, or None if it was lost and must be reopened."""
    try:
        if conn is None:
            conn = db.connect()
        db.heartbeat(conn, current["job_id"])
    except psycopg.OperationalError:
        log.warning("heartbeat lost the database connection; reconnecting in %d s", RECONNECT_SECONDS)
        if conn is not None:
            conn.close()
        return None
    except Exception:
        log.exception("heartbeat failed")
    return conn


def heartbeat_loop():
    conn = None                  # its own connection: the main one is busy during a match
    wait = config.HEARTBEAT_SECONDS
    while True:
        time.sleep(wait)
        conn = heartbeat_once(conn)
        wait = config.HEARTBEAT_SECONDS if conn is not None else RECONNECT_SECONDS


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


def is_engine_mismatch(e):
    """internal.claim_job raises this when public.season.engine_hash is not ours."""
    return isinstance(e, psycopg.errors.RaiseException) and str(e).startswith("Engine hash mismatch")


def loop(conn):
    while not stopping.is_set():
        try:
            if not run_one(conn):
                stopping.wait(config.POLL_SECONDS)
        except psycopg.errors.RaiseException as e:
            if not is_engine_mismatch(e):
                raise
            # Not a crash: restarting won't fix it, and systemd would restart us
            # every 10 s. Wait for an operator instead, without claiming jobs.
            log.error("%s. Not claiming jobs: update this worker (deploy/vm/update.sh) or "
                      "public.season.engine_hash. Retrying in %d s",
                      str(e).splitlines()[0], ENGINE_MISMATCH_SECONDS)
            stopping.wait(ENGINE_MISMATCH_SECONDS)
        except psycopg.OperationalError:
            log.warning("lost the database connection; reconnecting in %d s", RECONNECT_SECONDS)
            stopping.wait(RECONNECT_SECONDS)
            try:
                conn = db.connect()
            except psycopg.OperationalError:
                pass


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        runner.check_ready()            # refuse to start before claiming any job
    except runner.SandboxMissing as e:
        raise SystemExit(f"not starting: {e}")
    signal.signal(signal.SIGINT, lambda *_: stopping.set())     # Ctrl+C: finish the job, then stop
    signal.signal(signal.SIGTERM, lambda *_: stopping.set())    # docker stop: same

    conn = db.connect()
    db.heartbeat(conn)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    log.info("worker %s started, engine %s", config.WORKER_ID, config.ENGINE_HASH)
    loop(conn)
    log.info("stopped")


if __name__ == "__main__":
    main()
