"""Record one real match for the animated home-page board.

    uv run --frozen python web/scripts/make_replay.py web/public/home-replay.dat   (from the repo root)

Writes gzip of the PSRP frame file from papersseum/frames.py (layout documented
there; read by web/lib/replay-format.ts). tests/test_frames.py fails when the
committed file no longer matches the engine.
"""
import gzip
import sys

from papersseum.agents import BASELINES
from papersseum.frames import encode_frames
from papersseum.match import run_match

SEED = 11                                                   # same match as board-*.svg
NAMES = ["greedy", "safe_expander", "hunter", "greedy", "safe_expander"]


def main(out_path):
    result = run_match(SEED, [BASELINES[n]() for n in NAMES])
    body = b"".join(encode_frames(SEED, result["action_log"]))
    with open(out_path, "wb") as fh:
        fh.write(gzip.compress(body, compresslevel=9, mtime=0))


if __name__ == "__main__":
    main(sys.argv[1])
