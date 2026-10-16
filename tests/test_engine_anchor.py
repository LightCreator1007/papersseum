"""A bot out on a trail must keep the land it left from. If someone takes that land the bot dies.

When a bot steps off its land, the land cell it left is its trail's anchor. If another bot takes
the anchor cell (for example by closing a loop around it), the trail is cut off from its home: the
bot dies, and whoever now owns the anchor takes its remaining land. Returning to any of its own land
before that closes the trail as usual, so the bot is safe.
"""

import numpy as np

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.state import recount_areas

NORTH, EAST, SOUTH, WEST = 0, 1, 2, 3


def build():
    eng = Engine(3)
    st = eng.state
    st.owner[:] = -1
    st.trail[:] = -1
    for p in st.players:
        p.trail_cells = []
        p.accumulator = 0.0
    for pid, (r, c) in {2: (20, 20), 3: (95, 95), 4: (20, 95)}.items():
        st.players[pid].r, st.players[pid].c = r, c
        st.owner[r, c] = pid
    return eng, st


def block(st, pid, r0, r1, c0, c1):
    st.owner[r0:r1 + 1, c0:c1 + 1] = pid


def out_on_trail(st, pid, anchor, cells, head_heading=EAST):
    """Player `pid` left its land at `anchor` and has laid `cells` (the last one is its head)."""
    p = st.players[pid]
    for r, c in cells:
        st.trail[r, c] = pid
    p.trail_cells = list(cells)
    p.anchor = anchor
    p.r, p.c = cells[-1]
    p.heading = p.desired_heading = head_heading
    return p


def b_loop_around(st, pid):
    """Player `pid` is one step from closing a loop that encloses rows 50-62, columns 50-62."""
    ring = [(49, c) for c in range(49, 64)] + [(r, 63) for r in range(50, 64)] + \
           [(63, c) for c in range(62, 48, -1)] + [(r, 49) for r in range(62, 49, -1)]
    block(st, pid, 49, 49, 48, 48)                             # a cell of b's own land next to the ring's start
    for r, c in ring:
        st.trail[r, c] = pid
    p = st.players[pid]
    p.trail_cells = list(ring)
    p.anchor = (49, 48)
    p.r, p.c = 50, 49                                           # the last cell of the ring ...
    p.heading = p.desired_heading = NORTH                       # ... one step below (49, 49), which is on the ring
    p.accumulator = 1.0
    return p, ring


def test_a_bot_whose_starting_land_is_taken_dies_and_the_taker_gets_its_other_land():
    eng, st = build()
    block(st, 0, 55, 57, 55, 57)                                # a's land: where its trail started ...
    block(st, 0, 80, 82, 80, 82)                                # ... and some more land far away
    a = out_on_trail(st, 0, (56, 56), [(56, 58), (56, 59), (56, 60)])
    b, ring = b_loop_around(st, 1)
    # b closes the loop by stepping back onto its own land at (49, 48)
    st.trail[49, 49] = 1
    b.r, b.c = 49, 49
    b.heading = b.desired_heading = WEST
    recount_areas(st)
    eng.advance_tick(None)
    assert b.alive and not a.alive and a.deaths == 1
    assert (st.owner[80:83, 80:83] == 1).all()                  # a's other land now belongs to b
    assert not (st.trail == 0).any()                            # a's trail is gone
    assert a.anchor is None


def test_a_bot_that_returns_to_its_land_before_the_loop_closes_is_safe():
    eng, st = build()
    block(st, 0, 55, 57, 55, 57)
    a = out_on_trail(st, 0, (56, 56), [(56, 58), (56, 59)], head_heading=WEST)
    a.r, a.c = 56, 58
    a.accumulator = 1.0
    st.trail[56, 58] = 0
    a.trail_cells = [(56, 58)]
    recount_areas(st)
    eng.advance_tick(None)                                      # steps west onto (56, 57): its own land
    assert a.alive and a.trail_cells == [] and a.anchor is None


def test_losing_part_of_the_land_but_not_the_starting_cell_is_fine():
    eng, st = build()
    block(st, 0, 55, 57, 55, 57)
    a = out_on_trail(st, 0, (56, 56), [(56, 58), (56, 59), (56, 60)])
    st.owner[57, 57] = 1                                        # someone took a corner, not the anchor
    recount_areas(st)
    eng.advance_tick(None)
    assert a.alive and a.anchor == (56, 56)


def test_a_bot_with_no_land_left_and_a_trail_dies_too():
    eng, st = build()
    block(st, 0, 55, 57, 55, 57)
    a = out_on_trail(st, 0, (56, 56), [(56, 58), (56, 59)])
    st.owner[55:58, 55:58] = 1                                  # its whole patch goes to player 1
    recount_areas(st)
    eng.advance_tick(None)
    assert not a.alive and a.deaths == 1


def test_a_bot_without_a_trail_is_never_affected():
    eng, st = build()
    block(st, 0, 55, 57, 55, 57)
    a = st.players[0]; a.r, a.c = 56, 56
    st.owner[55:58, 55:58] = 1                                  # its land is taken while it stands on it
    recount_areas(st)
    eng.advance_tick(None)
    assert a.alive


def test_no_bot_ever_wanders_without_its_starting_land_in_play():
    from papersseum.agents import BASELINES
    from papersseum.match import _config
    from papersseum.observation import observe

    class Straight:
        def reset(self, config): pass
        def act(self, obs): return 0

    class Square:
        def reset(self, config): self.n = 0
        def act(self, obs):
            self.n += 1
            return 2 if self.n % 25 == 0 else 0

    lineups = [(7012, [Square, Straight, Straight, BASELINES["random"], BASELINES["random"]]),
               (7025, [BASELINES["greedy"], BASELINES["hunter"], BASELINES["random"], BASELINES["safe_expander"], Square]),
               (23, [BASELINES["hunter"]] * 3 + [BASELINES["greedy"]] * 2)]
    for seed, lineup in lineups:
        eng = Engine(seed)
        agents = [make() for make in lineup]
        for pid, ag in enumerate(agents):
            ag.reset(_config(seed, pid))
        for d in range(1800):
            st = eng.state
            acts = {pid: agents[pid].act(observe(st, pid)) for pid in range(C.N_PLAYERS)}
            for k in range(C.STEP_PER_DECISION):
                eng.advance_tick(acts if k == 0 else None)
            for p in eng.state.players:
                if p.alive and p.trail_cells and p.anchor is not None:
                    assert eng.state.owner[p.anchor] == p.pid, f"seed {seed} decision {d}: player {p.pid} is out without its starting land"
