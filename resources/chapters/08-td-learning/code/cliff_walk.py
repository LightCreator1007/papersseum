"""Chapter 8: Q-learning and SARSA on a cliff.

    row 0:   .  .  .  .  .  .  .  .
    row 1:   .  .  .  .  .  .  .  .
    row 2:   .  .  .  .  .  .  .  .
    row 3:   S  C  C  C  C  C  C  G        S = start, G = goal, C = the cliff

Every step costs 1. Stepping on the cliff costs 100 and sends the agent back to the start. The agent always chooses
a random move with chance epsilon, so walking right beside the cliff is risky.

Two learners, both of the form  Q(s, a) <- Q(s, a) + alpha * (target - Q(s, a)):
    SARSA       target = reward + gamma * Q(next state, the move it will ACTUALLY make next)
    Q-learning  target = reward + gamma * (the BEST Q in the next state)

Run it:
    python cliff_walk.py            # learn, then show each one's route and score while learning
    python cliff_walk.py --fast     # a quicker, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

ROWS, COLS = 4, 8
START, GOAL = (3, 0), (3, 7)
CLIFF = {(3, c) for c in range(1, 7)}
MOVES = ["up", "down", "left", "right"]
DELTA = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}
ARROWS = {"up": "^", "down": "v", "left": "<", "right": ">"}


def step(cell, move):
    """Returns (reward, next cell, finished?)."""
    r = min(ROWS - 1, max(0, cell[0] + DELTA[move][0]))
    c = min(COLS - 1, max(0, cell[1] + DELTA[move][1]))
    nxt = (r, c)
    if nxt in CLIFF:
        return -100.0, START, False
    if nxt == GOAL:
        return -1.0, nxt, True
    return -1.0, nxt, False


def choose(q, cell, epsilon, rng):
    if rng.random() < epsilon:
        return int(rng.integers(4))
    values = q[cell]
    return int(rng.choice(np.flatnonzero(values == values.max())))


def learn(method, episodes=500, alpha=0.5, gamma=1.0, epsilon=0.1, seed=0):
    """Returns (q, the total reward of each episode while learning)."""
    rng = np.random.default_rng(seed)
    q = {(r, c): np.zeros(4) for r in range(ROWS) for c in range(COLS)}
    totals = []
    for _ in range(episodes):
        cell, total = START, 0.0
        a = choose(q, cell, epsilon, rng)
        for _ in range(2000):
            reward, nxt, done = step(cell, MOVES[a])
            total += reward
            a_next = choose(q, nxt, epsilon, rng)
            if done:
                target = reward
            elif method == "sarsa":
                target = reward + gamma * q[nxt][a_next]  # the move it will actually make
            else:
                target = reward + gamma * q[nxt].max()  # the best move there, whatever it ends up doing
            q[cell][a] += alpha * (target - q[cell][a])  # new = old + step * (surprise)
            cell, a = nxt, a_next
            if done:
                break
        totals.append(total)
    return q, totals


def greedy_route(q, limit=40):
    """The route the learned policy follows if it never explores."""
    cell, route = START, [START]
    for _ in range(limit):
        move = MOVES[int(np.argmax(q[cell]))]
        _, cell, done = step(cell, move)
        route.append(cell)
        if done:
            return route
    return route


def show(q):
    route = set(greedy_route(q))
    for r in range(ROWS):
        line = []
        for c in range(COLS):
            cell = (r, c)
            if cell in CLIFF:
                line.append("C")
            elif cell == GOAL:
                line.append("G")
            else:
                line.append(ARROWS[MOVES[int(np.argmax(q[cell]))]] if cell in route else ".")
        print("   " + " ".join(line))


def main(fast=False):
    episodes = 300 if fast else 500
    for method in ("q-learning", "sarsa"):
        q, totals = learn(method, episodes=episodes, seed=0)
        route = greedy_route(q)
        print(f"{method}: the greedy route takes {len(route) - 1} steps; average reward per episode over the last 100: {np.mean(totals[-100:]):.1f}")
        show(q)
    if fast:
        qq, tq = learn("q-learning", episodes=episodes, seed=0)
        qs, ts = learn("sarsa", episodes=episodes, seed=0)
        assert len(greedy_route(qq)) - 1 == 9  # the shortest route: up, 7 right, down
        assert len(greedy_route(qs)) - 1 > 9  # SARSA keeps further from the edge
        assert np.mean(ts[-100:]) > np.mean(tq[-100:])  # ...and scores better while it is still exploring
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
