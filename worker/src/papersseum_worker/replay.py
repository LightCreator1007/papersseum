import gzip
import json


def build_replay(seed, players, result, engine_hash):
    header = {
        "type": "header", "seed": seed, "engine_hash": engine_hash,
        "players": [{"slot": p["slot"], "bot_id": p["bot_id"],
                     "submission_id": p["submission_id"]} for p in players],
    }
    lines = [json.dumps(header)]
    lines += [json.dumps(row) for row in result["action_log"]]       # one line per decision
    lines.append(json.dumps({"type": "result", "scores": result["scores"],
                             "placements": result["placements"]}))
    return gzip.compress(("\n".join(lines) + "\n").encode())
