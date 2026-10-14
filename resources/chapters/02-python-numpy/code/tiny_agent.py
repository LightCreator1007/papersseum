"""Chapter 2: reading real code. A tiny agent written as a class, the way agents are written in Papersseum.

An agent is a class with two methods:
    reset(config)  is called once before it starts, so it can set things up
    act(observation) is called every time it must decide, and returns its choice

This one needs only numpy, and it plays the five-slot-machine game from the bandit chapter.

Run it:
    python tiny_agent.py            # play 1,000 pulls and report the result
    python tiny_agent.py --fast     # a short, self-checking version (for tests)
"""

import sys

import numpy as np


class TinyAgent:
    def reset(self, config):
        """Set up once. config is a dict of settings."""
        self.rng = np.random.default_rng(config["seed"])  # the agent's own random numbers
        self.epsilon = config.get("epsilon", 0.1)
        self.q = np.zeros(config["arms"])  # its running average for each machine
        self.n = np.zeros(config["arms"])  # how many times it has pulled each machine
        self.last = None

    def act(self, observation=None):
        """Choose a machine to pull. observation is what the agent sees (here: the last reward, or None)."""
        if observation is not None:
            self._learn(self.last, observation)
        if self.rng.random() < self.epsilon:
            self.last = int(self.rng.integers(len(self.q)))  # explore
        else:
            best = np.flatnonzero(self.q == self.q.max())
            self.last = int(self.rng.choice(best))  # exploit
        return self.last

    def _learn(self, arm, reward):
        self.n[arm] += 1
        self.q[arm] += (reward - self.q[arm]) / self.n[arm]  # new = old + step * (surprise)


def play(pulls=1000, seed=0):
    """Run the agent against five machines with hidden payout chances. Returns (average reward, best possible)."""
    world = np.random.default_rng(seed + 1)
    chances = np.array([0.2, 0.35, 0.5, 0.65, 0.8])
    agent = TinyAgent()
    agent.reset({"seed": seed, "arms": 5, "epsilon": 0.1})
    reward, total = None, 0.0
    for _ in range(pulls):
        arm = agent.act(reward)
        reward = 1.0 if world.random() < chances[arm] else 0.0
        total += reward
    return total / pulls, float(chances.max())


def main(fast=False):
    average, best = play(pulls=300 if fast else 1000)
    print(f"average reward per pull: {average:.3f} (the best machine pays {best:.2f} on average; random play would get 0.50)")
    if fast:
        assert average > 0.6
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
