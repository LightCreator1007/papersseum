import gzip
import json

import papersseum
from papersseum_worker import runner
from papersseum_worker.replay import build_replay

from conftest import BUILTIN_LOBBY


def test_replay_file_round_trips():
    result = runner.play(99, BUILTIN_LOBBY)
    data = build_replay(99, BUILTIN_LOBBY, result, "abc123")
    lines = gzip.decompress(data).decode().splitlines()

    header, actions, footer = json.loads(lines[0]), lines[1:-1], json.loads(lines[-1])
    assert header["type"] == "header"
    assert header["seed"] == 99
    assert header["engine_hash"] == "abc123"
    assert [p["slot"] for p in header["players"]] == [0, 1, 2, 3, 4]
    assert footer == {"type": "result", "scores": result["scores"], "placements": result["placements"]}

    action_log = [json.loads(line) for line in actions]
    assert action_log == result["action_log"]
    replayed = papersseum.replay_match(header["seed"], action_log)
    assert [int(p) for p in replayed["placements"]] == footer["placements"]


def test_replay_is_small():
    result = runner.play(7, BUILTIN_LOBBY)
    assert len(build_replay(7, BUILTIN_LOBBY, result, "h")) < 10_000
