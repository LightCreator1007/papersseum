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


def test_replay_roundtrip_jsonl_and_gz(tmp_path):
    from papersseum.replay_io import write_replay, load_replay
    lobby = [p.BASELINES["greedy"]() for _ in range(5)]
    res = p.run_match(3, lobby)
    players = [{"slot": i, "bot_name": f"b{i}", "submission_id": f"s{i}"} for i in range(5)]
    for name in ("r.jsonl", "r.jsonl.gz"):
        path = tmp_path / name
        write_replay(path, 3, res, players)
        back = load_replay(path)
        assert back["seed"] == 3 and back["engine_hash"] == p.ENGINE_HASH
        assert back["action_log"] == res["action_log"] and back["players"] == players
        assert back["placements"] == res["placements"]
    assert (tmp_path / "r.jsonl").read_text().splitlines()[0].startswith('{"type":"header"')


def test_play_save_replay_records_the_lobby_names(tmp_path, capsys):
    from papersseum.cli import main
    from papersseum.replay_io import load_replay
    out = tmp_path / "game.jsonl.gz"
    assert main(["play", "examples/my_agent.py", "--vs", "hunter", "--seed", "2",
                 "--save-replay", str(out)]) == 0
    names = [pl["bot_name"] for pl in load_replay(out)["players"]]
    assert names == ["my_agent", "hunter", "random", "random", "random"]
    assert [pl["slot"] for pl in load_replay(out)["players"]] == [0, 1, 2, 3, 4]


def test_play_names_follow_the_lobby_it_builds():
    from papersseum.agents import HunterAgent
    res = p.play(HunterAgent, vs=["greedy", "safe_expander", "random", "hunter", "greedy"], seed=1)
    assert [pl["bot_name"] for pl in res["players"]] == [
        "HunterAgent", "greedy", "safe_expander", "random", "hunter"]     # truncated to 5 seats


def test_replay_match_and_iter_frames_agree_with_live_match():
    lobby = [p.BASELINES["safe_expander"]() for _ in range(5)]
    res = p.run_match(5, lobby)
    rep = p.replay_match(5, res["action_log"])
    assert rep["placements"] == res["placements"] and rep["scores"] == res["scores"]
    assert np.array_equal(rep["final_owner"], res["final_owner"])
    frames = list(p.iter_frames(5, res["action_log"]))
    assert len(frames) == len(res["action_log"]) + 1
    assert np.array_equal(frames[-1]["owner"], res["final_owner"])
    assert frames[0]["owner"].dtype == np.int8 and len(frames[0]["heads"]) == 5


def test_load_weights(tmp_path):
    np.save(tmp_path / "w.npy", np.arange(3))
    assert list(p.load_weights({"weights_dir": str(tmp_path)}, "w.npy")) == [0, 1, 2]
    for bad in ("../x.npy", "w.txt"):
        try:
            p.load_weights({"weights_dir": str(tmp_path)}, bad)
            assert False
        except ValueError:
            pass


def _setup_loop_state():
    """Player 0 stands on the last cell of a 4-cell trail, facing the first one."""
    from papersseum.engine import Engine
    eng = Engine(3)
    st = eng.state
    pl = st.players[0]
    cells = [(60, 60), (60, 61), (61, 61), (61, 60)]
    assert all(st.arena_mask[r, c] and st.owner[r, c] == -1 for r, c in cells)
    for r, c in cells:
        st.trail[r, c] = 0
    pl.trail_cells = list(cells)
    pl.r, pl.c = 61, 60
    pl.heading = pl.desired_heading = 0          # facing up, into (60, 60)
    pl.accumulator = 1.0                         # force a step this tick
    return eng, st, pl, cells


def test_crossing_own_trail_is_harmless():
    eng, st, pl, cells = _setup_loop_state()
    eng.advance_tick(None)
    assert pl.alive and pl.deaths == 0
    assert (pl.r, pl.c) == (60, 60)
    assert pl.trail_cells == cells                   # no duplicates, nothing erased
    assert all(st.trail[r, c] == 0 for r, c in cells)


def test_rival_trail_still_kills():
    eng, st, pl, cells = _setup_loop_state()
    for r, c in cells:
        st.trail[r, c] = 1                           # same cells, but a rival's trail
    st.players[1].trail_cells = list(cells)
    eng.advance_tick(None)
    assert pl.alive and st.players[1].alive is False and st.players[1].deaths == 1
