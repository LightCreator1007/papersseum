from paperio.agents.base import Agent


class GreedyAgent(Agent):
    def reset(self, config):
        self._init_rng(config)
        self.out_steps = 0
        self.side = 5

    def act(self, obs):
        half = obs["local"].shape[1] // 2
        on_land = obs["local"][0, half, half] > 0.5
        if on_land:
            self.out_steps = 0
            return 0
        self.out_steps += 1
        if self.out_steps % self.side == 0:
            return 2
        return 0
