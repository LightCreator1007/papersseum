import numpy as np
from enclave.geometry import flood_reachable
from enclave.state import recount_areas


def close_trail(state, pid):
    p = state.players[pid]
    if not p.trail_cells:
        return 0
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
    state.owner[sealed] = pid

    recount_areas(state)
    newly = int((state.owner == pid).sum()) - before
    return newly
