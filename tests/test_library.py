import numpy as np
import papersseum as p
import papersseum.channels as ch
import papersseum.state as S
import papersseum.observation as O


def test_public_api_present():
    for name in ("Agent", "PapersseumEnv", "play", "evaluate", "ascii_view",
                 "ascii_obs", "channels", "ENGINE_HASH"):
        assert hasattr(p, name)


def test_channels_match_observation_layout():
    st = S.init_match(7)
    g = O.global_planes(st, 0)
    # named indices line up with what the observation actually fills
    assert np.array_equal(g[ch.OWN_TERRITORY] > 0.5, st.owner == 0)
    assert np.array_equal(g[ch.ARENA_MASK] > 0.5, st.arena_mask)
    opp0 = ch.opponent(0)
    assert np.array_equal(g[opp0["territory"]] > 0.5, st.owner == 1)   # slot 1 is opp 0 for player 0


def test_opponent_index_bounds():
    assert ch.opponent(3)["head"] == 14
    for bad in (-1, 4):
        try:
            ch.opponent(bad)
            assert False, "expected IndexError"
        except IndexError:
            pass


def test_ascii_view_glyphs_and_shape():
    st = S.init_match(7)
    obs = O.observe(st, 0)
    art = p.ascii_obs(obs, "local")
    lines = art.split("\n")
    assert len(lines) == 31 and all(len(l) == 31 for l in lines)
    assert "@" in art and "M" in art            # head on own land at spawn
    assert set(art) <= set("@MXt~O.#\n")


def test_hunter_is_a_baseline_and_plays_valid():
    from papersseum.agents import BASELINES, HunterAgent
    assert "hunter" in BASELINES and BASELINES["hunter"] is HunterAgent
    res = p.play(HunterAgent, vs=["greedy", "safe_expander", "random"], seed=1)
    assert len(res["placements"]) == 5


def test_weights_dir_reaches_agent():
    seen = {}

    class Probe(p.Agent):
        def reset(self, config):
            seen["dir"] = config.get("weights_dir", "MISSING")
        def act(self, obs):
            return 0

    # instance agent -> weights_dir is None but the key must be present
    p.run_match(0, [Probe()] + [p.BASELINES["random"]() for _ in range(4)])
    assert seen["dir"] is None    # present, just no folder for an in-memory instance


def test_starter_template_is_valid_and_passes_scan():
    from papersseum.templates import STARTER_AGENT
    from papersseum.security.static_check import scan_source
    assert "class Agent" in STARTER_AGENT
    assert scan_source(STARTER_AGENT)["ok"]


def test_evaluate_report_shape():
    rep = p.evaluate("examples/my_agent.py", games=2, seed0=0)
    for k in ("games", "field", "placements", "win_rate", "coverage_mean",
              "deaths_mean", "rating_conservative", "strength"):
        assert k in rep
    assert rep["games"] == 2
    assert sum(rep["placements"]) == 2          # each game yields one placement
    assert 0.0 <= rep["win_rate"] <= 1.0
