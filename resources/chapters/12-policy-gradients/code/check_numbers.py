"""Checks every number quoted in the chapter 12 lesson, so the text and the maths cannot drift apart.

    python check_numbers.py
"""

import numpy as np

from bandit_policy import experiment, grad_log_prob, softmax
from reinforce_cartpole import compare_baseline, greedy, train
from cartpole import average_score


def close(a, b, tol=1e-9):
    return abs(a - b) <= tol


def main():
    # --- Three equal scores give three equal probabilities
    assert np.allclose(softmax(np.zeros(3)), 1 / 3)

    # --- Softmax of the scores [2, 1, 0]: e^2 = 7.389, e^1 = 2.718, e^0 = 1, total 11.107
    e = np.exp([2.0, 1.0, 0.0])
    assert [round(float(x), 3) for x in e] == [7.389, 2.718, 1.0] and round(float(e.sum()), 3) == 11.107
    assert [round(float(x), 3) for x in softmax(np.array([2.0, 1.0, 0.0]))] == [0.665, 0.245, 0.09]

    # --- The worked example: scores [0, 0, 0]; machine B pulled; reward 1; alpha 0.5; no baseline
    scores = np.zeros(3)
    g = grad_log_prob(scores, 1)
    assert np.allclose(g, [-1 / 3, 2 / 3, -1 / 3])
    scores = scores + 0.5 * 1.0 * g
    assert np.allclose(scores, [-1 / 6, 1 / 3, -1 / 6]) and [round(x, 4) for x in scores] == [-0.1667, 0.3333, -0.1667]
    assert [round(float(x), 4) for x in softmax(scores)] == [0.2741, 0.4519, 0.2741]
    assert round(float(np.exp(-1 / 6)), 4) == 0.8465 and round(float(np.exp(1 / 3)), 4) == 1.3956
    # ...and with a baseline of 0.5 the nudge is half as big
    half = np.zeros(3) + 0.5 * (1.0 - 0.5) * grad_log_prob(np.zeros(3), 1)
    assert np.allclose(half, [-1 / 12, 1 / 6, -1 / 12])
    assert [round(float(x), 4) for x in softmax(half)] == [0.3045, 0.391, 0.3045]

    # --- The slope of ln(probability) is one-hot minus the probabilities (checked by nudging each score)
    theta = np.array([0.4, -0.7, 1.1])
    h = 1e-6
    for action in range(3):
        numeric = []
        for k in range(3):
            up, down = theta.copy(), theta.copy()
            up[k] += h
            down[k] -= h
            numeric.append((np.log(softmax(up)[action]) - np.log(softmax(down)[action])) / (2 * h))
        assert np.allclose(numeric, grad_log_prob(theta, action), atol=1e-6)

    # --- The log-derivative trick: the slope of the expected reward equals the average of reward * (slope of ln probability)
    rewards = np.array([0.2, 0.5, 0.8])
    expected_reward = lambda t: float(softmax(t) @ rewards)
    numeric = np.array([(expected_reward(theta + h * np.eye(3)[k]) - expected_reward(theta - h * np.eye(3)[k])) / (2 * h) for k in range(3)])
    trick = sum(softmax(theta)[a] * rewards[a] * grad_log_prob(theta, a) for a in range(3))
    assert np.allclose(numeric, trick, atol=1e-6)

    # --- A baseline does not change the average slope (the slopes of ln probability average to zero)
    assert np.allclose(sum(softmax(theta)[a] * grad_log_prob(theta, a) for a in range(3)), 0, atol=1e-12)

    # --- The three machines, 200 runs of 300 pulls (alpha 0.1): with and without a baseline, with and without a bonus of 10
    expected = {
        (0.0, False): (0.91, 0.945, 0.005),
        (0.0, True): (0.91, 1.0, 0.0),
        (10.0, False): (0.39, 0.39, 0.61),
        (10.0, True): (0.90, 0.955, 0.005),
    }
    for (shift, use_baseline), (mean, high, low) in expected.items():
        got = experiment(shift, use_baseline, 200)
        assert (round(got[0], 2), round(got[1], 3), round(got[2], 3)) == (mean, high, low), ((shift, use_baseline), got)

    # --- REINFORCE on the cart-pole: one run (seed 0), average steps per block of 50 episodes
    lengths, policy = train(seed=0, episodes=500)
    blocks = [round(float(np.mean(lengths[i : i + 50])), 1) for i in range(0, 500, 50)]
    # the early blocks reproduce on every machine; the late ones wobble by a few steps with the platform's floating point
    assert all(abs(a - b) < 1.0 for a, b in zip(blocks[:7], [30.2, 49.4, 71.6, 122.0, 173.7, 180.8, 181.4])), blocks
    assert all(175 <= b <= 200 for b in blocks[7:]), blocks
    assert average_score(greedy(policy), 20, seed=5) >= 180.0   # 200.0 on some machines, a little less on others

    # --- ...and with / without the baseline over 5 seeds (the last 50 episodes)
    raw = compare_baseline()
    scores = {name: [round(x) for x in v] for name, v in raw.items()}
    assert min(scores["with baseline"]) >= 165, scores   # these runs differ a little between machines
    assert scores["no baseline"] == [148, 163, 153, 156, 177], scores
    assert 175 <= float(np.mean(raw["with baseline"])) <= 200 and round(float(np.mean(raw["no baseline"]))) == 159
    assert float(np.mean(raw["with baseline"])) - float(np.mean(raw["no baseline"])) >= 15

    # --- Check-yourself answers
    update = 0.1 * (2.0 - 0.5) * grad_log_prob(np.zeros(2), 1)  # two actions, action 1 taken, reward 2, baseline 0.5
    assert np.allclose(update, [-0.075, 0.075])
    r = np.array([5.0, 3.0, 1.0])
    assert list(r - r.mean()) == [2.0, 0.0, -2.0]

    print("every number in chapter 12 checks out")


if __name__ == "__main__":
    main()
