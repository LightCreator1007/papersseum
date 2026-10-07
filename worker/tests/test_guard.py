"""The stand-in runner must never run uploaded code unless explicitly allowed."""
import pytest

from papersseum_worker import db, main, runner

from conftest import BUILTIN_LOBBY, EXAMPLE_AGENT


@pytest.fixture
def no_opt_in(monkeypatch):
    monkeypatch.delenv(runner.UNSAFE_ENV, raising=False)


@pytest.mark.parametrize("value", ["0", "true", "yes", ""])
def test_only_exactly_1_opts_in(monkeypatch, value):
    monkeypatch.setenv(runner.UNSAFE_ENV, value)
    with pytest.raises(runner.SandboxMissing):
        runner.check_allowed()


def test_validate_refuses_instead_of_rejecting(no_opt_in):
    # Raising (not returning ok=False) matters: a misconfigured worker must not
    # mark people's uploads as rejected. fail_job retries them elsewhere.
    with pytest.raises(runner.SandboxMissing):
        runner.validate(str(EXAMPLE_AGENT))


def test_match_with_an_uploaded_bot_is_refused(no_opt_in):
    players = [dict(p) for p in BUILTIN_LOBBY]
    players[2] = {"slot": 2, "path": str(EXAMPLE_AGENT), "bot_id": "b2", "submission_id": "s2"}
    with pytest.raises(runner.SandboxMissing):
        runner.play(1, players)


def test_house_bots_only_match_still_runs(no_opt_in):
    assert len(runner.play(1, BUILTIN_LOBBY)["placements"]) == 5


def test_worker_refuses_to_start_before_touching_the_database(no_opt_in, monkeypatch):
    def connect():
        raise AssertionError("connected to the database without the opt-in")

    monkeypatch.setattr(db, "connect", connect)
    with pytest.raises(SystemExit, match="not starting"):
        main.main()
