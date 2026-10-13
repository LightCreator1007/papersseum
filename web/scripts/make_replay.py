"""Record one real match for the animated home-page board.

    uv run --frozen python web/scripts/make_replay.py web/public/home-replay.dat   (from the repo root)

Writes gzip of: b"PSRP", u8 version=1, u16 height, u16 width, u16 frames,
u8 players, then height*width bytes (first frame's cells), then per frame:
players*(u8 row, u8 col) heads (255,255 = dead) and, for every frame after the
first, u16 n plus n*(u16 cell index, u8 value). Little-endian.
Cell byte: 0xFE outside the arena, 0xFF empty, else low nibble = owner
(0-4, 15 none), high nibble = trail (0-4, 15 none). See web/lib/replay-format.ts.
"""
import gzip
import struct
import sys

import numpy as np

from papersseum.agents import BASELINES
from papersseum.geometry import arena_mask
from papersseum.match import iter_frames, run_match

SEED = 11                                                   # same match as board-*.svg
NAMES = ["greedy", "safe_expander", "hunter", "greedy", "safe_expander"]


def cells(frame, mask):
    owner = frame["owner"].astype(np.int16)
    trail = frame["trail"].astype(np.int16)
    value = np.where(owner >= 0, owner, 15) | (np.where(trail >= 0, trail, 15) << 4)
    return np.where(mask, value, 0xFE).astype(np.uint8).ravel()


def main(out_path):
    result = run_match(SEED, [BASELINES[n]() for n in NAMES])
    frames = list(iter_frames(SEED, result["action_log"]))
    mask = arena_mask()
    height, width = frames[0]["owner"].shape
    players = len(frames[0]["heads"])

    out = bytearray(b"PSRP")
    out += struct.pack("<BHHHB", 1, height, width, len(frames), players)
    prev = cells(frames[0], mask)
    out += prev.tobytes()
    for i, frame in enumerate(frames):
        for head in frame["heads"]:
            out += struct.pack("<BB", *(head if head else (255, 255)))
        if i == 0:
            continue
        cur = cells(frame, mask)
        changed = np.flatnonzero(cur != prev)
        out += struct.pack("<H", len(changed))
        for index in changed:
            out += struct.pack("<HB", int(index), int(cur[index]))
        prev = cur
    with open(out_path, "wb") as fh:
        fh.write(gzip.compress(bytes(out), compresslevel=9, mtime=0))


if __name__ == "__main__":
    main(sys.argv[1])
