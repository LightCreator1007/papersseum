import numpy as np


class Agent:
    def reset(self, config):
        self._init_rng(config)

    def _init_rng(self, config):
        self.pid = config.get("pid", 0)
        self.weights_dir = config.get("weights_dir")   # your folder; load weights from here
        self.rng = np.random.default_rng(config.get("seed", 0) * 1000 + self.pid)

    def act(self, obs):
        return 0
