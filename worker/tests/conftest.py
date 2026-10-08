import os
from pathlib import Path

# config.py reads these at import time. Unit tests never touch a real database
# or Storage, so placeholders are enough.
os.environ.setdefault("DATABASE_URL", "postgresql://unused")
os.environ.setdefault("SUPABASE_URL", "http://storage.test")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-key")
os.environ.setdefault("WORKER_ID", "test-worker")
os.environ.setdefault("SANDBOX_BACKEND", "subprocess")  # no Docker in unit tests
os.environ.setdefault("PAPERSSEUM_UNSAFE_LOCAL", "1")   # which needs the opt-in; test_guard.py removes it

REPO_ROOT = Path(__file__).resolve().parents[2]
EXAMPLE_AGENT = REPO_ROOT / "examples" / "my_agent.py"

BUILTIN_LOBBY = [
    {"slot": 0, "builtin": "greedy", "bot_id": "b0", "submission_id": "s0"},
    {"slot": 1, "builtin": "safe_expander", "bot_id": "b1", "submission_id": "s1"},
    {"slot": 2, "builtin": "random", "bot_id": "b2", "submission_id": "s2"},
    {"slot": 3, "builtin": "greedy", "bot_id": "b3", "submission_id": "s3"},
    {"slot": 4, "builtin": "safe_expander", "bot_id": "b4", "submission_id": "s4"},
]
