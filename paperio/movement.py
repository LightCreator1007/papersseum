import math
import paperio.constants as C
from paperio.state import area_pct

_DELTA = {0: (-1, 0), 1: (0, 1), 2: (1, 0), 3: (0, -1)}


def rotate(heading, action):
    if action == 1:
        return (heading - 1) % 4
    if action == 2:
        return (heading + 1) % 4
    return heading


def step_delta(heading):
    return _DELTA[heading]


def current_speed(state, pid):
    steps = math.floor(area_pct(state, pid) / C.SPEED_STEP_PCT)
    speed = C.BASE_SPEED + steps * C.SPEED_STEP
    if state.players[pid].boost_timer > 0:
        speed *= C.KILL_BOOST_MULT
    return min(speed, C.MAX_SPEED)


def apply_decision(state, pid, action):
    p = state.players[pid]
    p.desired_heading = rotate(p.heading, action)


def intended_moves(state):
    moves = {}
    for p in state.players:
        if not p.alive:
            continue
        p.accumulator += current_speed(state, p.pid) / C.TICK_HZ
        if p.accumulator >= 1.0:
            n_steps = int(p.accumulator)
            assert n_steps <= 1, "speed exceeded one cell per tick"
            p.accumulator -= n_steps
            dr, dc = step_delta(p.desired_heading)
            moves[p.pid] = (p.r + dr, p.c + dc)
    return moves
