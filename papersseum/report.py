"""Per-seat match analysis from a replay: kills, deaths and a coverage curve.

Lives outside the engine modules, so it does not change ENGINE_HASH. Used by
`papersseum report` and by the in-browser engine.

Coverage is a fraction from 0 to 1 (the engine's own scores use 0 to 100).
"""
from contextlib import contextmanager

import papersseum.constants as C
import papersseum.death as death_module
import papersseum.engine as engine_module
from papersseum.engine import Engine
from papersseum.state import area_pct


@contextmanager
def _recording_kills(events):
    """Record every (victim, killer) the engine produces.

    Kills reach the engine two ways: a trail cut calls `kill` through the
    engine module's own name, and a head-on collision calls it from inside
    `death.resolve_headon`. Both names are wrapped, and both are restored in
    `finally`, even if the replay raises.
    """
    originals = {"engine": engine_module.kill, "death": death_module.kill}

    def wrap(original):
        def kill(state, pid, killer=None):
            events.append((pid, killer if killer is not None and killer != pid else None))
            return original(state, pid, killer=killer)
        return kill

    engine_module.kill = wrap(originals["engine"])
    death_module.kill = wrap(originals["death"])
    try:
        yield
    finally:
        engine_module.kill = originals["engine"]
        death_module.kill = originals["death"]


def _sample(values, points):
    if not values:
        return [0.0] * points
    if points == 1:
        return [values[-1]]
    last = len(values) - 1
    return [values[round(i * last / (points - 1))] for i in range(points)]


def match_report(seed, action_log, points=60):
    eng = Engine(seed)
    n = C.N_PLAYERS
    curves = [[] for _ in range(n)]
    kills = [[] for _ in range(n)]
    deaths = [[] for _ in range(n)]
    decisions = 0

    def coverage(pid):
        return float(area_pct(eng.state, pid)) / 100.0 if eng.state.players[pid].alive else 0.0

    events = []
    with _recording_kills(events):
        for d, row in enumerate(action_log):
            for k in range(C.STEP_PER_DECISION):
                eng.advance_tick({p: row[p] for p in range(n)} if k == 0 else None)
            for victim, killer in events:
                deaths[victim].append({"decision": d, "killer": killer})
                if killer is not None:
                    kills[killer].append({"decision": d, "victim": victim})
            events.clear()
            for p in range(n):
                curves[p].append(coverage(p))
            decisions = d + 1
            if eng.is_over():
                break

    final = {s["pid"]: s["coverage"] / 100.0 for s in eng.scores()}
    return {
        "decisions": decisions,
        "seats": [{
            "slot": p,
            "kills": kills[p],
            "deaths": deaths[p],
            "final_coverage": float(final[p]),
            "peak_coverage": max(curves[p] + [float(final[p])]),
            "curve": _sample(curves[p] or [float(final[p])], points),
        } for p in range(n)],
    }
