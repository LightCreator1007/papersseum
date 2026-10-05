import papersseum.constants as C
from papersseum.state import recount_areas
from papersseum.trail import is_outside_own_land


def classify_entry(state, pid, nr, nc):
    if not (0 <= nr < C.MAP_H and 0 <= nc < C.MAP_W) or not state.arena_mask[nr, nc]:
        return "wall"
    t = state.trail[nr, nc]
    if t == pid:
        return "self_trail"
    if t != -1:
        return "cut"
    return "clear"


def kill(state, pid, killer=None):
    """Kill player `pid`. If `killer` is given (and is a live, different player),
    the victim's territory is transferred to the killer; otherwise it becomes
    neutral. The victim's trail is always erased."""
    p = state.players[pid]
    for (r, c) in p.trail_cells:
        if state.trail[r, c] == pid:
            state.trail[r, c] = -1
    state.trail[state.trail == pid] = -1
    if killer is not None and killer != pid and state.players[killer].alive:
        state.owner[state.owner == pid] = killer
        state.players[killer].boost_timer = C.KILL_BOOST_TICKS   # reward the kill
    else:
        state.owner[state.owner == pid] = -1
    p.trail_cells = []
    p.alive = False
    p.deaths += 1
    p.respawn_timer = C.RESPAWN_DELAY_TICKS
    p.boost_timer = 0
    recount_areas(state)


def is_laying_trail(state, pid):
    p = state.players[pid]
    if p.trail_cells:
        return True
    return is_outside_own_land(state, pid, p.r, p.c)


def resolve_headon(state, moves):
    killed = set()
    pids = sorted(moves)
    pairs = []
    for i in range(len(pids)):
        for j in range(i + 1, len(pids)):
            a, b = pids[i], pids[j]
            same_cell = moves[a] == moves[b]
            swap = moves[a] == (state.players[b].r, state.players[b].c) and \
                   moves[b] == (state.players[a].r, state.players[a].c)
            if same_cell or swap:
                pairs.append((a, b))
    killer_of = {}
    for a, b in pairs:
        if a in killed or b in killed:
            continue
        if is_laying_trail(state, a) and is_laying_trail(state, b):
            if state.area[a] < state.area[b]:
                killed.add(a)
                killer_of[a] = b          # bigger survivor claims the land
            elif state.area[b] < state.area[a]:
                killed.add(b)
                killer_of[b] = a
            else:
                killed.add(a)             # mutual kill, no killer -> neutral
                killed.add(b)
    for pid in sorted(killed):
        kill(state, pid, killer=killer_of.get(pid))
    return killed
