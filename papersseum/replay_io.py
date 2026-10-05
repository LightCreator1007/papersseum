"""Read and write the canonical replay bundle.

A replay is just `seed + action_log + engine_hash`; the match re-runs
byte-identical from it. Scores and placements are stored for convenience but are
reproducible. This is the format the server serves at
`/v1/matches/{id}/replay.json` and that `papersseum render` consumes.
"""

import json


def write_replay(path, seed, result):
    from papersseum import ENGINE_HASH
    data = {
        "seed": seed,
        "engine_hash": ENGINE_HASH,
        "action_log": result["action_log"],
        "scores": result["scores"],
        "placements": result["placements"],
    }
    with open(path, "w") as fh:
        json.dump(data, fh)
    return path


def load_replay(path):
    with open(path) as fh:
        return json.load(fh)
