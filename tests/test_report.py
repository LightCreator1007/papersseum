import functools

import papersseum
from papersseum.agents import BASELINES
from papersseum.match import replay_match, run_match
from papersseum.report import match_report

@functools.lru_cache(maxsize=None)
def _match(seed=7):
    agents = [BASELINES[n]() for n in ("greedy", "safe_expander", "hunter", "random", "greedy")]
    return run_match(seed, agents)


def test_shape_and_ranges():
    m = _match()
    r = match_report(m["seed"], m["action_log"])
    assert r["decisions"] == len(m["action_log"])
    assert [s["slot"] for s in r["seats"]] == [0, 1, 2, 3, 4]
    for s in r["seats"]:
        assert len(s["curve"]) == 60
        assert all(0.0 <= c <= 1.0 for c in s["curve"])
        assert s["peak_coverage"] >= s["final_coverage"]


def test_final_coverage_matches_the_engine():
    m = _match()
    r = match_report(m["seed"], m["action_log"])
    scores = {s["pid"]: s for s in replay_match(m["seed"], m["action_log"])["scores"]}
    for s in r["seats"]:
        assert abs(s["final_coverage"] * 100 - scores[s["slot"]]["coverage"]) < 1e-9


def test_deaths_match_the_engine_and_kills_pair_up():
    m = _match()
    r = match_report(m["seed"], m["action_log"])
    scores = {s["pid"]: s for s in replay_match(m["seed"], m["action_log"])["scores"]}
    for s in r["seats"]:
        assert len(s["deaths"]) == scores[s["slot"]]["deaths"]
    kills = sorted((k["decision"], k["victim"]) for s in r["seats"] for k in s["kills"])
    killed = sorted((d["decision"], s["slot"]) for s in r["seats"] for d in s["deaths"] if d["killer"] is not None)
    assert kills == killed


def test_both_kill_paths_are_recorded():
    import papersseum.death as death
    import papersseum.engine as engine
    from papersseum.engine import Engine
    from papersseum.report import _recording_kills

    st = Engine(7).state
    st.players[0].trail_cells = [(5, 5)]
    st.players[1].trail_cells = [(5, 5)]
    st.area[0] = st.area[1] - 1
    events = []
    with _recording_kills(events):
        death.resolve_headon(st, {0: (5, 6), 1: (5, 6)})
        engine.kill(st, 2, killer=3)
    assert events == [(0, 1), (2, 3)]


def test_mutual_head_on_has_no_killer():
    import papersseum.death as death
    from papersseum.engine import Engine
    from papersseum.report import _recording_kills

    st = Engine(7).state
    st.players[0].trail_cells = [(5, 5)]
    st.players[1].trail_cells = [(5, 5)]
    st.area[0] = st.area[1]
    events = []
    with _recording_kills(events):
        death.resolve_headon(st, {0: (5, 6), 1: (5, 6)})
    assert sorted(events) == [(0, None), (1, None)]


def test_kill_names_are_restored_after_success_and_after_an_error():
    import papersseum.death as death
    import papersseum.engine as engine
    original_engine, original_death = engine.kill, death.kill
    match_report(7, [[0, 0, 0, 0, 0]] * 3, points=5)
    assert engine.kill is original_engine
    assert death.kill is original_death
    try:
        match_report(7, [[0]])
    except Exception:
        pass
    else:
        raise AssertionError("a short action row should raise")
    assert engine.kill is original_engine
    assert death.kill is original_death


def test_empty_log_curve_matches_final_coverage():
    r = match_report(7, [], points=5)
    assert r["decisions"] == 0
    for s in r["seats"]:
        assert s["final_coverage"] > 0
        assert s["curve"] == [s["final_coverage"]] * 5


def test_short_logs_and_custom_points():
    r = match_report(7, [[0, 0, 0, 0, 0]] * 3, points=10)
    assert all(len(s["curve"]) == 10 for s in r["seats"])


def test_engine_hash_covers_only_the_engine_modules():
    import hashlib
    import os

    expected = ["constants", "geometry", "state", "movement", "trail",
                "capture", "death", "respawn", "engine", "observation", "env"]
    assert papersseum._ENGINE_MODULES == expected
    for ours in ("report", "cli", "render", "replay_io", "match", "frames"):
        assert ours not in papersseum._ENGINE_MODULES
    here = os.path.dirname(papersseum.__file__)
    h = hashlib.sha256()
    for name in expected:
        with open(os.path.join(here, f"{name}.py"), "rb") as fh:
            h.update(fh.read())
    assert h.hexdigest()[:16] == papersseum.ENGINE_HASH
