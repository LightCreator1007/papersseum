"""The cart-pole balancing task, in plain numpy (the same equations as the classic benchmark).

A cart can slide left and right along a track. A pole is hinged on top of it, and gravity wants to tip it over.
Each step you push the cart left or right with a fixed force. You earn +1 for every step the pole stays up.

The state is four numbers: [cart position, cart velocity, pole angle, pole angular velocity].
The episode ends if the pole tilts more than 12 degrees, or the cart leaves the track (more than 2.4 either way),
or after 200 steps. So a perfect episode scores 200.
"""

import math

import numpy as np

GRAVITY, CART_MASS, POLE_MASS, POLE_HALF_LENGTH, FORCE, DT = 9.8, 1.0, 0.1, 0.5, 10.0, 0.02
MAX_STEPS = 200
ANGLE_LIMIT = 12 * 2 * math.pi / 360
TRACK_LIMIT = 2.4


class CartPole:
    def __init__(self, rng):
        self.rng = rng
        self.state = np.zeros(4)
        self.steps = 0

    def reset(self):
        self.state = self.rng.uniform(-0.05, 0.05, size=4)
        self.steps = 0
        return self.state.copy()

    def step(self, action):
        """action 1 pushes right, action 0 pushes left. Returns (new state, reward, fell over, ran out of time)."""
        x, x_dot, theta, theta_dot = self.state
        force = FORCE if action == 1 else -FORCE
        total_mass = CART_MASS + POLE_MASS
        pole_moment = POLE_MASS * POLE_HALF_LENGTH
        cos, sin = math.cos(theta), math.sin(theta)
        temp = (force + pole_moment * theta_dot**2 * sin) / total_mass
        theta_acc = (GRAVITY * sin - cos * temp) / (POLE_HALF_LENGTH * (4.0 / 3.0 - POLE_MASS * cos**2 / total_mass))
        x_acc = temp - pole_moment * theta_acc * cos / total_mass
        x += DT * x_dot
        x_dot += DT * x_acc
        theta += DT * theta_dot
        theta_dot += DT * theta_acc
        self.state = np.array([x, x_dot, theta, theta_dot])
        self.steps += 1
        fell = abs(x) > TRACK_LIMIT or abs(theta) > ANGLE_LIMIT
        return self.state.copy(), 1.0, fell, self.steps >= MAX_STEPS


def average_score(policy, episodes, seed):
    """Run a policy (a function from a state to an action) and return the average number of steps it stays up."""
    rng = np.random.default_rng(seed)
    env = CartPole(rng)
    total = 0
    for _ in range(episodes):
        s = env.reset()
        while True:
            s, _, fell, timeout = env.step(policy(s))
            if fell or timeout:
                break
        total += env.steps
    return total / episodes
