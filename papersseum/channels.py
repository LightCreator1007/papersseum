"""Named indices into the 16-channel observation planes.

Both the local `(16, 31, 31)` and global `(16, 120, 120)` views use this layout,
built from the acting agent's point of view. Use these names instead of magic
numbers:

    from papersseum import channels as ch
    on_own_land = obs["local"][ch.OWN_TERRITORY, 15, 15] > 0.5
    opp0_head   = obs["local"][ch.opponent(0)["head"]]
"""

CHANNELS = 16

OWN_TERRITORY = 0
OWN_TRAIL = 1
OWN_HEAD = 2
ARENA_MASK = 15

N_OPPONENTS = 4


def opponent(i):
    """Channel indices for opponent i (0..3), in fixed slot order for the match."""
    if not 0 <= i < N_OPPONENTS:
        raise IndexError(f"opponent index {i} out of range 0..{N_OPPONENTS - 1}")
    base = 3 + i * 3
    return {"territory": base, "trail": base + 1, "head": base + 2}


OPPONENTS = [opponent(i) for i in range(N_OPPONENTS)]

# human-readable label per channel index, handy for debugging
LABELS = {
    OWN_TERRITORY: "own territory",
    OWN_TRAIL: "own trail",
    OWN_HEAD: "own head",
    ARENA_MASK: "arena mask",
}
for _i in range(N_OPPONENTS):
    _o = opponent(_i)
    LABELS[_o["territory"]] = f"opponent {_i} territory"
    LABELS[_o["trail"]] = f"opponent {_i} trail"
    LABELS[_o["head"]] = f"opponent {_i} head"
