"""Chapter 7: Monte Carlo control on the grid world. Learn a good policy from played episodes alone.

    row 0:   .  .  .  +1        '+1' is the goal, '-1' is a pit; both end the episode.
    row 1:   .  #  .  -1        '#' is a wall.
    row 2:   S  .  .  .         'S' is where every episode starts.

Each step costs 0.04. The agent is never told what its moves do; it only plays and watches what happens.

How it learns (first-visit Monte Carlo with an epsilon-greedy policy):
    1. play one whole episode, choosing the best-looking move except with chance epsilon, when it tries a random one
    2. work out the return that followed the first visit to each (cell, move) pair
    3. nudge that pair's estimate toward the return:   new = old + alpha * (return - old)
    4. repeat, exploring a little less as time goes on

Run it:
    python mc_grid.py            # learn for a few thousand episodes and show the result
    python mc_grid.py --fast     # a quicker, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

ROWS, COLS = 3, 4
WALL, GOAL, PIT, START = (1, 1), (0, 3), (1, 3), (2, 0)
STEP_COST = -0.04
MOVES = ["up", "down", "left", "right"]
DELTA = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
SIDEWAYS = {"up": ("left", "right"), "down": ("left", "right"), "left": ("up", "down"), "right": ("up", "down")}
ARROWS = {"up": "^", "down": "v", "left": "<", "right": ">"}


def land(cell, move):
    r, c = cell[0] + DELTA[move][0], cell[1] + DELTA[move][1]
    if not (0 <= r < ROWS and 0 <= c < COLS) or (r, c) == WALL:
        return cell
    return (r, c)


def step(cell, move, slip, rng):
    """The black box world: returns (reward, next cell, finished?)."""
    if slip and rng.random() < slip:
        move = SIDEWAYS[move][int(rng.integers(2))]
    nxt = land(cell, move)
    if nxt == GOAL:
        return 1.0, nxt, True
    if nxt == PIT:
        return -1.0, nxt, True
    return STEP_COST, nxt, False


def play_episode(q, epsilon, slip, rng, max_steps=500):
    """One episode with the epsilon-greedy policy for q. Returns the list of (cell, move, reward)."""
    cell, history = START, []
    for _ in range(max_steps):
        if rng.random() < epsilon:
            move = MOVES[int(rng.integers(4))]
        else:
            values = np.array([q[(cell, m)] for m in MOVES])
            move = MOVES[int(rng.choice(np.flatnonzero(values == values.max())))]
        reward, nxt, done = step(cell, move, slip, rng)
        history.append((cell, move, reward))
        cell = nxt
        if done:
            break
    return history


def learn(episodes=3000, gamma=0.9, alpha=0.1, eps_start=0.5, eps_end=0.02, slip=0.0, seed=0):
    """First-visit Monte Carlo control. Returns q, a dict from (cell, move) to the estimated value of that move.

    Exploration starts high (eps_start) and shrinks linearly to eps_end, so early episodes roam widely and later
    ones mostly follow what has been learned.
    """
    rng = np.random.default_rng(seed)
    cells = [(r, c) for r in range(ROWS) for c in range(COLS) if (r, c) not in (WALL, GOAL, PIT)]
    q = {(c, m): 0.0 for c in cells for m in MOVES}
    for episode in range(episodes):
        epsilon = eps_start + (eps_end - eps_start) * episode / max(1, episodes - 1)
        history = play_episode(q, epsilon, slip, rng)
        # returns, worked out backwards from the end of the episode
        returns, g = [], 0.0
        for _, _, reward in reversed(history):
            g = reward + gamma * g
            returns.append(g)
        returns.reverse()
        seen = set()
        for (cell, move, _), g in zip(history, returns):
            if (cell, move) in seen:
                continue  # first visit only
            seen.add((cell, move))
            q[(cell, move)] += alpha * (g - q[(cell, move)])  # new = old + step * (surprise)
    return q


def best_moves(q):
    cells = sorted({c for c, _ in q})
    out = {}
    for cell in cells:
        values = [q[(cell, m)] for m in MOVES]
        out[cell] = MOVES[int(np.argmax(values))]
    return out


def show(q):
    policy = best_moves(q)
    for r in range(ROWS):
        line = []
        for c in range(COLS):
            cell = (r, c)
            if cell == WALL:
                line.append(" ### ")
            elif cell == GOAL:
                line.append(" +1  ")
            elif cell == PIT:
                line.append(" -1  ")
            else:
                line.append(f" {ARROWS[policy[cell]]}{max(q[(cell, m)] for m in MOVES):5.2f}")
        print("  " + "  ".join(line))


def main(fast=False):
    episodes = 3000
    q = learn(episodes=episodes, seed=0)
    print(f"best move and estimated value of each cell after {episodes} episodes:")
    show(q)
    policy = best_moves(q)
    if fast:
        assert policy[(0, 0)] == "right" and policy[(0, 1)] == "right" and policy[(0, 2)] == "right"
        assert policy[START] in ("up", "right")  # two routes tie for the start cell
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
