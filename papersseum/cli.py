"""The `papersseum` command-line tool for participants.

    papersseum play my_agent.py --vs greedy,safe_expander --seed 7 --render out.mp4
    papersseum validate my_agent.py
    papersseum pack model.pt --into my_agent.py
    papersseum render replay.jsonl out.mp4
    papersseum version
"""

import argparse
import os
import sys
import time

import papersseum
from papersseum import constants
from papersseum.loader import load_agent_from_file
from papersseum.security.static_check import scan_file


def _names(scores):
    return sorted(scores, key=lambda s: -s["coverage"])


def cmd_play(args):
    vs = [v for v in args.vs.split(",") if v] if args.vs else None
    result = papersseum.play(args.agent, vs=vs, seed=args.seed, render=args.render)
    print(f"seed {args.seed}   engine {papersseum.ENGINE_HASH}")
    for rank, s in enumerate(_names(result["scores"]), 1):
        tag = "  <- you" if s["pid"] == 0 else ""
        print(f'  #{rank} slot{s["pid"]}  coverage={s["coverage"]:5.1f}%  deaths={s["deaths"]}{tag}')
    if args.render:
        print(f"wrote {args.render}")
    if args.save_replay:
        from papersseum.replay_io import write_replay
        write_replay(args.save_replay, args.seed, result, players=result["players"])
        print(f"wrote {args.save_replay}")
    return 0


def cmd_validate(args):
    """The same check the platform runs on upload: the static scan, then a full
    match with your agent in two seats against three baselines, each agent in its
    own process, under the same time rules (a bot that is late on more than 20% of
    decisions is rejected as too slow). Passing here means passing on upload."""
    from papersseum.sandbox import SubprocessBackend, validate_sandboxed

    report = scan_file(args.agent)
    if not report["ok"]:
        print("REJECTED by static scan:")
        for v in report["violations"]:
            print(f'  line {v["line"]}: {v["kind"]}: {v["detail"]}')
        return 1
    print("static scan: ok")

    what = f"{args.decisions} decisions" if args.decisions else "a full match"
    print(f"playing {what} (your agent x2 + greedy, safe_expander, hunter) ...")
    res = validate_sandboxed(args.agent, backend=SubprocessBackend(),
                             decisions=args.decisions or None, seed=args.seed)
    st = res["stats"]
    if not res["ok"]:
        print(f"REJECTED: {res['error']}")
        return 1
    for w in res["warnings"]:
        print(f"warning: {w}")
    print(f"smoke match: ok ({st['decisions']} decisions, slowest {st['max_ms']:.1f} ms, "
          f"budget {constants.ACT_TIMEOUT_MS} ms)")
    print(f"engine {papersseum.ENGINE_HASH}")
    print("PASSED")
    return 0


def cmd_eval(args):
    from papersseum.benchmark import evaluate
    vs = [v for v in args.vs.split(",") if v] if args.vs else None

    def progress(done, total):
        print(f"\r  playing {done}/{total} matches...", end="", flush=True)

    rep = evaluate(args.agent, vs=vs, games=args.games, seed0=args.seed, on_progress=progress)
    print("\r" + " " * 40 + "\r", end="")

    labels = ["1st", "2nd", "3rd", "4th", "5th"]
    print(f"papersseum eval   {args.agent}   {rep['games']} games   engine {papersseum.ENGINE_HASH}")
    print(f"field: {', '.join(rep['field'])}")
    hist = "  ".join(f"{labels[i]} {rep['placements'][i]}" for i in range(5))
    print(f"  placements   {hist}")
    print(f"  win rate     {rep['win_rate'] * 100:.0f}%")
    print(f"  coverage     mean {rep['coverage_mean']:.1f}%   best {rep['coverage_best']:.1f}%   worst {rep['coverage_worst']:.1f}%")
    print(f"  deaths       mean {rep['deaths_mean']:.1f}")
    print(f"  rating       {rep['rating_conservative']:.0f} conservative   ({rep['rating_elo']:.0f} elo vs this field)")
    print(f"  strength     {rep['strength']:.2f}  (batch Plackett-Luce, field sums to 5)")
    return 0


def cmd_render(args):
    from papersseum.render import render_replay_mp4
    from papersseum.replay_io import load_replay
    data = load_replay(args.replay)
    render_replay_mp4(data["seed"], data["action_log"], args.out)
    print(f"wrote {args.out} from seed {data['seed']}")
    return 0


def cmd_new(args):
    import os
    from papersseum.templates import STARTER_AGENT
    if os.path.exists(args.path) and not args.force:
        print(f"{args.path} already exists (use --force to overwrite)")
        return 1
    with open(args.path, "w") as fh:
        fh.write(STARTER_AGENT)
    print(f"wrote {args.path}")
    print(f"next:  papersseum validate {args.path}   then   papersseum eval {args.path}")
    return 0


def _load_tensors(path):
    """Read {name: ndarray} from .npz / .npy / .pt / .pth without unpickling anything."""
    import numpy as np
    ext = os.path.splitext(path)[1].lower()
    if ext == ".npz":
        with np.load(path, allow_pickle=False) as z:
            return {k: z[k] for k in z.files}
    if ext == ".npy":
        return {"weights": np.load(path, allow_pickle=False)}
    if ext in (".pt", ".pth"):
        try:
            import torch
        except ImportError:
            raise SystemExit("reading .pt/.pth files needs torch on THIS machine "
                             "(pip install torch); or save your state dict as .npz and pack that")
        obj = torch.load(path, map_location="cpu", weights_only=True)
        if isinstance(obj, dict) and isinstance(obj.get("state_dict"), dict):
            obj = obj["state_dict"]
        if not isinstance(obj, dict):
            raise SystemExit("expected a state dict (a dict of tensors); got " + type(obj).__name__)
        return {k: v.detach().cpu().numpy() for k, v in obj.items() if hasattr(v, "detach")}
    raise SystemExit(f"unsupported file type {ext!r}; use .npz, .npy, .pt or .pth")


