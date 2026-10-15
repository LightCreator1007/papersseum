from dataclasses import dataclass, field
from collections import deque
import numpy as np
import papersseum.constants as C
import papersseum.geometry as G


@dataclass
class Player:
    pid: int
    alive: bool = True
    r: int = 0
    c: int = 0
    heading: int = 0
    desired_heading: int = 0
    accumulator: float = 0.0
    trail_cells: list = field(default_factory=list)
    deaths: int = 0
    respawn_timer: int = 0
    boost_timer: int = 0
    respawn_retry: int = 0      # no respawn search before this tick (set after a failed search)


@dataclass
class GameState:
    owner: np.ndarray
    trail: np.ndarray
    arena_mask: np.ndarray
    players: list
    tick: int
    rng: np.random.Generator
    area: list
    cov_sum: list
    playable_count: int


def recount_areas(state):
    flat = state.owner[state.owner >= 0]
    counts = np.bincount(flat, minlength=C.N_PLAYERS)
    state.area = [int(counts[p]) for p in range(C.N_PLAYERS)]


def land_pieces(mask):
    """The 4-connected pieces of a boolean map: a list of (row array, column array)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    pieces = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        q, rows, cols = deque([(y, x)]), [], []
        while q:
            r, c = q.popleft()
            rows.append(r)
            cols.append(c)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = r + dr, c + dc
                if 0 <= a < h and 0 <= b < w and mask[a, b] and not seen[a, b]:
                    seen[a, b] = True
                    q.append((a, b))
        pieces.append((np.array(rows), np.array(cols)))
    return pieces


def consolidate(state, pid, before=None):
    """Keep a bot's land in one piece. Land that has been cut off from the main mass becomes neutral.

    `before` is the bot's land map from before the change; the piece that shares the most cells with it
    is the main mass (ties: the bigger piece). Without it, the biggest piece is.
    """
    pieces = land_pieces(state.owner == pid)
    if len(pieces) <= 1:
        return
    def weight(piece):
        rows, cols = piece
        return (int(before[rows, cols].sum()) if before is not None else 0, len(rows))
    keep = max(pieces, key=weight)
    for piece in pieces:
        if piece is not keep:
            state.owner[piece[0], piece[1]] = -1
    recount_areas(state)


def area_pct(state, pid):
    return 100.0 * state.area[pid] / state.playable_count


def stamp_start_patch(state, pid, center_rc):
    radius = G.disk_radius_for_fraction(C.START_AREA_FRAC, state.playable_count)
    disk = G.disk_cells(center_rc, radius) & state.arena_mask & (state.owner == -1)
    state.owner[disk] = pid
    p = state.players[pid]
    p.r, p.c = int(center_rc[0]), int(center_rc[1])
    p.heading = int(state.rng.integers(0, 4))
    p.desired_heading = p.heading
    p.accumulator = 0.0
    p.trail_cells = []
    p.alive = True
    p.respawn_timer = 0
    p.boost_timer = 0
    state.trail[state.trail == pid] = -1
    recount_areas(state)


def init_match(seed):
    rng = np.random.default_rng(seed)
    mask = G.arena_mask()
    owner = np.full((C.MAP_H, C.MAP_W), -1, dtype=np.int8)
    trail = np.full((C.MAP_H, C.MAP_W), -1, dtype=np.int8)
    players = [Player(pid=i) for i in range(C.N_PLAYERS)]
    state = GameState(
        owner=owner, trail=trail, arena_mask=mask, players=players,
        tick=0, rng=rng, area=[0] * C.N_PLAYERS, cov_sum=[0.0] * C.N_PLAYERS,
        playable_count=int(mask.sum()),
    )
    centers = G.spawn_ring_centers(rng)
    for pid, center in enumerate(centers):
        stamp_start_patch(state, pid, center)
    return state
