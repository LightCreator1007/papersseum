import gzip
import json
import pathlib
import struct

import numpy as np
import pytest

import papersseum
from papersseum.agents import BASELINES
from papersseum.frames import (
    MAX_DECISIONS, FrameEncoder, cell_bytes, check_replay, encode_frames, open_replay,
)
from papersseum.geometry import arena_mask
from papersseum.match import iter_frames, replay_match, run_match
from papersseum.replay_io import dumps_replay

ROOT = pathlib.Path(__file__).resolve().parents[1]
HOME_SEED = 11                                               # web/scripts/make_replay.py
HOME_NAMES = ["greedy", "safe_expander", "hunter", "greedy", "safe_expander"]
DIFF = np.dtype([("index", "<u2"), ("value", "u1")])


@pytest.fixture(scope="module")
def home_log():
    return run_match(HOME_SEED, [BASELINES[n]() for n in HOME_NAMES])["action_log"]


def decode(body):
    """Minimal PSRP v1 reader: [(cells, heads)] per frame."""
    assert body[:4] == b"PSRP" and body[4] == 1
    height, width, frames, players = struct.unpack_from("<HHHB", body, 5)
    off = 12
    cells = np.frombuffer(body, np.uint8, height * width, off).copy()
    off += height * width
    out = []
    for f in range(frames):
        heads = [tuple(body[off + 2 * p:off + 2 * p + 2]) for p in range(players)]
        off += 2 * players
        if f:
            (n,) = struct.unpack_from("<H", body, off)
            off += 2
            diffs = np.frombuffer(body, DIFF, n, off)
            off += 3 * n
            cells[diffs["index"]] = diffs["value"]
        out.append((cells.copy(), [None if h == (255, 255) else h for h in heads]))
    assert off == len(body)
    return out


def test_frames_round_trip_against_iter_frames(home_log):
    log = home_log[:120]
    body = b"".join(encode_frames(HOME_SEED, log, batch=7))   # uneven batches on purpose
    decoded = decode(body)
    mask = arena_mask()
    expected = list(iter_frames(HOME_SEED, log))
    assert len(decoded) == len(expected) == len(log) + 1
    for (cells, heads), frame in zip(decoded, expected):
        assert np.array_equal(cells, cell_bytes(frame["owner"], frame["trail"], mask))
        assert heads == frame["heads"]


def test_result_equals_replay_match(home_log):
    enc = FrameEncoder(HOME_SEED, home_log)
    enc.header()
    while enc.next_batch(50) is not None:
        pass
    again = replay_match(HOME_SEED, home_log)
    assert enc.result()["placements"] == again["placements"]
    assert [s["coverage"] for s in enc.result()["scores"]] == [s["coverage"] for s in again["scores"]]
    json.loads(enc.result_json())                            # plain JSON types only


def test_result_and_batches_need_the_right_order(home_log):
    enc = FrameEncoder(HOME_SEED, home_log[:5])
    with pytest.raises(RuntimeError):
        enc.next_batch()
    enc.header()
    with pytest.raises(RuntimeError):
        enc.result()


def test_home_replay_is_current(home_log):
    body = b"".join(encode_frames(HOME_SEED, home_log))
    committed = gzip.decompress((ROOT / "web/public/home-replay.dat").read_bytes())
    assert body == committed, "regenerate: uv run --frozen python web/scripts/make_replay.py web/public/home-replay.dat"


GOOD_ROW = [0, 1, 2, 0, 1]


@pytest.mark.parametrize("rep, reason", [
    ({"seed": "7", "action_log": [GOOD_ROW]}, "seed"),
    ({"seed": -1, "action_log": [GOOD_ROW]}, "seed"),
    ({"seed": True, "action_log": [GOOD_ROW]}, "seed"),
    ({"seed": 7, "action_log": []}, "no moves"),
    ({"seed": 7}, "no moves"),
    ({"seed": 7, "action_log": [GOOD_ROW] * (MAX_DECISIONS + 1)}, "at most 1800"),
    ({"seed": 7, "action_log": [[0, 1, 2, 0]]}, "decision 1"),
    ({"seed": 7, "action_log": [GOOD_ROW, [0, 1, 2, 0, 3]]}, "decision 2"),
    ({"seed": 7, "action_log": [[0, 1, 2, 0, 1.0]]}, "decision 1"),
    ({"seed": 7, "action_log": ["01201"]}, "decision 1"),
])
def test_check_replay_rejects(rep, reason):
    with pytest.raises(ValueError, match=reason):
        check_replay(rep)


def test_check_replay_accepts_a_full_match(home_log):
    check_replay({"seed": HOME_SEED, "action_log": home_log})


def test_open_replay_reads_plain_and_gzipped(home_log):
    log = home_log[:30]
    result = replay_match(HOME_SEED, log)
    players = [{"slot": i, "bot_name": n} for i, n in enumerate(HOME_NAMES)]
    data = dumps_replay(HOME_SEED, result, players)
    for raw in (data, gzip.compress(data)):
        meta = json.loads(open_replay(raw).meta_json())
        assert meta["seed"] == HOME_SEED
        assert meta["frames"] == 31
        assert meta["engineHash"] == meta["shippedHash"] == papersseum.ENGINE_HASH
        assert meta["players"][2]["bot_name"] == "hunter"
        assert meta["recorded"]["placements"] == result["placements"]


def test_open_replay_legacy_file_has_no_recorded_result():
    raw = json.dumps({"seed": 3, "action_log": [GOOD_ROW] * 4}).encode()
    meta = json.loads(open_replay(raw).meta_json())
    assert meta["recorded"] is None and meta["engineHash"] is None and meta["players"] == []


@pytest.mark.parametrize("raw", [b"hello", b"\x1f\x8b not gzip", b"[1,2,3]\n", b""])
def test_open_replay_refuses_non_replays(raw):
    with pytest.raises(ValueError, match="could not be read as a replay file|no moves"):
        open_replay(raw)


def test_open_replay_runs_check_replay():
    raw = b'{"type":"header","seed":1}\n[0,1,2,0,3]\n'
    with pytest.raises(ValueError, match="decision 1 is not 5 moves of 0, 1 or 2"):
        open_replay(raw)
