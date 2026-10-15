# requires: papersseum
"""Chapter 14: a small learned Papersseum agent, in one file.

It turns what the agent sees into 19 numbers (`features`), runs them through a tiny
network (19 -> 16 -> 3) and picks straight / left / right. The weights are trained by
`train.py` and embedded below as WEIGHTS, so this single file is a complete submission.

    papersseum validate learned_agent.py
    papersseum eval learned_agent.py --games 30

With WEIGHTS empty it runs a small random network, which is enough to check the plumbing.
"""

import numpy as np

from papersseum import channels as ch, unpack_weights

WEIGHTS = "UEsDBC0AAAAIAAAAIQADu3HY//////////8GABQAdzEubnB5AQAQAOACAAAAAAAAtAIAAAAAAACdyOtLU2EAgPEpgRGV5PqgJTgV2cacO5f33OY0Mw0ts8JLJJFKbpktla36IhoMQoxQvEGSeCk1c247Z+c9l11UiJCIECFNKRE1UklIKystkexf6Pn2/FpzC85duByiuKuoUZeZ7ddsaqNKbbJg6kSV2lJlu20rrSyuspWZ//npUqvdvOf28tJq895rUDJRhTLaRFWt6j87UACgYR/2ivuGPSRS8G6syKvw3ZGz6eNBPxEfLNdvaWBfKKDIesM4roU2soi0cjF8udAobApzSJRkpabFKUyD/4KafhtgwLAQTTuIl0gcOxXVTEWiE/QIuextCcpUNmDEe4ZwtAs7CEWPW3QIS3S7NkY3w2YY34CnhhJJNjr4GfwUl0ebBWvnGmEZvgpGydFHdUKjmCF/dy/CtuQx3yyT43Mwy9pWzoLSSARLDs3COn+zu4EKqEU+nxnSlfkXmC72HaGV5l2hroiBsg5ZyqC2sE6uENkhFhAllqP5THYFdHgqWMQm5HC5QlfsCiGUHhq8p3kswW8iRxA7Psk+BvmDG25+ZIA5C1+gD9jp3hQxlluPq5SOOuM9vfC+LzJBBl7PGGwxNhjd/LRcQYWBWKQHUVD7j6VqFcQu14GclN/CTSEtQBh35TZ2GQr6HWpbl/XEK9VwTaDbs4pu07/FcXaNTyNmxA9ItXTeVCLUPnNigzDHqwSZSDy1jgHgfF6DZaI9ziH5UnIsuOX/GJCZ9YQZ5LohUj8Pv4j93knJnvSHcHCvRVz8pI8Tf/qPJIeSZ8h2QSaUCek8TkuwBt5MGhMPG5wDhaCF2EFtNB7YNE2xrWBdXoEnhsv1S66snnG2VppjWol6d7ovmrtI5rGZwgq7ZjJKnZwSm3Lt+qzDP/gr3A3UoN8Qv/blgFzqkBDHrPKpdJM/OzkSIPow1BT8C1BLAwQtAAAACAAAACEAYXF2Kv//////////BgAUAGIxLm5weQEAEACgAAAAAAAAAGcAAAAAAAAAm+wX6hsQychQxlCtnpJanFykbqWgbpNmpK6joJ6WX1RSlJgXn1+UkgoSd0vMKU4FihdnJBakAvkahmY6mjoKtQrkAy4ngxzNpLkLVQK1eDawb3621G/9ab1k3RhD8U1dG79qzDMAAFBLAwQtAAAACAAAACEASXJgDP//////////BgAUAHcyLm5weQEAEADgAAAAAAAAAK0AAAAAAAAAm+wX6hsQychQxlCtnpJanFykbqWgbpNmpK6joJ6WX1RSlJgXn1+UkgoSd0vMKU4FihdnJBakAvkaxjoKhmaaOgq1CuQCLlWzSRobjE9sEjM/udVpR5rBvE2JpitXyBs92Sy3/f6mWyt4DFI1p+2YZhRq0KvTZbRou65F5MYzZi+3l5h463wzubhxwvZ5m5kNbTb83hFttsViv8miVYt3XFx/UYfNUMJCfUuvOQBQSwMELQAAAAgAAAAhADDZ/YX//////////wYAFABiMi5ucHkBABAAhgAAAAAAAABLAAAAAAAAAJvsF+obEMnIUMZQrZ6SWpxcpG6loG6TZqSuo6Cell9UUpSYF59flJIKEndLzClOBYoXZyQWpAL5GsY6mjoKtQoUAK7vNiKbnNcBAFBLAQItAy0AAAAIAAAAIQADu3HYtAIAAOACAAAGAAAAAAAAAAAAAACAAQAAAAB3MS5ucHlQSwECLQMtAAAACAAAACEAYXF2KmcAAACgAAAABgAAAAAAAAAAAAAAgAHsAgAAYjEubnB5UEsBAi0DLQAAAAgAAAAhAElyYAytAAAA4AAAAAYAAAAAAAAAAAAAAIABiwMAAHcyLm5weVBLAQItAy0AAAAIAAAAIQAw2f2FSwAAAIYAAAAGAAAAAAAAAAAAAACAAXAEAABiMi5ucHlQSwUGAAAAAAQABADQAAAA8wQAAAAA"

