import numpy as np
from papersseum.agents.base import Agent


class SafeExpanderAgent(Agent):
    def reset(self, config):
        self._init_rng(config)
        self.out_steps = 0
        self.side = 8
        self.danger_radius = 10

    def _opponent_near(self, local, radius):
        half = local.shape[1] // 2
        lo, hi = half - radius, half + radius + 1
        lo = max(0, lo)
        hi = min(local.shape[1], hi)
        for slot in range(4):
            head_plane = local[3 + slot * 3 + 2]
            if head_plane[lo:hi, lo:hi].any():
                return True
        return False

    def act(self, obs):
        local = obs["local"]
        half = local.shape[1] // 2
        on_land = local[0, half, half] > 0.5
        if on_land:
            self.out_steps = 0
            return 0
        if self._opponent_near(local, self.danger_radius):
            return 2
        self.out_steps += 1
        if self.out_steps % self.side == 0:
            return 2
        return 0
