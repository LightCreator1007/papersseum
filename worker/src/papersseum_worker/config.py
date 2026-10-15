import os

import papersseum

DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
WORKER_ID = os.environ.get("WORKER_ID","local-worker")
CACHE_DIR = os.environ.get("AGENT_CACHE_DIR", os.path.expanduser("~/.cache/papersseum/agents"))

# Where uploaded bots run: "docker" (one locked-down container per bot) or
# "subprocess" (no isolation; local testing only, needs PAPERSSEUM_UNSAFE_LOCAL=1).
SANDBOX_BACKEND = os.environ.get("SANDBOX_BACKEND", "docker")
SANDBOX_IMAGE = os.environ.get("SANDBOX_IMAGE", "papersseum-sandbox")
DOCKER = os.environ.get("DOCKER", "docker")

ENGINE_HASH = papersseum.ENGINE_HASH
LIBRARY_VERSION = papersseum.__version__
WORKER_VERSION = "0.1.0"
POLL_SECONDS = 5
HEARTBEAT_SECONDS = 60

# Email through Resend. Optional: without the first two the worker records
# notifications but sends no email.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") or None
NOTIFY_FROM = os.environ.get("NOTIFY_FROM") or None
SITE_URL = os.environ.get("SITE_URL", "http://localhost:3000").rstrip("/")
