import subprocess
import numpy as np
import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.env import PapersseumEnv

PLAYER_COLORS = [(255, 77, 94), (77, 157, 255), (53, 224, 127),
                 (255, 210, 63), (179, 107, 255)]
_BG_IN = (18, 23, 32)        # neutral playable ground
_BG_OUT = (8, 10, 14)        # outside the arena
_RIM = (46, 56, 72)          # arena edge ring
_HEAD = (255, 255, 255)

# precomputed once: arena mask, its rim, and a radial vignette factor
_MASK = None
_RIM_MASK = None
_VIGNETTE = None


def _shift(a, dr, dc):
    out = np.zeros_like(a)
    h, w = a.shape
    sr0, sr1 = max(0, dr), min(h, h + dr)
    dr0, dr1 = max(0, -dr), min(h, h - dr)
    sc0, sc1 = max(0, dc), min(w, w + dc)
    dc0, dc1 = max(0, -dc), min(w, w - dc)
    out[dr0:dr1, dc0:dc1] = a[sr0:sr1, sc0:sc1]
    return out


def _interior(mask):
    """cells whose 4 neighbours are all inside `mask` (erosion)."""
    return mask & _shift(mask, 1, 0) & _shift(mask, -1, 0) & \
        _shift(mask, 0, 1) & _shift(mask, 0, -1)


def _ensure_statics(state):
    global _MASK, _RIM_MASK, _VIGNETTE
    if _MASK is not None and _MASK.shape == state.arena_mask.shape:
        return
    _MASK = state.arena_mask.copy()
    _RIM_MASK = _MASK & ~_interior(_MASK)
    cy, cx = C.ARENA_CENTER
    rr, cc = np.ogrid[0:C.MAP_H, 0:C.MAP_W]
    dist = np.sqrt((rr - cy) ** 2 + (cc - cx) ** 2) / C.ARENA_RADIUS
    _VIGNETTE = np.clip(1.0 - 0.35 * dist ** 2, 0.6, 1.0).astype(np.float32)


def _blend(color, factor):
    return (np.array(color, dtype=np.float32) * factor)


def frame_rgb(state):
    _ensure_statics(state)
    img = np.empty((C.MAP_H, C.MAP_W, 3), dtype=np.float32)
    img[:] = _BG_OUT
    img[state.arena_mask] = _BG_IN

    for pid in range(C.N_PLAYERS):
        owned = state.owner == pid
        if not owned.any():
            continue
        col = np.array(PLAYER_COLORS[pid], dtype=np.float32)
        img[owned] = col * 0.45                       # dim filled territory
        border = owned & ~_interior(owned)            # glowing outline
        img[border] = np.minimum(255.0, col * 1.0 + 30.0)

    for pid in range(C.N_PLAYERS):
        trail = state.trail == pid
        if trail.any():
            col = np.array(PLAYER_COLORS[pid], dtype=np.float32)
            img[trail] = np.minimum(255.0, col + (255.0 - col) * 0.55)

    # apply arena vignette before overlays
    img[state.arena_mask] *= _VIGNETTE[state.arena_mask][:, None]
    img[_RIM_MASK] = _RIM

    for p in state.players:
        if not p.alive:
            continue
        col = np.array(PLAYER_COLORS[p.pid], dtype=np.float32)
        r0, r1 = max(0, p.r - 2), min(C.MAP_H, p.r + 3)
        c0, c1 = max(0, p.c - 2), min(C.MAP_W, p.c + 3)
        img[r0:r1, c0:c1] = col                       # colored halo 5x5
        r0, r1 = max(0, p.r - 1), min(C.MAP_H, p.r + 2)
        c0, c1 = max(0, p.c - 1), min(C.MAP_W, p.c + 2)
        img[r0:r1, c0:c1] = _HEAD                      # white core 3x3

    return np.clip(img, 0, 255).astype(np.uint8)


