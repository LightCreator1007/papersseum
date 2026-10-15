"""Chapter 11: a deep Q-network (DQN) that learns to balance a pole, in plain numpy.

The network takes the 4 numbers describing the situation and outputs 2 numbers: how good it is to push left
and how good it is to push right. It learns by Q-learning (chapter 8), with a neural network in place of the table,
plus two tricks that stop it from falling apart:

  replay buffer     remember recent steps, and learn from a random batch of them instead of the latest step only
  target network    compute the learning target with a slowly-updated copy of the network, so the target stays put

Run it:
    python dqn_cartpole.py            # train, and print the learning curve
    python dqn_cartpole.py --fast     # a quick, self-checking version (for tests)

Needs only numpy.
"""

import sys

import numpy as np

from cartpole import CartPole, average_score


class Network:
    """A small neural network (chapter 10): ReLU hidden layers, a linear output, trained with the Adam optimiser
    (a version of gradient descent that adapts the step size of each weight)."""

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
                x = np.maximum(x, 0)  # ReLU
            self.inputs.append(x)
        return x

    def learn(self, d_out, lr):
        """Backpropagation (chapter 10), then one Adam step."""
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

    def copy_from(self, other):
        self.W = [w.copy() for w in other.W]
        self.b = [b.copy() for b in other.b]


def greedy_action(net, state):
    return int(np.argmax(net.forward(state[None])[0]))


def train(seed=0, episodes=300, replay=True, target_net=True, gamma=0.99, lr=1e-3, batch=64,
          buffer_size=10_000, warmup=500, sync_every=200, keep_best=False):
    """Train a DQN. Returns (steps survived in each training episode, the best network if keep_best else the last)."""
    rng = np.random.default_rng(seed)
    env = CartPole(rng)
    q = Network([4, 64, 64, 2], rng)
    target = Network([4, 64, 64, 2], rng)
    target.copy_from(q)
    memory = []  # (state, action, reward, next state, fell over)
    lengths, steps = [], 0
    best_score, best_net = -1.0, None

    for episode in range(episodes):
        epsilon = max(0.05, 1.0 - episode / 100)  # explore a lot at first, then less
        state = env.reset()
        while True:
            if rng.random() < epsilon:
                action = int(rng.integers(2))
            else:
                action = greedy_action(q, state)
            nxt, reward, fell, timeout = env.step(action)
            steps += 1
            memory.append((state, action, reward, nxt, float(fell)))
            if len(memory) > buffer_size:
                memory.pop(0)
            state = nxt

            if len(memory) >= warmup:
                # a batch to learn from: random ones from memory (the replay trick), or just the latest steps
                idx = rng.integers(0, len(memory), size=batch) if replay else np.arange(len(memory) - batch, len(memory))
                s = np.array([memory[i][0] for i in idx])
                a = np.array([memory[i][1] for i in idx])
                r = np.array([memory[i][2] for i in idx])
                s2 = np.array([memory[i][3] for i in idx])
                d = np.array([memory[i][4] for i in idx])
                # the learning target:  reward + gamma * (the best Q-value in the next state)
                # computed with the slow copy of the network (the target-network trick), or with the live one
                judge = target if target_net else q
                best_next = judge.forward(s2).max(axis=1)
                targets = r + gamma * (1 - d) * best_next
                out = q.forward(s)
                picked = out[np.arange(batch), a]
                d_out = np.zeros_like(out)
                d_out[np.arange(batch), a] = 2 * (picked - targets) / batch  # slope of the squared error
                q.learn(d_out, lr)
            if target_net and steps % sync_every == 0:
                target.copy_from(q)
            if fell or timeout:
                break
        lengths.append(env.steps)
        if keep_best and (episode + 1) % 20 == 0:
            score = average_score(lambda st: greedy_action(q, st), 5, seed=10_000 + episode)
            if score >= best_score:
                best_score = score
                best_net = Network([4, 64, 64, 2], rng)
                best_net.copy_from(q)
    return lengths, (best_net if keep_best and best_net is not None else q)


def compare_tricks(seeds=5, episodes=300):
    """Train with and without each trick. Returns {name: the average steps survived over the last 50 training
    episodes, one number per seed}."""
    settings = {
        "both tricks": dict(replay=True, target_net=True),
        "no target network": dict(replay=True, target_net=False),
        "no replay buffer": dict(replay=False, target_net=True),
        "neither": dict(replay=False, target_net=False),
    }
    return {name: [float(np.mean(train(seed, episodes, **kw)[0][-50:])) for seed in range(seeds)] for name, kw in settings.items()}


def main(fast=False):
    episodes = 150 if fast else 300
    lengths, net = train(seed=0, episodes=episodes)
    print("average steps survived, by block of 25 training episodes:")
    for i in range(0, episodes, 25):
        print(f"  episodes {i + 1:>3}-{min(i + 25, episodes):>3}: {np.mean(lengths[i:i + 25]):6.1f}")
    coin = np.random.default_rng(0)  # one random generator, kept between calls
    print(f"a random agent survives about {average_score(lambda s: int(coin.integers(2)), 200, seed=1):.0f} steps")
    score = average_score(lambda st: greedy_action(net, st), 20, seed=123)
    print(f"the trained network, with no exploring, survives {score:.0f} of 200 steps on average")
    if "--tricks" in sys.argv:
        print("\naverage steps survived over the last 50 training episodes, for 5 different seeds:")
        for name, scores in compare_tricks().items():
            print(f"  {name:<18} {np.round(scores).astype(int)}   mean {np.mean(scores):.0f}")
    if fast:
        assert np.mean(lengths[-25:]) > 3 * np.mean(lengths[:25])
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
