import numpy as np
from papersseum.agents.base import Agent
from papersseum import channels as ch


class HunterAgent(Agent):
    """Aggressive baseline: if a rival's trail or head is nearby, steer to cut it
    (kill -> steal their land + speed burst). Otherwise expand with small loops.
    Avoids steering straight into its own trail or the wall."""

    def reset(self, config):
        self._init_rng(config)
        self.out_steps = 0
        self.side = 7
        self.radius = 12

    def act(self, obs):
        L = obs["local"]
        n = L.shape[1]
        c = n // 2                     # head is centered; row c-1 is straight ahead

        def deadly_ahead():
            return L[ch.OWN_TRAIL, c - 1, c] > 0.5 or L[ch.ARENA_MASK, c - 1, c] < 0.5

        # find the nearest opponent trail/head to hunt
        prey = np.zeros((n, n), dtype=bool)
        for i in range(ch.N_OPPONENTS):
            o = ch.opponent(i)
            prey |= L[o["trail"]] > 0.5
            prey |= L[o["head"]] > 0.5
        ys, xs = np.nonzero(prey)
        if len(ys):
            d = np.abs(ys - c) + np.abs(xs - c)
            if d.min() <= self.radius:
                tc = xs[int(np.argmin(d))]
                if deadly_ahead():
                    return 2
                if tc < c:
                    return 1           # prey to the left
                if tc > c:
                    return 2           # prey to the right
                return 0               # lined up, charge

        # no prey in range: expand like a safe looper
        on_own_land = L[ch.OWN_TERRITORY, c, c] > 0.5
        if not on_own_land and deadly_ahead():
            return 2
        if on_own_land:
            self.out_steps = 0
            return 0
        self.out_steps += 1
        return 2 if self.out_steps % self.side == 0 else 0