def render_replay_gif(seed, action_log, path, stride=15):
    from PIL import Image
    env = PapersseumEnv(seed)
    obs = env.reset()
    frames = [Image.fromarray(frame_rgb(env.engine.state)).resize((480, 480), Image.NEAREST)]
    for i, row in enumerate(action_log):
        actions = {p: row[p] for p in range(C.N_PLAYERS)}
        obs, _, done, _ = env.step(actions)
        if i % stride == 0:
            frames.append(Image.fromarray(frame_rgb(env.engine.state)).resize((480, 480), Image.NEAREST))
        if done:
            break
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=60, loop=0)
    return path


def render_replay_mp4(seed, action_log, path, scale=5, ffmpeg="ffmpeg"):
    """Encode a real-time H.264 video: one video frame per engine tick at
    TICK_HZ fps, so the clip runs exactly MATCH_SECONDS long at 1x playback."""
    eng = Engine(seed)
    w = h = C.MAP_W * scale
    proc = subprocess.Popen(
        [ffmpeg, "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", str(C.TICK_HZ), "-i", "-",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
         "-movflags", "+faststart", path],
        stdin=subprocess.PIPE,
    )

    def emit():
        frame = frame_rgb(eng.state)
        big = np.repeat(np.repeat(frame, scale, axis=0), scale, axis=1)
        proc.stdin.write(big.tobytes())

    emit()  # opening frame
    for row in action_log:
        actions = {p: row[p] for p in range(C.N_PLAYERS)}
        for k in range(C.STEP_PER_DECISION):
            eng.advance_tick(actions if k == 0 else None)
            emit()
            if eng.is_over():
                break
        if eng.is_over():
            break
    proc.stdin.close()
    proc.wait()
    return path


def ascii_view(planes, step=1):
    """Collapse 16 observation channels into one char per cell, for debugging
    what an agent sees. `planes` is a (16, H, W) array (obs["local"] or
    obs["global"]). Legend: @ own head, M own land, t own trail, O opp land,
    ~ opp trail, X opp head, . empty, # wall."""
    import papersseum.channels as ch
    _, h, w = planes.shape
    opp_terr = [ch.opponent(i)["territory"] for i in range(ch.N_OPPONENTS)]
    opp_trail = [ch.opponent(i)["trail"] for i in range(ch.N_OPPONENTS)]
    opp_head = [ch.opponent(i)["head"] for i in range(ch.N_OPPONENTS)]
    rows = []
    for r in range(0, h, step):
        line = []
        for c in range(0, w, step):
            if planes[ch.ARENA_MASK, r, c] < 0.5:
                line.append("#")
            elif planes[ch.OWN_HEAD, r, c] > 0.5:
                line.append("@")
            elif any(planes[k, r, c] > 0.5 for k in opp_head):
                line.append("X")
            elif planes[ch.OWN_TRAIL, r, c] > 0.5:
                line.append("t")
            elif any(planes[k, r, c] > 0.5 for k in opp_trail):
                line.append("~")
            elif planes[ch.OWN_TERRITORY, r, c] > 0.5:
                line.append("M")
            elif any(planes[k, r, c] > 0.5 for k in opp_terr):
                line.append("O")
            else:
                line.append(".")
        rows.append("".join(line))
    return "\n".join(rows)


def ascii_obs(obs, which="local", step=1):
    """ASCII of obs["local"] or obs["global"]. See ascii_view for the legend."""
    return ascii_view(obs[which], step=step)


def ascii_frame(state, step=4):
    rows = []
    for r in range(0, C.MAP_H, step):
        line = []
        for c in range(0, C.MAP_W, step):
            if not state.arena_mask[r, c]:
                line.append("#")
            elif any(p.alive and p.r // step == r // step and p.c // step == c // step for p in state.players):
                line.append("@")
            elif state.trail[r, c] >= 0:
                line.append(chr(ord("a") + state.trail[r, c]))
            elif state.owner[r, c] >= 0:
                line.append(str(state.owner[r, c]))
            else:
                line.append(".")
        rows.append("".join(line))
    return "\n".join(rows)
