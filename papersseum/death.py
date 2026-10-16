import papersseum.constants as C
from papersseum.state import recount_areas, connect_land
from papersseum.trail import is_outside_own_land


def classify_entry(state, pid, nr, nc):
    if not (0 <= nr < C.MAP_H and 0 <= nc < C.MAP_W) or not state.arena_mask[nr, nc]:
        return "wall"
    t = state.trail[nr, nc]
    if t == pid:
        return "self_trail"      # harmless: you may cross your own trail
    if t != -1:
        return "cut"
    return "clear"


def kill(state, pid, killer=None):
    """Kill player `pid`. If `killer` is given (and is a live, different player), the killer
    takes all of the victim's land and the victim's trail cells that lay on neutral ground, and
    a thin strip of land joins whatever is not touching its own land (a bot's land is always one
    connected mass, see `state.connect_land`). The victim's trail is always erased."""
    p = state.players[pid]
    takes = killer is not None and killer != pid and state.players[killer].alive
    before = state.owner == killer if takes else None
    claimed = [(r, c) for (r, c) in p.trail_cells if state.owner[r, c] == -1] if takes else []
    for (r, c) in p.trail_cells:
        if state.trail[r, c] == pid:
            state.trail[r, c] = -1
    state.trail[state.trail == pid] = -1
    if takes:
        state.owner[state.owner == pid] = killer
        for r, c in claimed:
            state.owner[r, c] = killer
        state.players[killer].boost_timer = C.KILL_BOOST_TICKS   # reward the kill
    else:
        state.owner[state.owner == pid] = -1
    p.trail_cells = []
    p.anchor = None
    p.alive = False
    p.deaths += 1
    p.respawn_timer = C.RESPAWN_DELAY_TICKS
    p.boost_timer = 0
    recount_areas(state)
    if takes:
        connect_land(state, killer, before)


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


def resolve_cell_conflicts(state, moves):
    """One bot per cell, and nobody gets stuck. Drops from `moves` every move that would leave two
    live bots on one cell at the end of the tick.

    Head-ons between two trail-drawing bots were settled by `resolve_headon` (the smaller dies).
    What is left:
      * A bot running into the cell of a bot whose head sits on its own trail cuts that trail: the
        owner dies (the normal cut), so the mover steps in. A defender on its own land therefore
        kills an intruder it runs into, instead of the two blocking each other.
      * Two bots that swap cells pass through each other: they end on different cells.
      * Two or more bots heading for the same cell: the bigger bot (ties: the lower seat) moves in
        and the others wait a tick.
      * A bot that is staying put at home keeps its cell; a mover that wants it waits a tick.
    A bot that has to wait becomes a staying-put bot itself, so this repeats until nothing clashes.
    """
    pos = {p.pid: (p.r, p.c) for p in state.players if p.alive}
    dest = {pid: moves.get(pid, pos[pid]) for pid in pos}
    waiting = set()

    def priority(pid):
        return (state.area[pid], -pid)

    changed = True
    while changed:
        changed = False
        by_cell = {}
        for pid in sorted(pos):
            by_cell.setdefault(dest[pid], []).append(pid)
        for cell, pids in by_cell.items():
            if len(pids) < 2:
                continue
            stayers = [pid for pid in pids if dest[pid] == pos[pid]]
            movers = [pid for pid in pids if dest[pid] != pos[pid]]
            if stayers and movers and state.trail[cell] == stayers[0]:
                winner = max(movers, key=priority)               # the stayer is cut (and dies) by whoever steps in
            else:
                winner = stayers[0] if stayers else max(pids, key=priority)
            for pid in movers:
                if pid != winner:
                    dest[pid] = pos[pid]
                    waiting.add(pid)
                    changed = True
    for pid in waiting:
        moves.pop(pid, None)
    return waiting
