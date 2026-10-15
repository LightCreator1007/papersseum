import numpy as np
from papersseum.geometry import flood_reachable
from papersseum.death import kill
from papersseum.state import recount_areas, connect_land


def close_trail(state, pid):
    p = state.players[pid]
    if not p.trail_cells:
        return 0
    others = {q.pid: state.owner == q.pid for q in state.players if q.pid != pid}   # to spot rivals' land that gets cut
    # 1) trail becomes owned land
    for (r, c) in p.trail_cells:
        state.owner[r, c] = pid
        state.trail[r, c] = -1
    p.trail_cells = []

    # 2) enclosure: cells not reachable from the border without crossing pid's land
    passable = state.arena_mask & (state.owner != pid)
    reach = flood_reachable(passable)
    sealed = state.arena_mask & (state.owner != pid) & (~reach)
    before = int((state.owner == pid).sum())
    trapped = [q.pid for q in state.players if q.alive and q.pid != pid and sealed[q.r, q.c]]
    state.owner[sealed] = pid

    recount_areas(state)
    newly = int((state.owner == pid).sum()) - before
    for q, was in others.items():             # a loop can cut a rival's land in two: a thin strip joins it again
        if int((state.owner == q).sum()) != int(was.sum()):
            connect_land(state, q, was)
    for q in trapped:                         # a bot caught inside the loop has nowhere left to go
        kill(state, q, killer=pid)
    return newly
