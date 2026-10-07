import hashlib
import os

import httpx

from papersseum_worker import config

_http = httpx.Client(
    base_url = f"{config.SUPABASE_URL}/storage/v1",
    headers={"apikey":config.SUPABASE_SECRET_KEY},
   timeout=30
)

def agent_file(storage_path, sha256):
    os.makedirs(config.CACHE_DIR, exist_ok=True)
    local = os.path.join(config.CACHE_DIR, f"{sha256}.py")
    if os.path.exists(local):
        return local

    r = _http.get(f"/object/agents/{storage_path}")
    r.raise_for_status()
    if hashlib.sha256(r.content).hexdigest() != sha256:
        raise RuntimeError(f"downloaded file does not match its sha256: {storage_path}")

    tmp = local+ ".part"
    with open(tmp, "wb") as fh:
        fh.write(r.content)
    os.replace(tmp,local)
    return local

def upload_replay(match_id, data):
    path = f"{match_id}.jsonl.gz"
    r = _http.post(
        f"/object/replays/{path}",
        content=data,
        headers={"Content-Type": "application/gzip", "x-upsert": "true"},
    )
    r.raise_for_status()
    return path
