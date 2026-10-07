import json

import pytest

import papersseum
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
    assert "must return 0, 1 or 2" in res["error"]


def test_crash_in_reset_is_rejected(tmp_path):
    src = "class Agent:\n    def reset(self, config):\n        raise ValueError('boom')\n    def act(self, obs):\n        return 0\n"
    res = runner.validate(write(tmp_path, src))
    assert res == {"ok": False, "error": "ValueError: boom", "violations": []}


def test_crash_in_act_is_rejected(tmp_path):
    src = "class Agent:\n    def reset(self, config):\n        pass\n    def act(self, obs):\n        return 1 // 0\n"
    res = runner.validate(write(tmp_path, src))
    assert res["ok"] is False
    assert res["error"].startswith("ZeroDivisionError")


@pytest.fixture(scope="module")
def match():
    return runner.play(1234, BUILTIN_LOBBY)


def test_play_returns_one_result_per_seat(match):
    assert sorted(match["placements"]) == [0, 1, 2, 3, 4]
    assert sorted(s["pid"] for s in match["scores"]) == [0, 1, 2, 3, 4]
    assert len(match["action_log"]) == papersseum.constants.TOTAL_TICKS // papersseum.constants.STEP_PER_DECISION


def test_play_returns_plain_python_types(match):
    json.dumps(match)  # numpy ints/floats would raise here


def test_play_is_reproducible_from_the_action_log(match):
    replayed = papersseum.replay_match(1234, match["action_log"])
    assert [int(p) for p in replayed["placements"]] == match["placements"]


def test_play_seats_agents_by_slot_not_list_order(match):
    shuffled = list(reversed(BUILTIN_LOBBY))
    assert runner.play(1234, shuffled)["placements"] == match["placements"]
