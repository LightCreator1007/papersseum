"""A bot's land is always one connected mass (cells touching along an edge); it never splits into islands.

* A kill gives the killer all of the victim's land and the victim's trail cells on empty ground. Whatever is not
  touching the killer's land is joined to it by a one-cell-wide strip over empty ground (the shortest way).
* If a rival's loop cuts a bot's land in two, the bot keeps both pieces and they are joined the same way; only
  if there is no way through empty ground does the cut-off piece become neutral.
"""

from collections import deque

import numpy as np

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.state import recount_areas

NORTH = 0


def pieces(mask):
    seen = np.zeros_like(mask)
    sizes = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        q, n = deque([(y, x)]), 0
        seen[y, x] = True
        while q:
            r, c = q.popleft()
            n += 1
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = r + dr, c + dc
                if 0 <= a < mask.shape[0] and 0 <= b < mask.shape[1] and mask[a, b] and not seen[a, b]:
                    seen[a, b] = True
                    q.append((a, b))
        sizes.append(n)
    return sizes


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


def land(st, pid, rows, cols):
    st.owner[rows[0]:rows[1] + 1, cols[0]:cols[1] + 1] = pid


def setup_cut(st, a_land, b_land, b_trail=((60, 60), (60, 61), (60, 62))):
    """A (player 0) is out in the open at (61, 60), about to step north onto B's trail."""
    land(st, 0, *a_land)
    land(st, 1, *b_land)
    b = st.players[1]
    for r, c in b_trail:
        st.trail[r, c] = 1
    b.trail_cells = list(b_trail)
    b.r, b.c = b_trail[-1]
    a = st.players[0]
    a.r, a.c = 61, 60
    a.heading = a.desired_heading = NORTH
    a.accumulator = 1.0
    recount_areas(st)
    return a, b


def test_a_kill_far_from_the_killers_land_takes_the_land_and_joins_it_with_a_thin_strip():
    eng, st = build()
    a, b = setup_cut(st, a_land=((70, 72), (60, 62)), b_land=((50, 51), (80, 82)))
    eng.advance_tick(None)
    assert a.alive and not b.alive
    assert (st.owner[50:52, 80:83] == 0).all()                   # b's land is a's now ...
    assert (st.owner[70:73, 60:63] == 0).all()
    assert pieces(st.owner == 0) == [st.area[0]]                 # ... in one piece: a strip joins the two
    assert st.area[0] > 9 + 6                                    # the strip has cells of its own
    assert not (st.trail == 1).any()


def test_victim_land_that_touches_the_killers_land_joins_directly():
    eng, st = build()
    a, b = setup_cut(st, a_land=((70, 72), (60, 62)), b_land=((73, 74), (60, 62)))   # directly below a's land
    eng.advance_tick(None)
    assert not b.alive
    assert (st.owner[73:75, 60:63] == 0).all()                   # the land touching a's land joins it directly
    assert len(pieces(st.owner == 0)) == 1                       # (b's trail cells, far from it, come with a strip)


def test_victim_trail_cells_are_claimed_and_joined_to_the_killers_land():
    eng, st = build()
    a, b = setup_cut(st, a_land=((55, 60), (58, 59)), b_land=((90, 91), (90, 91)))   # land ends at (60, 59), next to the trail
    eng.advance_tick(None)
    assert not b.alive
    assert (st.owner[60, 60:63] == 0).all()
    assert (st.owner[90:92, 90:92] == 0).all()
    assert len(pieces(st.owner == 0)) == 1


def test_a_strip_never_takes_land_from_other_bots():
    eng, st = build()
    land(st, 3, (60, 62), (90, 92))                              # a rival's land between the killer and the victim's land
    land(st, 4, (55, 58), (70, 72))
    a, b = setup_cut(st, a_land=((70, 72), (60, 62)), b_land=((50, 51), (80, 82)))
    before = {pid: int((st.owner == pid).sum()) for pid in (2, 3, 4)}
    eng.advance_tick(None)
    assert {pid: int((st.owner == pid).sum()) for pid in (2, 3, 4)} == before
    assert pieces(st.owner == 0) == [st.area[0]]


def test_a_loop_that_cuts_a_rivals_land_in_two_keeps_it_in_one_piece():
    eng, st = build()
    land(st, 1, (59, 61), (50, 80))                              # b: a long bar, 3 x 31
    land(st, 0, (55, 55), (66, 66))                              # a: one cell its loop hooks onto
    a = st.players[0]
    cells = [(56, c) for c in range(66, 75)] + [(r, 74) for r in range(57, 65)] + \
            [(64, c) for c in range(73, 65, -1)] + [(r, 66) for r in range(63, 56, -1)]
    for r, c in cells:
        st.trail[r, c] = 0
    a.trail_cells = list(cells)
    a.r, a.c = 56, 66
    a.heading = a.desired_heading = NORTH                        # one step onto its own land at (55, 66)
    a.accumulator = 1.0
    b = st.players[1]
    b.r, b.c = 60, 52                                            # b is at the west end, outside the loop
    recount_areas(st)
    assert pieces(st.owner == 1) == [3 * 31]
    eng.advance_tick(None)
    assert a.alive and b.alive
    assert len(pieces(st.owner == 1)) == 1                       # the loop cut the bar in two, but b keeps both ends,
    assert (st.owner[59:62, 75:81] == 1).all()                   # joined by a thin strip around the loop
    assert (st.owner[59:62, 50:65] == 1).all()


def test_nobody_ever_has_two_islands_in_play():
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
               (7023, [BASELINES["safe_expander"], BASELINES["safe_expander"], Straight, BASELINES["greedy"], Straight]),
               (7025, [BASELINES["greedy"], BASELINES["hunter"], BASELINES["random"], BASELINES["random"], BASELINES["random"]])]
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
            if d % 3 == 0:
                for pid in range(C.N_PLAYERS):
                    assert len(pieces(eng.state.owner == pid)) <= 1, f"seed {seed} decision {d}: player {pid} has islands"
