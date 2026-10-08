"""My Papersseum agent.

Your file must define a class named Agent with:
  reset(config) -> None   called once per match
  act(obs) -> int         called every decision; return 0 straight, 1 left, 2 right

Test it:
  papersseum play     my_agent.py --vs greedy,safe_expander --seed 7 --render out.mp4
  papersseum eval     my_agent.py --games 30
  papersseum validate my_agent.py
"""

from papersseum import channels as ch, load_weights  # noqa: F401


class Agent:
    def reset(self, config):
        # config has the match constants, your per-match "seed" and "pid", and
        # "weights_dir": the folder holding this file. Load weights from there,
        # e.g.  self.policy = load_weights(config, "policy.npy")
        # (.npy/.npz/.pt/.pth; raw numpy.load / torch.load are blocked).
        self.side = 6
        self.out_steps = 0

    def act(self, obs):
        # obs["local"] is (16, 31, 31), centered on your head and rotated so you
        # face up. Channel ch.OWN_TERRITORY at the center (15, 15) tells you
        # whether you are standing on your own land.
        local = obs["local"]
        c = local.shape[1] // 2
        on_own_land = local[ch.OWN_TERRITORY, c, c] > 0.5

        if on_own_land:
            self.out_steps = 0
            return 0                        # head out to start a trail
        self.out_steps += 1
        if self.out_steps % self.side == 0:
            return 2                        # curl right to close the loop back home
        return 0
