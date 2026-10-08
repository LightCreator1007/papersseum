"""Wire format between the trusted runner and the sandboxed agent host.

Every message is `4-byte big-endian length | 1-byte type | body`.

runner -> host:   I  init     JSON {agent_path, config}
                  S  state    binary snapshot (see encode_state)
                  Q  quit
host   -> runner: R  ready    JSON {ok: bool, error?: str}
                  A  action   JSON {seq, a, ms, err?}

The state message carries only what the engine owns: int8 owner and trail
arrays plus a few ints per player (about 29 KB). The host rebuilds the full
observation locally, so the large float planes never cross the pipe.
"""

import json
import struct

import numpy as np

import papersseum.constants as C

_LEN = struct.Struct(">I")
_HEAD = struct.Struct("<II")                       # seq, tick
_PLAYER_FIELDS = 7                                 # alive r c heading boost respawn deaths
_CELLS = C.MAP_H * C.MAP_W
MAX_FRAME = 1 << 20


def write_frame(fh, kind, body=b""):
    if isinstance(body, (dict, list)):
        body = json.dumps(body, separators=(",", ":")).encode()
    fh.write(_LEN.pack(len(body) + 1) + kind + body)
    fh.flush()


def _read_exact(fh, n):
    buf = b""
    while len(buf) < n:
        chunk = fh.read(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def read_frame(fh):
    """Return (kind, body) or None on EOF. Rejects oversized frames."""
    head = _read_exact(fh, 4)
    if head is None:
        return None
    (n,) = _LEN.unpack(head)
    if n < 1 or n > MAX_FRAME:
        raise ValueError(f"bad frame length {n}")
    data = _read_exact(fh, n)
    if data is None:
        return None
    return data[:1], data[1:]


def encode_state(seq, state):
    players = np.array(
        [[int(p.alive), p.r, p.c, p.heading, p.boost_timer, p.respawn_timer, p.deaths]
         for p in state.players], dtype=np.int32)
    return (_HEAD.pack(seq, state.tick) + players.tobytes()
            + state.owner.tobytes() + state.trail.tobytes())


def decode_state(body):
    """Rebuild a GameState good enough for `observe()` from a state message."""
    from papersseum.geometry import arena_mask
    from papersseum.state import GameState, Player, recount_areas
    seq, tick = _HEAD.unpack_from(body, 0)
    off = _HEAD.size
    n = C.N_PLAYERS * _PLAYER_FIELDS
    rows = np.frombuffer(body, dtype=np.int32, count=n, offset=off).reshape(C.N_PLAYERS, -1)
    off += n * 4
    owner = np.frombuffer(body, dtype=np.int8, count=_CELLS, offset=off).reshape(C.MAP_H, C.MAP_W).copy()
    off += _CELLS
    trail = np.frombuffer(body, dtype=np.int8, count=_CELLS, offset=off).reshape(C.MAP_H, C.MAP_W).copy()
    mask = arena_mask()
    players = []
    for pid, (alive, r, c, heading, boost, respawn, deaths) in enumerate(rows.tolist()):
        players.append(Player(pid=pid, alive=bool(alive), r=r, c=c, heading=heading,
                              desired_heading=heading, boost_timer=boost,
                              respawn_timer=respawn, deaths=deaths))
    st = GameState(owner=owner, trail=trail, arena_mask=mask, players=players, tick=tick,
                   rng=None, area=[0] * C.N_PLAYERS, cov_sum=[0.0] * C.N_PLAYERS,
                   playable_count=int(mask.sum()))
    recount_areas(st)
    return seq, st
