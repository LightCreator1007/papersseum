"""Viewer frames: re-run a match and encode it for the web replay viewer.

Layout ("PSRP" v1, little-endian; read by web/lib/replay-format.ts):
b"PSRP", u8 version=1, u16 height, u16 width, u16 frames, u8 players, then
height*width cell bytes (frame 0), then per frame: players*(u8 row, u8 col)
heads (255,255 = dead) and, for every frame after the first, u16 n plus
n*(u16 cell index, u8 value).
Cell byte: 0xFE outside the arena, else low nibble = owner (0-4, 15 none),
high nibble = trail (0-4, 15 none); 0xFF is an empty cell.

The browser runs this module in Pyodide (web/public/engine/worker.mjs), one
batch at a time so a run can be cancelled between batches.
"""

import json
import struct

import numpy as np

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.geometry import arena_mask
from papersseum.replay_io import MAX_REPLAY_BYTES, ReplayTooLarge, loads_replay

OUTSIDE = 0xFE
MAX_DECISIONS = C.TOTAL_TICKS // C.STEP_PER_DECISION       # 1800
_DIFF = np.dtype([("index", "<u2"), ("value", "u1")])       # 3 bytes, unpadded


def cell_bytes(owner, trail, mask):
    owner = owner.astype(np.int16)
    trail = trail.astype(np.int16)
    value = np.where(owner >= 0, owner, 15) | (np.where(trail >= 0, trail, 15) << 4)
    return np.where(mask, value, OUTSIDE).astype(np.uint8).ravel()


def check_replay(rep):
    """Raise ValueError with a plain-English reason unless the replay can be played.

    A valid log never ends the match early (the engine only stops at the final
    tick, after MAX_DECISIONS rows), so a checked replay has len(log) + 1 frames.
    """
    seed = rep.get("seed")
    if type(seed) is not int or seed < 0:
        raise ValueError("its seed is not a whole number of 0 or more")
    log = rep.get("action_log")
    if not isinstance(log, list) or not log:
        raise ValueError("it has no moves")
    if len(log) > MAX_DECISIONS:
        raise ValueError(f"it has {len(log)} decisions; a match has at most {MAX_DECISIONS}")
    for i, row in enumerate(log):
        if (not isinstance(row, list) or len(row) != C.N_PLAYERS
                or any(type(a) is not int or a not in (0, 1, 2) for a in row)):
            raise ValueError(f"decision {i + 1} is not {C.N_PLAYERS} moves of 0, 1 or 2")


class FrameEncoder:
    """Re-runs a match one batch of decisions at a time and encodes the frames.

    Call header() once, then next_batch() until it returns None, then result().
    """

    def __init__(self, seed, action_log, replay=None):
        self.replay = replay
        self.frames = len(action_log) + 1
        self._log = action_log
        self._eng = Engine(seed)
        self._mask = arena_mask()
        self._done_rows = 0
        self._prev = None

    def _cells(self):
        st = self._eng.state
        return cell_bytes(st.owner, st.trail, self._mask)

    def _heads(self):
        return b"".join(struct.pack("<BB", p.r, p.c) if p.alive else b"\xff\xff"
                        for p in self._eng.state.players)

    def header(self):
        st = self._eng.state
        height, width = st.owner.shape
        self._prev = self._cells()
        return (b"PSRP" + struct.pack("<BHHHB", 1, height, width, self.frames, len(st.players))
                + self._prev.tobytes() + self._heads())

    def next_batch(self, n=50):
        if self._prev is None:
            raise RuntimeError("call header() first")
        rows = self._log[self._done_rows:self._done_rows + n]
        if not rows:
            return None
        out = bytearray()
        for row in rows:
            actions = {p: row[p] for p in range(C.N_PLAYERS)}
            for k in range(C.STEP_PER_DECISION):
                self._eng.advance_tick(actions if k == 0 else None)
            out += self._heads()
            cur = self._cells()
            changed = np.flatnonzero(cur != self._prev)
            diffs = np.empty(len(changed), dtype=_DIFF)
            diffs["index"] = changed
            diffs["value"] = cur[changed]
            out += struct.pack("<H", len(changed)) + diffs.tobytes()
            self._prev = cur
        self._done_rows += len(rows)
        return bytes(out)

    @property
    def done(self):
        return self._done_rows == len(self._log)

    def result(self):
        """{"scores", "placements"} of the re-run match; only once every batch is out."""
        if not self.done:
            raise RuntimeError("the match has not been fully encoded yet")
        scores = [{k: (float(v) if isinstance(v, (float, np.floating)) else v) for k, v in s.items()}
                  for s in self._eng.scores()]
        return {"scores": scores, "placements": [int(p) for p in self._eng.placements()]}

    def result_json(self):
        return json.dumps(self.result())

    def meta_json(self):
        """JSON for the viewer: seed, both engine hashes, players and the recorded result."""
        from papersseum import ENGINE_HASH
        rep = self.replay or {}
        recorded = None
        if rep.get("placements") is not None and rep.get("scores") is not None:
            recorded = {"scores": rep["scores"], "placements": rep["placements"]}
        return json.dumps({
            "seed": rep.get("seed"), "engineHash": rep.get("engine_hash"), "shippedHash": ENGINE_HASH,
            "players": rep.get("players") or [], "recorded": recorded, "frames": self.frames,
        })


def open_replay(data):
    """Parse and check replay bytes (plain or gzipped JSONL); return a FrameEncoder.
    Raises ValueError with a reason a person can read."""
    try:
        rep = loads_replay(bytes(data))
    except ReplayTooLarge as e:
        raise ValueError(f"it is over {MAX_REPLAY_BYTES // 2**20} MB once unpacked") from e
    except Exception as e:
        raise ValueError("it could not be read as a replay file") from e
    if not isinstance(rep, dict):
        raise ValueError("it could not be read as a replay file")
    check_replay(rep)
    return FrameEncoder(rep["seed"], rep["action_log"], replay=rep)


def encode_frames(seed, action_log, batch=50):
    """Yield header() then every batch. Joined, this is the whole PSRP file body."""
    enc = FrameEncoder(seed, action_log)
    yield enc.header()
    while (chunk := enc.next_batch(batch)) is not None:
        yield chunk