def cmd_pack(args):
    from papersseum.security.static_check import MAX_BYTES
    from papersseum.weights import pack_weights, unpack_weights
    import re
    import numpy as np

    tensors = _load_tensors(args.weights)
    if not tensors:
        raise SystemExit("no tensors found in " + args.weights)
    blob = pack_weights(tensors, args.dtype)
    back = unpack_weights(blob)
    err = max((float(np.max(np.abs(back[k] - np.asarray(v, dtype=np.float32))))
               for k, v in tensors.items() if np.asarray(v).dtype.kind == "f" and np.asarray(v).size), default=0.0)
    params = sum(int(np.asarray(v).size) for v in tensors.values())
    print(f"{len(tensors)} tensors, {params:,} values, packed as {args.dtype}")
    for k, v in list(tensors.items())[:12]:
        print(f"  {k:32s} {str(tuple(np.asarray(v).shape)):18s}")
    if len(tensors) > 12:
        print(f"  ... and {len(tensors) - 12} more")
    print(f"blob: {len(blob):,} characters   largest rounding error: {err:.2e}")

    line = f'WEIGHTS = "{blob}"\n'
    if args.into:
        with open(args.into, encoding="utf-8") as fh:
            src = fh.read()
        if re.search(r"(?m)^WEIGHTS\s*=.*$", src):
            new = re.sub(r"(?m)^WEIGHTS\s*=.*$", lambda m: line.rstrip("\n"), src, count=1)
        else:
            new = src.rstrip("\n") + "\n\n" + line
        size = len(new.encode("utf-8"))
        if size > MAX_BYTES:
            print(f"ERROR: {args.into} would be {size:,} bytes; the limit is {MAX_BYTES:,}. "
                  "Try --dtype int8 or a smaller network. Nothing was written.")
            return 1
        with open(args.into, "w", encoding="utf-8") as fh:
            fh.write(new)
        print(f"wrote WEIGHTS into {args.into} ({size:,} of {MAX_BYTES:,} bytes)")
        print(f"next:  papersseum validate {args.into}")
    else:
        out = args.out or "weights_blob.py"
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(line)
        print(f"wrote {out} ({len(line):,} bytes); paste it into your agent file, or use --into")
    return 0


def cmd_version(args):
    print(f"papersseum {papersseum.__version__}")
    print(f"engine  {papersseum.ENGINE_HASH}")
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog="papersseum", description="Papersseum reference environment")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("play", help="play your agent against baselines")
    pl.add_argument("agent", help="path to your agent .py")
    pl.add_argument("--vs", default="greedy,safe_expander", help="comma-separated baseline names")
    pl.add_argument("--seed", type=int, default=7)
    pl.add_argument("--render", default=None, help="write an MP4 of the match")
    pl.add_argument("--save-replay", default=None, help="write a replay.jsonl (seed + action log, add .gz to compress)")
    pl.set_defaults(func=cmd_play)

    va = sub.add_parser("validate", help="run the platform's upload check locally (scan + full match)")
    va.add_argument("agent", help="path to your agent .py")
    va.add_argument("--seed", type=int, default=7)
    va.add_argument("--decisions", type=int, default=0, help="only play this many decisions (default: the full match)")
    va.set_defaults(func=cmd_validate)

    ev = sub.add_parser("eval", help="benchmark your agent over many matches vs a baseline field")
    ev.add_argument("agent", help="path to your agent .py")
    ev.add_argument("--vs", default=None, help="comma-separated opponents (default: a varied field)")
    ev.add_argument("--games", type=int, default=20)
    ev.add_argument("--seed", type=int, default=0, help="first seed; games use seed..seed+games-1")
    ev.set_defaults(func=cmd_eval)

    rn = sub.add_parser("render", help="render an MP4 from a replay.jsonl")
    rn.add_argument("replay", help="path to replay.jsonl (seed + action_log)")
    rn.add_argument("out", help="output .mp4 path")
    rn.set_defaults(func=cmd_render)

    nw = sub.add_parser("new", help="write a starter agent file")
    nw.add_argument("path", nargs="?", default="my_agent.py", help="output path (default my_agent.py)")
    nw.add_argument("--force", action="store_true", help="overwrite if it exists")
    nw.set_defaults(func=cmd_new)

    pk = sub.add_parser("pack", help="embed trained weights in your single-file agent")
    pk.add_argument("weights", help="trained weights: .npz, .npy, .pt or .pth (a state dict)")
    pk.add_argument("--into", default=None, help="agent .py to write WEIGHTS = \"...\" into")
    pk.add_argument("-o", "--out", default=None, help="without --into: write the line to this file (default weights_blob.py)")
    pk.add_argument("--dtype", choices=["float16", "int8", "float32"], default="float16",
                    help="float16 (default), int8 (smallest) or float32 (exact)")
    pk.set_defaults(func=cmd_pack)

    ve = sub.add_parser("version", help="print library and engine versions")
    ve.set_defaults(func=cmd_version)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
