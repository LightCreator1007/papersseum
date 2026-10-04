import paperio.constants as C
from paperio.engine import Engine
from paperio.observation import observe
from paperio.state import area_pct


class PaperIoEnv:
    def __init__(self, seed):
        self.seed = seed
        self.engine = None

    def reset(self):
        self.engine = Engine(self.seed)
        return self.obs()

    def obs(self):
        st = self.engine.state
        return {pid: observe(st, pid) for pid in range(C.N_PLAYERS)}

    def step(self, actions):
        st = self.engine.state
        clean = {}
        for pid in range(C.N_PLAYERS):
            a = actions.get(pid, 0)
            clean[pid] = a if a in (0, 1, 2) else 0
        before = [area_pct(st, p) for p in range(C.N_PLAYERS)]
        for k in range(C.STEP_PER_DECISION):
            self.engine.advance_tick(clean if k == 0 else None)
        after = [area_pct(st, p) for p in range(C.N_PLAYERS)]
        rewards = {p: after[p] - before[p] for p in range(C.N_PLAYERS)}
        done = self.engine.is_over()
        info = {"scores": self.engine.scores(), "tick": st.tick}
        return self.obs(), rewards, done, info
