"""Render one real engine frame as light and dark SVGs for the home page.

    uv run --frozen python web/scripts/make_board.py web/public     (from the repo root)
"""
import sys
from pathlib import Path

from papersseum.agents import BASELINES
from papersseum.geometry import arena_mask
from papersseum.match import iter_frames, run_match

PLAYERS = ["#ff4d5e", "#4d9dff", "#35e07f", "#ffd23f", "#b36bff"]   # papersseum/render.py
THEMES = {
    "light": {"ground": "#efefec", "head": "#111111", "outline": "#ffffff"},
    "dark": {"ground": "#1f1f1f", "head": "#f5f5f5", "outline": "#111111"},
}
SEED, FRAME = 11, 1100


def svg(frame, mask, theme):
    h, w = frame["owner"].shape
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">']
    for r in range(h):
        c = 0
        while c < w:
            key = (frame["owner"][r, c], frame["trail"][r, c], mask[r, c])
            k = c
            while k < w and (frame["owner"][r, k], frame["trail"][r, k], mask[r, k]) == key:
                k += 1
            owner, trail, inside = key
            if inside:
                out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{theme["ground"]}"/>')
                if owner >= 0:
                    out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{PLAYERS[owner]}"/>')
                elif trail >= 0:
                    out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{PLAYERS[trail]}" opacity="0.45"/>')
            c = k
    for head in frame["heads"]:
        if head:
            out.append(f'<rect x="{head[1] - 1}" y="{head[0] - 1}" width="3" height="3" '
                       f'fill="{theme["head"]}" stroke="{theme["outline"]}" stroke-width="0.6"/>')
    out.append("</svg>")
    return "".join(out)


def main(out_dir):
    names = ["greedy", "safe_expander", "hunter", "greedy", "safe_expander"]
    result = run_match(SEED, [BASELINES[n]() for n in names])
    frame = list(iter_frames(SEED, result["action_log"]))[FRAME]
    mask = arena_mask()
    for name, theme in THEMES.items():
        Path(out_dir, f"board-{name}.svg").write_text(svg(frame, mask, theme))


if __name__ == "__main__":
    main(sys.argv[1])
