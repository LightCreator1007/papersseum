from dataclasses import dataclass, field
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
