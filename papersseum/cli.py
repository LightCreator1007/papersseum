"""The `papersseum` command-line tool for participants.

    papersseum play my_agent.py --vs greedy,safe_expander --seed 7 --render out.mp4
    papersseum validate my_agent.py
    papersseum render replay.json out.mp4
    papersseum version
"""

import argparse
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
        write_replay(args.save_replay, args.seed, result)
        print(f"wrote {args.save_replay}")
    return 0


def cmd_validate(args):
    # 1) static scan (same as the server runs on upload)
    report = scan_file(args.agent)
    if not report["ok"]:
        print("REJECTED by static scan:")
        for v in report["violations"]:
            print(f'  line {v["line"]}: {v["kind"]}: {v["detail"]}')
        return 1
    print("static scan: ok")

    # 2) load + smoke: run real decisions, surface crashes and slow calls
    try:
        AgentCls = load_agent_from_file(args.agent)
    except Exception as e:
        print(f"REJECTED: could not load Agent ({e})")
        return 1

    env = papersseum.PapersseumEnv(seed=args.seed)
    obs = env.reset()
    agent = AgentCls()
    cfg = {k: getattr(constants, k) for k in dir(constants) if k.isupper()}
    cfg.update(seed=args.seed, pid=0)
    try:
        agent.reset(cfg)
    except Exception as e:
        print(f"REJECTED: reset() raised ({e})")
        return 1

    max_ms = 0.0
    for _ in range(args.decisions):
        t = time.perf_counter()
        try:
            action = agent.act(obs[0])
        except Exception as e:
            print(f"REJECTED: act() raised ({e})")
            return 1
        max_ms = max(max_ms, (time.perf_counter() - t) * 1000.0)
        if action not in (0, 1, 2):
            print(f"REJECTED: act() returned {action!r}, must be 0, 1 or 2")
            return 1
        obs, _, done, _ = env.step({i: (action if i == 0 else 0) for i in range(constants.N_PLAYERS)})
        if done:
            break

    budget = constants.ACT_TIMEOUT_MS
    status = "ok" if max_ms <= budget else f"WARNING: slowest decision {max_ms:.1f} ms > {budget} ms budget"
    print(f"smoke match: {status} (slowest decision {max_ms:.1f} ms, budget {budget} ms)")
    print(f"engine {papersseum.ENGINE_HASH}")
    print("PASSED" if max_ms <= budget else "PASSED (but speed it up before submitting)")
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
    pl.add_argument("--save-replay", default=None, help="write a replay.json (seed + action log)")
    pl.set_defaults(func=cmd_play)

    va = sub.add_parser("validate", help="run the server's scan + a smoke match locally")
    va.add_argument("agent", help="path to your agent .py")
    va.add_argument("--seed", type=int, default=7)
    va.add_argument("--decisions", type=int, default=200, help="how many decisions to smoke-test")
    va.set_defaults(func=cmd_validate)

    ev = sub.add_parser("eval", help="benchmark your agent over many matches vs a baseline field")
    ev.add_argument("agent", help="path to your agent .py")
    ev.add_argument("--vs", default=None, help="comma-separated opponents (default: a varied field)")
    ev.add_argument("--games", type=int, default=20)
    ev.add_argument("--seed", type=int, default=0, help="first seed; games use seed..seed+games-1")
    ev.set_defaults(func=cmd_eval)

    rn = sub.add_parser("render", help="render an MP4 from a replay.json")
    rn.add_argument("replay", help="path to replay.json (seed + action_log)")
    rn.add_argument("out", help="output .mp4 path")
    rn.set_defaults(func=cmd_render)

    ve = sub.add_parser("version", help="print library and engine versions")
    ve.set_defaults(func=cmd_version)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
