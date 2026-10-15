"""Chapter 12: REINFORCE, a policy-gradient method, learning to balance the cart-pole.

There is no Q-table and no Q-values. The network takes the 4 numbers describing the situation and outputs 2 scores
(logits). The softmax turns them into the probabilities of pushing left or right, and the agent really does choose
at random with those probabilities. After each episode:

  1. work out the return that followed every step (chapter 4)
  2. subtract a baseline (the average return of this episode): steps that did better than average are "good"
  3. for every step, nudge the network so that the move taken becomes more likely if it was good, less likely if bad

Run it:
    python reinforce_cartpole.py            # learn, and compare with and without the baseline
    python reinforce_cartpole.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

from cartpole import CartPole, average_score


class Network:
    """A small neural network (chapter 10): a ReLU hidden layer, linear outputs, trained with the Adam optimiser."""

    def __init__(self, sizes, rng):
        self.W = [rng.normal(0, np.sqrt(2.0 / a), size=(a, b)) for a, b in zip(sizes[:-1], sizes[1:])]
        self.b = [np.zeros(b) for b in sizes[1:]]
        self.m = [np.zeros_like(p) for p in self.W + self.b]
        self.v = [np.zeros_like(p) for p in self.W + self.b]
        self.t = 0

    def forward(self, x):
        self.inputs = [x]
        for i, (w, b) in enumerate(zip(self.W, self.b)):
            x = x @ w + b
            if i < len(self.W) - 1:
                x = np.maximum(x, 0)
            self.inputs.append(x)
        return x

    def learn(self, d_out, lr):
        grads_w, grads_b = [], []
        delta = d_out
        for i in reversed(range(len(self.W))):
            grads_w.insert(0, self.inputs[i].T @ delta)
            grads_b.insert(0, delta.sum(axis=0))
            if i > 0:
                delta = (delta @ self.W[i].T) * (self.inputs[i] > 0)
        self.t += 1
        for k, (p, g) in enumerate(zip(self.W + self.b, grads_w + grads_b)):
            self.m[k] = 0.9 * self.m[k] + 0.1 * g
            self.v[k] = 0.999 * self.v[k] + 0.001 * g * g
            p -= lr * (self.m[k] / (1 - 0.9**self.t)) / (np.sqrt(self.v[k] / (1 - 0.999**self.t)) + 1e-8)


def softmax(z):
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def train(seed=0, episodes=500, baseline=True, gamma=0.99, lr=3e-3, hidden=32):
    """Returns (steps survived in each training episode, the trained network)."""
    rng = np.random.default_rng(seed)
    env = CartPole(rng)
    policy = Network([4, hidden, 2], rng)
    lengths = []
    for _ in range(episodes):
        state = env.reset()
        states, actions, rewards = [], [], []
        while True:
            probs = softmax(policy.forward(state[None]))[0]
            action = int(rng.choice(2, p=probs))  # really choose at random, with these probabilities
            nxt, reward, fell, timeout = env.step(action)
            states.append(state)
            actions.append(action)
            rewards.append(reward)
            state = nxt
            if fell or timeout:
                break

        # the return that followed each step, worked out backwards
        returns = np.zeros(len(rewards))
        g = 0.0
        for t in reversed(range(len(rewards))):
            g = rewards[t] + gamma * g
            returns[t] = g
        advantage = returns - returns.mean() if baseline else returns

        # the slope of  ln(probability of the move taken)  with respect to the scores is  one-hot - probabilities;
        # scale it by how good the move turned out, and push that back through the network (backpropagation)
        s = np.array(states)
        probs = softmax(policy.forward(s))
        d_scores = probs.copy()
        d_scores[np.arange(len(actions)), actions] -= 1.0
        d_scores *= (advantage / len(actions))[:, None]  # a minus sign here would turn gradient ascent into descent
        policy.learn(d_scores, lr)
        lengths.append(env.steps)
    return lengths, policy


def greedy(policy):
    return lambda s: int(np.argmax(policy.forward(s[None])[0]))


def compare_baseline(seeds=5, episodes=500):
    """Average steps survived over the last 50 training episodes, with and without the baseline, for each seed."""
    return {
        "with baseline": [float(np.mean(train(s, episodes, baseline=True)[0][-50:])) for s in range(seeds)],
        "no baseline": [float(np.mean(train(s, episodes, baseline=False)[0][-50:])) for s in range(seeds)],
    }


def main(fast=False):
    episodes = 300 if fast else 500
    lengths, policy = train(seed=0, episodes=episodes)
    print("average steps survived, by block of 50 training episodes:")
    for i in range(0, episodes, 50):
        print(f"  episodes {i + 1:>3}-{min(i + 50, episodes):>3}: {np.mean(lengths[i:i + 50]):6.1f}")
    print(f"the trained policy (always taking its most likely move) survives {average_score(greedy(policy), 20, seed=5):.0f} of 200 steps")
    if "--baseline" in sys.argv:
        print("\nlast 50 episodes, 5 seeds:")
        for name, scores in compare_baseline().items():
            print(f"  {name:<14} {np.round(scores).astype(int)}   mean {np.mean(scores):.0f}")
    if fast:
        assert np.mean(lengths[-50:]) > 2 * np.mean(lengths[:50])
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
