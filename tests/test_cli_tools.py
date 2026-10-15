from pathlib import Path

import pytest

from papersseum.cli import main

EXAMPLE = str(Path(__file__).resolve().parents[1] / "examples" / "my_agent.py")


@pytest.fixture(scope="module")
def replay(tmp_path_factory):
    path = tmp_path_factory.mktemp("r") / "r.jsonl.gz"
    assert main(["play", EXAMPLE, "--seed", "3", "--save-replay", str(path)]) == 0
    return str(path)


def test_replay_at_opening_frame(replay, capsys):
    assert main(["replay", replay, "--at", "0"]) == 0
    out = capsys.readouterr().out
    assert "decision 0" in out
    assert out.count("slot") >= 5


def test_replay_at_past_the_end(replay, capsys):
    assert main(["replay", replay, "--at", "999999"]) == 0
    assert "past the end; showing the last frame" in capsys.readouterr().out


def test_replay_at_negative(replay, capsys):
    assert main(["replay", replay, "--at", "-1"]) == 2
    assert "--at must be 0 or more" in capsys.readouterr().err


def _fake_validate(monkeypatch, max_ms=5.0, warnings=()):
    import papersseum.sandbox as sandbox
    calls = []

    def fake(agent, backend=None, decisions=None, seed=7, **kw):
        calls.append(seed)
        return {"ok": True, "error": None, "violations": [], "warnings": list(warnings),
                "stats": {"decisions": 50, "max_ms": max_ms}}

    monkeypatch.setattr(sandbox, "validate_sandboxed", fake)
    return calls


def test_validate_strict_mentions_its_limits_and_passes_when_clean(monkeypatch, capsys):
    _fake_validate(monkeypatch)
    assert main(["validate", EXAMPLE, "--strict", "--decisions", "50"]) == 0
    out = capsys.readouterr().out
    assert "closer to the server, not identical" in out
    assert "PASSED" in out


def test_validate_strict_plays_three_seeds(monkeypatch):
    calls = _fake_validate(monkeypatch)
    assert main(["validate", EXAMPLE, "--strict", "--seed", "7", "--decisions", "50"]) == 0
    assert calls == [7, 8, 9]


def test_validate_without_strict_plays_one_seed_and_skips_the_gates(monkeypatch, capsys):
    calls = _fake_validate(monkeypatch, max_ms=49.0, warnings=["slow reset"])
    assert main(["validate", EXAMPLE, "--seed", "7", "--decisions", "50"]) == 0
    assert calls == [7]
    assert "closer to the server" not in capsys.readouterr().out


def test_validate_strict_fails_over_sixty_percent_of_the_budget(monkeypatch, capsys):
    from papersseum import constants
    calls = _fake_validate(monkeypatch, max_ms=0.6 * constants.ACT_TIMEOUT_MS + 1)
    assert main(["validate", EXAMPLE, "--strict", "--decisions", "50"]) == 1
    assert "strict: slowest decision" in capsys.readouterr().out
    assert calls == [7]


def test_validate_strict_allows_exactly_sixty_percent(monkeypatch):
    from papersseum import constants
    _fake_validate(monkeypatch, max_ms=0.6 * constants.ACT_TIMEOUT_MS)
    assert main(["validate", EXAMPLE, "--strict", "--decisions", "50"]) == 0


def test_validate_strict_fails_on_a_warning(monkeypatch, capsys):
    calls = _fake_validate(monkeypatch, warnings=["reset() took 1.8 s"])
    assert main(["validate", EXAMPLE, "--strict", "--decisions", "50"]) == 1
    assert "strict: warning treated as failure" in capsys.readouterr().out
    assert calls == [7]
