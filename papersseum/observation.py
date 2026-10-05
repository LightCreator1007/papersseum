import numpy as np
import papersseum.constants as C
from papersseum.movement import current_speed
from papersseum.state import area_pct

CHANNELS = 16


def _opponent_order(pid):
    return [i for i in range(C.N_PLAYERS) if i != pid]


def global_planes(state, pid):
    g = np.zeros((CHANNELS, C.MAP_H, C.MAP_W), dtype=np.float32)

    def fill(ch_terr, who):
        g[ch_terr] = (state.owner == who).astype(np.float32)
        g[ch_terr + 1] = (state.trail == who).astype(np.float32)
        pl = state.players[who]
        if pl.alive:
            g[ch_terr + 2, pl.r, pl.c] = 1.0

    fill(0, pid)
    for slot, opp in enumerate(_opponent_order(pid)):
        fill(3 + slot * 3, opp)
    g[15] = state.arena_mask.astype(np.float32)
    return g


def local_view(state, pid):
    g = global_planes(state, pid)
    p = state.players[pid]
    half = C.LOCAL_VIEW // 2
    padded = np.zeros((CHANNELS, C.MAP_H + 2 * half, C.MAP_W + 2 * half), dtype=np.float32)
    padded[:, half:half + C.MAP_H, half:half + C.MAP_W] = g
    r0, c0 = p.r, p.c
    crop = padded[:, r0:r0 + C.LOCAL_VIEW, c0:c0 + C.LOCAL_VIEW]
    return np.ascontiguousarray(np.rot90(crop, k=p.heading, axes=(1, 2)))


def _rank(state, pid):
    cov = [(area_pct(state, i) if state.players[i].alive else 0.0, -i) for i in range(C.N_PLAYERS)]
    order = sorted(range(C.N_PLAYERS), key=lambda i: cov[i], reverse=True)
    return order.index(pid) + 1


def scalars(state, pid):
    p = state.players[pid]
    heading_oh = np.zeros(4, dtype=np.float32)
    heading_oh[p.heading] = 1.0
    opponents = []
    for opp in _opponent_order(pid):
        q = state.players[opp]
        opponents.append({
            "coverage": area_pct(state, opp),
            "alive": int(q.alive),
            "speed": current_speed(state, opp),
        })
    return {
        "coverage": area_pct(state, pid),
        "rank": _rank(state, pid),
        "speed": current_speed(state, pid),
        "heading_onehot": heading_oh,
        "alive": int(p.alive),
        "boost_remaining": p.boost_timer / C.TICK_HZ,
        "respawn_countdown": p.respawn_timer / C.TICK_HZ,
        "deaths": p.deaths,
        "time_remaining": (C.TOTAL_TICKS - state.tick) / C.TICK_HZ,
        "opponents": opponents,
    }


def observe(state, pid):
    return {"local": local_view(state, pid),
            "global": global_planes(state, pid),
            "scalars": scalars(state, pid)}