N_FEATURES = 19
HIDDEN = 16
REACH = 10      # how far (in cells) it looks for rivals
BAND = 5        # how wide the look-out strip is on either side


def init_params(rng):
    """Small random weights, with a lean towards going straight so early play is not a wobble."""
    p = {"w1": rng.normal(size=(HIDDEN, N_FEATURES)) * 0.3, "b1": np.zeros(HIDDEN),
         "w2": rng.normal(size=(3, HIDDEN)) * 0.1, "b2": np.array([1.0, 0.0, 0.0])}
    return {k: v.astype(np.float64) for k, v in p.items()}


def forward(p, x):
    """Returns (hidden activations, action probabilities)."""
    h = np.tanh(p["w1"] @ x + p["b1"])
    z = p["w2"] @ h + p["b2"]
    e = np.exp(z - z.max())
    return h, e / e.sum()


class Tracker:
    """Remembers a little about the current trip outside our own land."""

    def __init__(self):
        self.out_steps = 0
        self.turns = 0           # right turns minus left turns since we left home (mod 4)
        self.since_turn = 0

    def update(self, on_land, last_action):
        if on_land:
            self.out_steps, self.turns, self.since_turn = 0, 0, 0
            return
        self.out_steps += 1
        self.since_turn += 1
        if last_action in (1, 2):
            self.turns = (self.turns + (1 if last_action == 2 else -1)) % 4
            self.since_turn = 0


def features(obs, tr):
    L = obs["local"]
    c = L.shape[1] // 2                      # we sit at (c, c) facing up: row c-1 is straight ahead
    x = np.zeros(N_FEATURES, dtype=np.float64)
    x[0] = float(L[ch.OWN_TERRITORY, c, c] > 0.5)
    x[1] = min(tr.out_steps, 40) / 40.0
    x[2 + tr.turns] = 1.0                    # which way we are facing compared with when we left home
    x[6] = min(tr.since_turn, 10) / 10.0
    heads = np.zeros_like(L[0])
    trails = np.zeros_like(L[0])
    for i in range(ch.N_OPPONENTS):
        o = ch.opponent(i)
        heads += L[o["head"]]
        trails += L[o["trail"]]
    zones = {"ahead": (slice(c - REACH, c), slice(c - BAND, c + BAND + 1)),
             "behind": (slice(c + 1, c + REACH + 1), slice(c - BAND, c + BAND + 1)),
             "left": (slice(c - BAND, c + BAND + 1), slice(c - REACH, c)),
             "right": (slice(c - BAND, c + BAND + 1), slice(c + 1, c + REACH + 1))}
    for k, (rows, cols) in enumerate(zones.values()):
        x[7 + k] = float(heads[rows, cols].sum() > 0)
        x[11 + k] = min(float(trails[rows, cols].sum()), 10.0) / 10.0
    x[15] = float(L[ch.OWN_TERRITORY, c - 1, c] > 0.5)    # is the next cell ahead / left / right ours?
    x[16] = float(L[ch.OWN_TERRITORY, c, c - 1] > 0.5)
    x[17] = float(L[ch.OWN_TERRITORY, c, c + 1] > 0.5)
    x[18] = min(obs["scalars"]["coverage"], 30.0) / 30.0
    return x


class Agent:
    def reset(self, config):
        if WEIGHTS:
            W = unpack_weights(WEIGHTS)
            self.p = {k: W[k].astype(np.float64) for k in ("w1", "b1", "w2", "b2")}
        else:
            self.p = init_params(np.random.default_rng(config["seed"] * 1000 + config["pid"]))
        self.tr = Tracker()
        self.last = 0
        self.rng = np.random.default_rng(config["seed"] * 1000 + config["pid"] + 7)
        self.sample = True                   # True: draw the move from the policy's probabilities (as in training). False: always take the likeliest
        self.record = False                  # training switches this on to keep (features, action) pairs
        self.trace = []

    def act(self, obs):
        c = obs["local"].shape[1] // 2
        self.tr.update(obs["local"][ch.OWN_TERRITORY, c, c] > 0.5, self.last)
        x = features(obs, self.tr)
        _, probs = forward(self.p, x)
        a = int(self.rng.choice(3, p=probs)) if self.sample else int(np.argmax(probs))
        if self.record:
            self.trace.append((x, a))
        self.last = a
        return a
