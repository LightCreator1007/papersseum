"""Create test players with uploaded bots. LOCAL ONLY."""
import hashlib
import uuid

import httpx
import psycopg

from papersseum_worker import config

BOTS = {
    "greedy1@iiitdmj.ac.in":   "from papersseum.agents.greedy_agent import GreedyAgent as Agent\n",
    "greedy2@iiitdmj.ac.in":   "from papersseum.agents.greedy_agent import GreedyAgent as Agent\n",
    "safe1@iiitdmj.ac.in":     "from papersseum.agents.safe_expander import SafeExpanderAgent as Agent\n",
    "safe2@iiitdmj.ac.in":     "from papersseum.agents.safe_expander import SafeExpanderAgent as Agent\n",
    "example@iiitdmj.ac.in":   open("examples/my_agent.py").read(),
    "broken@iiitdmj.ac.in":    "import os\n\nclass Agent:\n    def act(self, obs):\n        return 0\n",
}

http = httpx.Client(base_url=config.SUPABASE_URL, headers={"apikey": config.SUPABASE_SECRET_KEY})
db = psycopg.connect(config.DATABASE_URL, autocommit=True)

for email, source in BOTS.items():
    r = http.post("/auth/v1/admin/users", json={"email": email, "email_confirm": True})
    r.raise_for_status()
    user_id = r.json()["id"]
    bot_id = db.execute("select id from public.bots where owner_id = %s", (user_id,)).fetchone()[0]

    data = source.encode()
    sub_id = uuid.uuid4()
    path = f"{bot_id}/{sub_id}.py"
    http.post(f"/storage/v1/object/agents/{path}", content=data,
              headers={"Content-Type": "text/x-python"}).raise_for_status()
    db.execute("select public.api_create_submission(%s, %s, %s, %s, %s)",
               (user_id, sub_id, path, hashlib.sha256(data).hexdigest(), len(data)))
    print("queued", email)
