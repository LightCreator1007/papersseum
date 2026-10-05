import math
import numpy as np
import papersseum.constants as C
import papersseum.geometry as G
from papersseum.state import stamp_start_patch

_SAMPLE_BUDGET = 200


def _fits(state, center):
    radius = G.disk_radius_for_fraction(C.START_AREA_FRAC, state.playable_count)
    disk = G.disk_cells(center, radius)
    if not np.all(state.arena_mask[disk]):
        return False
    if np.any(state.owner[disk] != -1):
        return False
    if np.any(state.trail[disk] != -1):
        return False
    return True


def find_respawn_center(state, pid):
    heads = [(p.r, p.c) for p in state.players if p.alive and p.pid != pid]
    ys, xs = np.nonzero(state.arena_mask)
    n = len(ys)
    for _ in range(_SAMPLE_BUDGET):
        i = int(state.rng.integers(0, n))
        center = (int(ys[i]), int(xs[i]))
        if heads and min(math.hypot(center[0] - hr, center[1] - hc) for hr, hc in heads) < C.RESPAWN_MIN_DIST:
            continue
        if _fits(state, center):
            return center
    return None


def tick_respawns(state):
    for p in state.players:
        if p.alive:
            continue
        if p.respawn_timer > 0:
            p.respawn_timer -= 1
        if p.respawn_timer == 0:
            center = find_respawn_center(state, p.pid)
            if center is not None:
                stamp_start_patch(state, p.pid, center)
