from paperio.agents.base import Agent


class RandomAgent(Agent):
    def act(self, obs):
        return int(self.rng.integers(0, 3))
