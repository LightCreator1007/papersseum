import os

import papersseum

DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
WORKER_ID = os.environ.get("WORKER_ID","local-worker")
CACHE_DIR = os.environ.get("AGENT_CACHE_DIR", os.path.expanduser("~/.cache/papersseum/agents"))

ENGINE_HASH = papersseum.ENGINE_HASH
WORKER_VERSION = "0.1.0"
POLL_SECONDS = 5
HEARTBEAT_SECONDS = 60
