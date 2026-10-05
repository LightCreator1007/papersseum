def is_outside_own_land(state, pid, r, c):
    return state.owner[r, c] != pid


def lay_trail(state, pid, r, c):
    if state.trail[r, c] == pid:
        return
    state.trail[r, c] = pid
    state.players[pid].trail_cells.append((r, c))
