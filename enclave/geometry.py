import math
from collections import deque
import numpy as np
import enclave.constants as C


def arena_mask():
    cy, cx = C.ARENA_CENTER
    rr, cc = np.ogrid[0:C.MAP_H, 0:C.MAP_W]
    return ((rr - cy) ** 2 + (cc - cx) ** 2) <= C.ARENA_RADIUS ** 2


def disk_cells(center_rc, radius):
    cy, cx = center_rc
    rr, cc = np.ogrid[0:C.MAP_H, 0:C.MAP_W]
    return ((rr - cy) ** 2 + (cc - cx) ** 2) <= radius ** 2


def disk_radius_for_fraction(frac, playable_count):
    return math.sqrt(frac * playable_count / math.pi)


def spawn_ring_centers(rng):
    cy, cx = C.ARENA_CENTER
    ring = C.SPAWN_RING_FRAC * C.ARENA_RADIUS
    rot = rng.uniform(0.0, 2.0 * math.pi)
    centers = []
    for k in range(C.N_PLAYERS):
        ang = rot + 2.0 * math.pi * k / C.N_PLAYERS
        r = int(round(cy + ring * math.sin(ang)))
        c = int(round(cx + ring * math.cos(ang)))
        centers.append((r, c))
    return centers


def flood_reachable(passable):
    h, w = passable.shape
    reach = np.zeros_like(passable, dtype=bool)
    q = deque()
    for r in range(h):
        for c in (0, w - 1):
            if passable[r, c] and not reach[r, c]:
                reach[r, c] = True
                q.append((r, c))
    for c in range(w):
        for r in (0, h - 1):
            if passable[r, c] and not reach[r, c]:
                reach[r, c] = True
                q.append((r, c))
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and passable[nr, nc] and not reach[nr, nc]:
                reach[nr, nc] = True
                q.append((nr, nc))
    return reach
