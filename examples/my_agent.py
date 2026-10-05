"""Example Papersseum submission.

Copy this file, change act(), and submit. Your file must define a class named
Agent with reset(config) and act(obs) -> int (0 straight, 1 left, 2 right).

Try it:
    papersseum play examples/my_agent.py --vs greedy,safe_expander --seed 7 --render out.mp4
    papersseum validate examples/my_agent.py
"""


class Agent:
    def reset(self, config):
        # config holds the match constants plus a per-match seed and your pid.
        self.side = 6          # how far out before turning to close a loop
        self.out_steps = 0

    def act(self, obs):
        # obs has "local" (16, 31, 31, heading-aligned), "global" (16, 120, 120),
        # and "scalars". Channel 0 of the local view is your own territory;
        # the center cell (15, 15) is where your head is.
        local = obs["local"]
        half = local.shape[1] // 2
        on_own_land = local[0, half, half] > 0.5

        if on_own_land:
            self.out_steps = 0
            return 0                       # push outward to start a trail
        self.out_steps += 1
        if self.out_steps % self.side == 0:
            return 2                       # turn right to carve a loop back home
        return 0
