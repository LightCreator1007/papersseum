"""A bot whose head ends up inside a loop a rival just closed is trapped and dies.

The rival takes the land inside the loop (as always) and also the trapped bot's remaining
land, gets the kill speed boost, and the trapped bot respawns after the usual delay.
"""

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.state import recount_areas

WEST = 3


def build():
    eng = Engine(3)
    st = eng.state
    st.owner[:] = -1
    st.trail[:] = -1
    for p in st.players:
        p.trail_cells = []
        p.accumulator = 0.0
    for pid, (r, c) in {2: (20, 20), 3: (95, 95), 4: (20, 95)}.items():      # bystanders, far away
        st.players[pid].r, st.players[pid].c = r, c
        st.owner[r, c] = pid
    return eng, st


def ring(st, pid):
    """B's trail around rows 56-64, columns 66-74, hooked to a strip of its own land in column 65."""
    for r in range(56, 65):
        st.owner[r, 65] = pid
    cells = [(56, c) for c in range(66, 75)] + [(r, 74) for r in range(57, 65)] + \
            [(64, c) for c in range(73, 65, -1)] + [(r, 66) for r in range(63, 59, -1)]
    for r, c in cells:
        st.trail[r, c] = pid
    p = st.players[pid]
    p.trail_cells = list(cells)
    p.r, p.c = 60, 66                          # on the trail, one step from its own land
    p.heading = p.desired_heading = WEST
    p.accumulator = 1.0
    return p


def trapped_bot(st, pid, with_trail=True, at_home=False):
    p = st.players[pid]
    p.r, p.c = 60, 70
    if at_home:
        for r in range(59, 62):
            for c in range(69, 72):
                st.owner[r, c] = pid
    elif with_trail:
        for c in (70, 69, 68):
            st.trail[60, c] = pid
        p.trail_cells = [(60, 68), (60, 69), (60, 70)]
    return p


def test_a_bot_enclosed_by_a_rivals_loop_dies_and_the_rival_takes_its_land():
    eng, st = build()
    b = ring(st, 1)
    a = trapped_bot(st, 0)
    st.owner[40, 40] = 0                                     # a little land of its own elsewhere
    recount_areas(st)
    eng.advance_tick(None)
    assert b.alive and not a.alive and a.deaths == 1
    assert (st.owner[57:64, 67:74] == 1).all()               # the loop's interior is b's
    assert st.owner[40, 40] == -1                            # a's far-away land is not joined to b's, so it becomes neutral
    assert not (st.trail == 0).any()                         # a's trail is gone
    assert b.boost_timer > 0                                 # the kill boost
    assert a.respawn_timer > 0


def test_a_bot_at_home_inside_the_loop_dies_too():
    eng, st = build()
    b = ring(st, 1)
    a = trapped_bot(st, 0, at_home=True)
    recount_areas(st)
    eng.advance_tick(None)
    assert b.alive and not a.alive
    assert st.area[0] == 0


def test_a_bot_outside_the_loop_is_not_touched():
    eng, st = build()
    b = ring(st, 1)
    a = st.players[0]
    a.r, a.c = 60, 80                                        # east of the ring
    st.trail[60, 80] = 0
    a.trail_cells = [(60, 80)]
    recount_areas(st)
    eng.advance_tick(None)
    assert a.alive and b.alive and a.deaths == 0
    assert st.trail[60, 80] == 0


def test_the_trapped_bot_respawns_after_the_usual_delay():
    eng, st = build()
    ring(st, 1)
    a = trapped_bot(st, 0)
    recount_areas(st)
    eng.advance_tick(None)
    assert not a.alive
    for _ in range(C.RESPAWN_DELAY_TICKS + 40):
        eng.advance_tick(None)
        if a.alive:
            break
    assert a.alive and st.area[0] > 0
