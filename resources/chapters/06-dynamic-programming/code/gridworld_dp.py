"""Chapter 6: value iteration on a small grid world.

    row 0:   .  .  .  +1        '+1' is the goal, '-1' is a pit; both end the game.
    row 1:   .  #  .  -1        '#' is a wall.
    row 2:   S  .  .  .         'S' is where the agent starts.

Each step costs 0.04 (a reward of -0.04), reaching the goal pays +1 and the pit -1. With "slip" probability s the
agent moves sideways instead of where it meant to (half of s to each side). Bumping into a wall or the edge leaves
it where it is.

Run it:
    python gridworld_dp.py           # solve the grid with and without slipping
    python gridworld_dp.py --fast    # the same, checking itself (for tests)

Needs only numpy.
"""

import sys

import numpy as np

ROWS, COLS = 3, 4
WALL = (1, 1)
GOAL = (0, 3)
PIT = (1, 3)
START = (2, 0)
STEP_COST = -0.04
MOVES = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
ARROWS = {"up": "^", "down": "v", "left": "<", "right": ">"}
SIDEWAYS = {"up": ("left", "right"), "down": ("left", "right"), "left": ("up", "down"), "right": ("up", "down")}


def cells():
    return [(r, c) for r in range(ROWS) for c in range(COLS) if (r, c) != WALL]


def is_terminal(cell):
    return cell in (GOAL, PIT)


def land(cell, move):
    """Where one move takes you. Walls and the edge leave you where you are."""
    r, c = cell[0] + MOVES[move][0], cell[1] + MOVES[move][1]
    if not (0 <= r < ROWS and 0 <= c < COLS) or (r, c) == WALL:
        return cell
    return (r, c)


def outcomes(cell, action, slip):
    """The possible (probability, next cell, reward) after trying an action."""
    result = []
    for move, prob in [(action, 1 - slip), (SIDEWAYS[action][0], slip / 2), (SIDEWAYS[action][1], slip / 2)]:
        if prob == 0:
            continue
        nxt = land(cell, move)
        reward = 1.0 if nxt == GOAL else -1.0 if nxt == PIT else STEP_COST
        result.append((prob, nxt, reward))
    return result


def backup(v, cell, action, gamma, slip):
    return sum(p * (r + (0.0 if is_terminal(n) else gamma * v[n])) for p, n, r in outcomes(cell, action, slip))


def value_iteration(gamma=0.9, slip=0.0, tol=1e-9):
    """Sweep until nothing changes. Returns (values, best action per cell, number of sweeps)."""
    v = {c: 0.0 for c in cells()}
    sweeps = 0
    while True:
        new = {c: (0.0 if is_terminal(c) else max(backup(v, c, a, gamma, slip) for a in MOVES)) for c in v}
        sweeps += 1
        change = max(abs(new[c] - v[c]) for c in v)
        v = new
        if change < tol:
            break
    policy = {c: max(MOVES, key=lambda a: backup(v, c, a, gamma, slip)) for c in v if not is_terminal(c)}
    return v, policy, sweeps


def show(v, policy):
    for r in range(ROWS):
        line = []
        for c in range(COLS):
            cell = (r, c)
            if cell == WALL:
                line.append("   ####  ")
            elif cell == GOAL:
                line.append("   +1    ")
            elif cell == PIT:
                line.append("   -1    ")
            else:
                line.append(f"{ARROWS[policy[cell]]} {v[cell]:6.3f}")
        print("   " + "  ".join(line))


def main(fast=False):
    for slip in (0.0, 0.2):
        v, policy, sweeps = value_iteration(gamma=0.9, slip=slip)
        print(f"slip = {slip}: settled after {sweeps} sweeps. value of the start cell = {v[START]:.3f}")
        show(v, policy)
        print()
    if fast:
        v0, p0, _ = value_iteration(0.9, 0.0)
        assert p0[START] == "up" and v0[(0, 2)] > v0[(0, 1)] > v0[(0, 0)]
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
