"""Read and write the canonical replay file (JSONL, optionally gzipped).

A replay is `seed + one action row per decision`; the match re-runs
byte-identical from it. Layout, one JSON value per line:

    {"type":"header","format":1,"seed":..,"engine_hash":..,"numpy_version":..,
     "players":[{"slot":0,"bot_name":..,"submission_id":..}, ..]}
    [0,1,2,0,1]          <- one row per decision, one action per slot
    ...
    {"type":"result","scores":[..],"placements":[..]}

Scores and placements are stored for convenience but are reproducible from the
rows. A path ending in `.gz` is read and written gzipped. The pre-JSONL single
JSON object format is still readable.
"""

import gzip
import json
import zlib

FORMAT_VERSION = 1
MAX_REPLAY_BYTES = 16 * 1024 * 1024   # unpacked; a full match is well under 1 MB


class ReplayTooLarge(ValueError):
    """The replay unpacks to more than MAX_REPLAY_BYTES (e.g. a gzip bomb)."""


def _gunzip(data):
    """gzip.decompress, but stop past MAX_REPLAY_BYTES instead of filling memory."""
    out = bytearray()
    while data:                                              # one gzip member at a time
        d = zlib.decompressobj(16 + zlib.MAX_WBITS)
        out += d.decompress(data, MAX_REPLAY_BYTES + 1 - len(out))   # always >= 1 here
        if len(out) > MAX_REPLAY_BYTES:
            raise ReplayTooLarge("replay is too large")
        out += d.flush()
        if len(out) > MAX_REPLAY_BYTES:
            raise ReplayTooLarge("replay is too large")
        if not d.eof:
            raise EOFError("compressed replay ended early")
        data = d.unused_data
    return bytes(out)


def _header(seed, players):
    import numpy as np
    from papersseum import ENGINE_HASH
    return {
        "type": "header", "format": FORMAT_VERSION, "seed": seed,
        "engine_hash": ENGINE_HASH, "numpy_version": np.__version__,
        "players": players or [],
    }


def dumps_replay(seed, result, players=None):
    """Serialize a match result to replay JSONL bytes (uncompressed)."""
    lines = [json.dumps(_header(seed, players), separators=(",", ":"))]
    lines += [json.dumps([int(a) for a in row], separators=(",", ":"))
              for row in result["action_log"]]
    lines.append(json.dumps(
        {"type": "result", "scores": result["scores"], "placements": result["placements"]},
        separators=(",", ":")))
    return ("\n".join(lines) + "\n").encode()


def loads_replay(data):
    """Parse replay bytes (plain or gzipped) into a dict with keys: seed,
    engine_hash, numpy_version, players, action_log, scores, placements."""
    if data[:2] == b"\x1f\x8b":
        data = _gunzip(data)
    lines = [l for l in data.decode().splitlines() if l.strip()]
    first = json.loads(lines[0])
    if isinstance(first, dict) and "action_log" in first:      # legacy single-object format
        first.setdefault("players", [])
        return first
    if not isinstance(first, dict) or first.get("type") != "header":
        raise ValueError("not a papersseum replay: first line must be a header")
    out = {k: v for k, v in first.items() if k != "type"}
    out["action_log"] = []
    out.setdefault("scores", None)
    out.setdefault("placements", None)
    for line in lines[1:]:
        rec = json.loads(line)
        if isinstance(rec, list):
            out["action_log"].append(rec)
        elif rec.get("type") == "result":
            # a partial result line plays as "no recorded result", not as an unreadable file
            out["scores"], out["placements"] = rec.get("scores"), rec.get("placements")
    return out


def write_replay(path, seed, result, players=None):
    data = dumps_replay(seed, result, players)
    if str(path).endswith(".gz"):
        data = gzip.compress(data, mtime=0)
    with open(path, "wb") as fh:
        fh.write(data)
    return path


def load_replay(path):
    with open(path, "rb") as fh:
        return loads_replay(fh.read())
