# requires: papersseum
"""Chapter 14: train learned_agent.py with REINFORCE against the baseline bots.

    python train.py                       # a full run (about 35 minutes on 10 cores)
    python train.py --updates 3 --fast    # a quick smoke run

The agent plays whole matches against random mixes of the baseline bots. Each decision
earns the change in our land (percentage points) minus a penalty for dying; we nudge the
policy toward actions that came before good returns (policy gradient with a baseline,
as in chapter 12).
"""

import argparse
import multiprocessing as mp
import os
import sys
import tempfile
import time

import numpy as np

import papersseum
from papersseum import BASELINES, constants as C
from papersseum.env import PapersseumEnv
from papersseum.match import _config

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import learned_agent as LA  # noqa: E402

GAMMA = 0.98
DEATH_PENALTY = 3.0
FIELDS = [["greedy", "safe_expander", "random", "greedy"], ["hunter", "greedy", "safe_expander", "random"],
          ["safe_expander", "safe_expander", "hunter", "greedy"], ["random", "greedy", "hunter", "hunter"]]


def run_episode(args):
    """Play one match with the exploring learner in seat 0. Returns (features, actions, returns, score)."""
    params, seed, field, decisions = args
    env = PapersseumEnv(seed)
    obs = env.reset()
    me = LA.Agent()
    LA.WEIGHTS = ""
    me.reset(_config(seed, 0))
    me.p = params
    me.record = True
    others = [BASELINES[n]() for n in field]
    for pid, ag in enumerate(others, start=1):
        ag.reset(_config(seed, pid))
    rewards, alive_before = [], True
    for _ in range(decisions or C.TOTAL_TICKS // C.STEP_PER_DECISION):
        actions = {0: me.act(obs[0])}
        for pid, ag in enumerate(others, start=1):
            actions[pid] = ag.act(obs[pid])
        obs, r, done, info = env.step(actions)
        alive_now = bool(obs[0]["scalars"]["alive"])
        rewards.append(r[0] - (DEATH_PENALTY if alive_before and not alive_now else 0.0))
        alive_before = alive_now
        if done:
            break
    returns = np.zeros(len(rewards))
    g = 0.0
    for t in range(len(rewards) - 1, -1, -1):
        g = rewards[t] + GAMMA * g
        returns[t] = g
    score = info["scores"][0]["time_avg_coverage"]
    xs = np.array([x for x, _ in me.trace])
    acts = np.array([a for _, a in me.trace])
    return xs, acts, returns, score


def gradients(params, xs, acts, adv):
    """Sum over steps of adv * grad log pi(a|x), for the tiny network (chapter 10's backprop by hand)."""
    g = {k: np.zeros_like(v) for k, v in params.items()}
    for x, a, A in zip(xs, acts, adv):
        h, probs = LA.forward(params, x)
        dz = -probs
        dz[a] += 1.0
        dz *= A
        g["w2"] += np.outer(dz, h)
        g["b2"] += dz
        dh = (params["w2"].T @ dz) * (1 - h * h)
        g["w1"] += np.outer(dh, x)
        g["b1"] += dh
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--updates", type=int, default=150)
    ap.add_argument("--episodes", type=int, default=20, help="matches per update")
    ap.add_argument("--lr", type=float, default=0.01)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--fast", action="store_true", help="short matches (300 decisions) for smoke tests")
    ap.add_argument("--out", default="learned_weights.npz")
    args = ap.parse_args()
    if args.fast:
        args.updates, args.episodes = min(args.updates, 2), min(args.episodes, 4)
    if args.fast and args.out == "learned_weights.npz":
        args.out = os.path.join(tempfile.mkdtemp(), "fast_weights.npz")      # never overwrite the real weights

    rng = np.random.default_rng(args.seed)
    params = LA.init_params(rng)
    m = {k: np.zeros_like(v) for k, v in params.items()}
    v2 = {k: np.zeros_like(v) for k, v in params.items()}
    decisions = 300 if args.fast else 0
    pool = mp.Pool(min(10, args.episodes))
    t0 = time.time()
    seed_counter = 1000 + args.seed * 100000
    for u in range(1, args.updates + 1):
        jobs = []
        for e in range(args.episodes):
            jobs.append((params, seed_counter, FIELDS[(u + e) % len(FIELDS)], decisions))
            seed_counter += 1
        results = pool.map(run_episode, jobs)
        xs = np.concatenate([r[0] for r in results])
        acts = np.concatenate([r[1] for r in results])
        rets = np.concatenate([r[2] for r in results])
        adv = (rets - rets.mean()) / (rets.std() + 1e-8)
        grad = gradients(params, xs, acts, adv)
        for k in params:                                      # Adam, ascending the expected return
            gk = grad[k] / len(xs)
            m[k] = 0.9 * m[k] + 0.1 * gk
            v2[k] = 0.999 * v2[k] + 0.001 * gk * gk
            params[k] = params[k] + args.lr * (m[k] / (1 - 0.9 ** u)) / (np.sqrt(v2[k] / (1 - 0.999 ** u)) + 1e-8)
        score = np.mean([r[3] for r in results])
        print(f"update {u:3d}: average land held (time-averaged) {score:5.2f}%   [{time.time() - t0:5.0f}s]", flush=True)
        np.savez(args.out, **{k: v.astype(np.float32) for k, v in params.items()})
    pool.close()
    if args.fast:
        saved = np.load(args.out)
        assert set(saved.files) == set(params) and all(np.isfinite(saved[k]).all() for k in saved.files)
        print("ok")


if __name__ == "__main__":
    main()
