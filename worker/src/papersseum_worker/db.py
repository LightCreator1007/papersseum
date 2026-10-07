import psycopg
from psycopg.types.json import Jsonb

from papersseum_worker import config

def connect():
    return psycopg.connect(config.DATABASE_URL,autocommit=True)

def claim_job(conn):
    row = conn.execute(
        "select internal.claim_job(%s,%s)", (config.WORKER_ID,config.ENGINE_HASH)
    ).fetchone()
    return row[0]

def heartbeat(conn, job_id=None):
    conn.execute(
        "select internal.heartbeat(%s,%s,%s,%s)",
        (config.WORKER_ID,config.ENGINE_HASH,config.WORKER_VERSION,job_id)
    )

def complete_validation(conn,job_id,ok,error=None,violations=None):
    conn.execute(
        "select internal.complete_validation(%s,%s,%s,%s,%s,%s)",
        (job_id, config.WORKER_ID, ok, error,Jsonb(violations) if violations is not None else None, config.ENGINE_HASH)
    )

def fail_job(conn,job_id, error):
    conn.execute(
        "select internal.fail_job(%s,%s,%s)", (job_id,config.WORKER_ID,error[:2000])
    )

def finish_match(conn, job_id, match_id, compute_players, replay_path):
    with conn.transaction():
        seats = conn.execute(
            "select slot, bot_id, elo, games from internal.lock_match_bots(%s)", (match_id,)
        ).fetchall()
        players = compute_players(seats)
        conn.execute(
            "select internal.complete_match(%s, %s, %s, %s, %s)",
            (job_id, config.WORKER_ID, Jsonb(players), replay_path, config.ENGINE_HASH),
        )
