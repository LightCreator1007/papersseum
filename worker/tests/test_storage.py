import hashlib

import httpx
import pytest

from papersseum_worker import config, storage

SOURCE = b"class Agent:\n    def act(self, obs):\n        return 0\n"
SHA = hashlib.sha256(SOURCE).hexdigest()


@pytest.fixture
def fake_storage(monkeypatch, tmp_path):
    """Swap the HTTP client for one that serves SOURCE and records requests."""
    requests = []

    def handler(request):
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(200, content=SOURCE)
        return httpx.Response(200, json={"Key": "ok"})

    monkeypatch.setattr(storage, "_http", httpx.Client(
        base_url="http://storage.test/storage/v1", transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(config, "CACHE_DIR", str(tmp_path / "cache"))
    return requests


def test_downloads_once_then_uses_the_cache(fake_storage):
    first = storage.agent_file("bot/sub.py", SHA)
    second = storage.agent_file("bot/sub.py", SHA)
    assert first == second
    assert open(first, "rb").read() == SOURCE
    assert len(fake_storage) == 1
    assert fake_storage[0].url.path == "/storage/v1/object/agents/bot/sub.py"


def test_hash_mismatch_is_refused_and_not_cached(fake_storage):
    with pytest.raises(RuntimeError, match="does not match its sha256"):
        storage.agent_file("bot/sub.py", "0" * 64)
    with pytest.raises(RuntimeError):
        storage.agent_file("bot/sub.py", "0" * 64)
    assert len(fake_storage) == 2  # nothing bad was cached


def test_replay_upload_overwrites_on_retry(fake_storage):
    assert storage.upload_replay(42, b"gz") == "42.jsonl.gz"
    req = fake_storage[0]
    assert req.method == "POST"
    assert req.url.path == "/storage/v1/object/replays/42.jsonl.gz"
    assert req.headers["content-type"] == "application/gzip"
    assert req.headers["x-upsert"] == "true"
