import functools
import gzip
import json

import pytest

import papersseum
from papersseum.replay_io import loads_replay
from papersseum_worker import runner

from conftest import BUILTIN_LOBBY, EXAMPLE_AGENT


def write(tmp_path, source):
    path = tmp_path / "agent.py"
    path.write_text(source)
    return str(path)


def test_example_agent_passes():
    assert runner.validate(str(EXAMPLE_AGENT)) == {"ok": True, "error": None, "violations": []}


def test_banned_import_is_rejected_with_line_number(tmp_path):
    res = runner.validate(write(tmp_path, "import os\n\nclass Agent:\n    def act(self, obs):\n        return 0\n"))
    assert res["ok"] is False
    assert res["error"] == "line 1: import 'os' is not allowed"
    assert res["violations"][0]["kind"] == "import"


def test_missing_agent_class_is_rejected(tmp_path):
    res = runner.validate(write(tmp_path, "class Bot:\n    pass\n"))
    assert res["ok"] is False
    assert "must define a class named 'Agent'" in res["error"]


@pytest.mark.parametrize("value", ["7", "None", "'left'"])
def test_bad_action_is_rejected(tmp_path, value):
    src = f"class Agent:\n    def reset(self, config):\n        pass\n    def act(self, obs):\n        return {value}\n"
    res = runner.validate(write(tmp_path, src))
    assert res["ok"] is False
    assert "invalid action" in res["error"]


def test_crash_in_reset_is_rejected(tmp_path):
    src = "class Agent:\n    def reset(self, config):\n        raise ValueError('boom')\n    def act(self, obs):\n        return 0\n"
    res = runner.validate(write(tmp_path, src))
    assert res == {"ok": False, "error": "reset() failed: ValueError: boom", "violations": []}


def test_crash_in_act_is_rejected(tmp_path):
    src = "class Agent:\n    def reset(self, config):\n        pass\n    def act(self, obs):\n        return 1 // 0\n"
    res = runner.validate(write(tmp_path, src))
    assert res["ok"] is False
    assert "ZeroDivisionError" in res["error"]


@pytest.fixture(scope="module")
def match():
    return runner.play(1234, BUILTIN_LOBBY)


def test_play_returns_one_result_per_seat(match):
    assert sorted(match["placements"]) == [0, 1, 2, 3, 4]
    assert sorted(s["pid"] for s in match["scores"]) == [0, 1, 2, 3, 4]
    assert len(match["action_log"]) == papersseum.constants.TOTAL_TICKS // papersseum.constants.STEP_PER_DECISION


def test_play_returns_plain_python_types(match):
    json.dumps({k: v for k, v in match.items() if k != "replay"})  # numpy ints/floats would raise here


def test_play_is_reproducible_from_the_action_log(match):
    replayed = papersseum.replay_match(1234, match["action_log"])
    assert [int(p) for p in replayed["placements"]] == match["placements"]


def test_play_seats_agents_by_slot_not_list_order(match):
    shuffled = list(reversed(BUILTIN_LOBBY))
    assert runner.play(1234, shuffled)["placements"] == match["placements"]


def test_replay_round_trips(match):
    rep = loads_replay(match["replay"])
    assert rep["seed"] == 1234
    assert rep["engine_hash"] == papersseum.ENGINE_HASH
    assert rep["numpy_version"]
    assert rep["players"] == [{"slot": p["slot"], "bot_id": p["bot_id"], "submission_id": p["submission_id"]}
                              for p in BUILTIN_LOBBY]
    assert rep["action_log"] == match["action_log"]
    assert rep["placements"] == match["placements"]


def test_replay_bytes_are_deterministic_and_small(match):
    assert gzip.decompress(match["replay"])        # really gzipped
    assert runner.play(1234, BUILTIN_LOBBY)["replay"] == match["replay"]
    assert len(match["replay"]) < 10_000


@pytest.fixture
def short_matches(monkeypatch):
    """Uploaded bots start real processes; 20 decisions is enough to see how they behave."""
    monkeypatch.setattr(runner, "run_sandboxed_match",
                        functools.partial(runner.run_sandboxed_match, max_decisions=20))


def with_upload(slot, path):
    players = [dict(p) for p in BUILTIN_LOBBY]
    players[slot] = {"slot": slot, "path": path, "bot_id": f"b{slot}", "submission_id": f"s{slot}"}
    return players


def test_uploaded_bot_plays_in_the_sandbox(short_matches):
    res = runner.play(5, with_upload(2, str(EXAMPLE_AGENT)))
    assert len(res["action_log"]) == 20
    assert res["crashed"] == {} and res["strikes"] == {}


def test_bot_that_fails_reset_is_marked_crashed(short_matches, tmp_path):
    src = "class Agent:\n    def reset(self, config):\n        raise ValueError('boom')\n    def act(self, obs):\n        return 0\n"
    res = runner.play(5, with_upload(3, write(tmp_path, src)))
    assert res["crashed"] == {3: True}
    assert all(row[3] == 0 for row in res["action_log"])        # it plays straight


def test_slow_bot_gets_strikes(short_matches, tmp_path):
    src = ("import time\n\nclass Agent:\n    def reset(self, config):\n        pass\n"
           "    def act(self, obs):\n        time.sleep(0.08)\n        return 1\n")
    res = runner.play(5, with_upload(1, write(tmp_path, src)))
    assert res["strikes"].get(1, 0) > 0
    assert res["crashed"] == {}
