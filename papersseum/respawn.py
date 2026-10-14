import math
import numpy as np
import papersseum.constants as C
import papersseum.geometry as G
from papersseum.state import stamp_start_patch

_SAMPLE_BUDGET = 200


_RETRY_EVERY = 10     # ticks between searches while the arena has no room


def _fits(state, center, radius):
    """Does a start disk at `center` lie fully on free, in-arena ground?
    Checks only the disk's bounding window instead of the whole map."""
    cy, cx = center
    r = int(math.ceil(radius))
    r0, r1 = max(0, cy - r), min(C.MAP_H, cy + r + 1)
    c0, c1 = max(0, cx - r), min(C.MAP_W, cx + r + 1)
    rr, cc = np.ogrid[r0:r1, c0:c1]
    disk = ((rr - cy) ** 2 + (cc - cx) ** 2) <= radius ** 2
    if not np.all(state.arena_mask[r0:r1, c0:c1][disk]):
        return False
    if np.any(state.owner[r0:r1, c0:c1][disk] != -1):
        return False
    if np.any(state.trail[r0:r1, c0:c1][disk] != -1):
        return False
    return True


def find_respawn_center(state, pid):
    radius = G.disk_radius_for_fraction(C.START_AREA_FRAC, state.playable_count)
    free = state.arena_mask & (state.owner == -1) & (state.trail == -1)
    if int(free.sum()) < math.pi * radius * radius:      # no room anywhere: skip the search
        return None
    heads = [(p.r, p.c) for p in state.players if p.alive and p.pid != pid]
    ys, xs = np.nonzero(free)                            # candidates are free cells only
    n = len(ys)
    for _ in range(_SAMPLE_BUDGET):
        i = int(state.rng.integers(0, n))
        center = (int(ys[i]), int(xs[i]))
        if heads and min(math.hypot(center[0] - hr, center[1] - hc) for hr, hc in heads) < C.RESPAWN_MIN_DIST:
            continue
        if _fits(state, center, radius):
            return center
    return None


def tick_respawns(state):
    for p in state.players:
        if p.alive:
            continue
        if p.respawn_timer > 0:
            p.respawn_timer -= 1
        if p.respawn_timer == 0 and state.tick >= p.respawn_retry:
            center = find_respawn_center(state, p.pid)
            if center is not None:
                stamp_start_patch(state, p.pid, center)
            else:
                p.respawn_retry = state.tick + _RETRY_EVERY
