"""Two live bots never stand on the same cell.

A head-on between two bots that are both drawing a trail is a fight (the smaller one dies).
In every other case a cell holds one bot: if two want it, the bigger bot (ties: the lower
seat) moves in and the other waits a tick; a bot also waits rather than step onto a bot that
is staying put.
"""

import numpy as np

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.state import recount_areas

EAST, WEST = 1, 3
ROW = 60


def build(seed=3):
    eng = Engine(seed)
    st = eng.state
    st.owner[:] = -1
    st.trail[:] = -1
    for p in st.players:
        p.trail_cells = []
        p.accumulator = 0.0                     # stay still unless a test says otherwise
        p.alive = True
    # park the bystanders far from row 60, columns 55-65
    for pid, (r, c) in {2: (30, 60), 3: (90, 60), 4: (60, 30)}.items():
        st.players[pid].r, st.players[pid].c = r, c
        st.owner[r, c] = pid
    recount_areas(st)
    return eng, st


def put(st, pid, col, heading=EAST, moving=True, own_cells=()):
    p = st.players[pid]
    p.r, p.c = ROW, col
    p.heading = p.desired_heading = heading
    p.accumulator = 1.0 if moving else 0.0
    for r, c in own_cells:
        st.owner[r, c] = pid
    recount_areas(st)
    return p


def cells_of(st):
    return [(p.r, p.c) for p in st.players if p.alive]


def test_mover_does_not_step_onto_a_bot_that_stays_put():
    eng, st = build()
    b = put(st, 1, 60, moving=False, own_cells=[(ROW, 59), (ROW, 60), (ROW, 61)])   # at home, standing still
    a = put(st, 0, 61, heading=WEST)                                                  # outside its own land, heading for b
    eng.advance_tick(None)
    assert a.alive and b.alive
    assert (a.r, a.c) == (ROW, 61) and (b.r, b.c) == (ROW, 60)
    assert len(set(cells_of(st))) == len(cells_of(st))


def test_two_bots_that_are_not_drawing_trails_cannot_enter_the_same_cell():
    eng, st = build()
    a = put(st, 0, 58, heading=EAST, own_cells=[(ROW, 58), (ROW - 1, 58), (ROW + 1, 58), (ROW - 2, 58)])   # the bigger bot
    b = put(st, 1, 60, heading=WEST, own_cells=[(ROW, 60)])
    eng.advance_tick(None)
    assert a.alive and b.alive
    assert (a.r, a.c) == (ROW, 59), "the bigger bot takes the cell"
    assert (b.r, b.c) == (ROW, 60), "the smaller bot waits"


def test_a_tie_goes_to_the_lower_seat():
    eng, st = build()
    a = put(st, 0, 58, heading=EAST, own_cells=[(ROW, 58)])
    b = put(st, 1, 60, heading=WEST, own_cells=[(ROW, 60)])
    assert st.area[0] == st.area[1]
    eng.advance_tick(None)
    assert (a.r, a.c) == (ROW, 59) and (b.r, b.c) == (ROW, 60)


def test_bots_cannot_swap_through_each_other():
    eng, st = build()
    a = put(st, 0, 60, heading=EAST, own_cells=[(ROW, 60)])     # at home
    b = put(st, 1, 61, heading=WEST)                             # outside, heading into a's cell
    eng.advance_tick(None)
    assert a.alive and b.alive
    assert (a.r, a.c) == (ROW, 60) and (b.r, b.c) == (ROW, 61)


def test_head_on_between_two_trail_drawers_is_still_a_fight():
    eng, st = build()
    a = put(st, 0, 58, heading=EAST, own_cells=[(ROW + 5, 58), (ROW + 5, 57), (ROW + 5, 56)])   # bigger, but out on a trail
    b = put(st, 1, 60, heading=WEST, own_cells=[(ROW + 5, 60)])
    eng.advance_tick(None)
    assert a.alive and not b.alive and b.deaths == 1
    assert (a.r, a.c) == (ROW, 59)


def test_a_waiting_bot_does_not_block_a_third_bot_forever():
    """Blocking resolves in one pass: the blocked bot stays, and the bot behind it waits too, nothing else."""
    eng, st = build()
    c = put(st, 2, 62, heading=WEST)                             # c wants b's cell, b wants a's cell
    b = put(st, 1, 61, heading=WEST)
    a = put(st, 0, 60, heading=EAST, moving=False, own_cells=[(ROW, 60)])
    eng.advance_tick(None)
    assert len(set(cells_of(st))) == len(cells_of(st))
    assert (a.r, a.c) == (ROW, 60) and (b.r, b.c) == (ROW, 61)
    assert (c.r, c.c) == (ROW, 62)                               # b did not move, so c may not move onto it


class _Spinner:
    def reset(self, config): pass
    def act(self, obs): return 1


class _Straight:
    def reset(self, config): pass
    def act(self, obs): return 0


class _Square:
    def reset(self, config): self.n = 0
    def act(self, obs):
        self.n += 1
        return 2 if self.n % 25 == 0 else 0


def test_no_two_live_bots_ever_share_a_cell_in_play():
    from papersseum.agents import BASELINES
    from papersseum.match import _config
    from papersseum.observation import observe
    # the first lineup and seed produced overlaps before the one-bot-per-cell rule
    lineups = [
        (5054, [_Spinner, BASELINES["hunter"], _Spinner, _Square, _Square]),
        (3, [BASELINES["random"], BASELINES["greedy"], _Straight, BASELINES["hunter"], _Spinner]),
        (9000, [_Straight] * 5),
    ]
    for seed, lineup in lineups:
        eng = Engine(seed)
        agents = [make() for make in lineup]
        for pid, ag in enumerate(agents):
            ag.reset(_config(seed, pid))
        for _ in range(1800):
            st = eng.state
            acts = {pid: agents[pid].act(observe(st, pid)) for pid in range(C.N_PLAYERS)}
            for k in range(C.STEP_PER_DECISION):
                eng.advance_tick(acts if k == 0 else None)
                heads = cells_of(eng.state)
                assert len(set(heads)) == len(heads), f"seed {seed} tick {eng.state.tick}: {heads}"
