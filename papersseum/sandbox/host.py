"""Runs inside the sandbox: loads one agent and answers decision requests.

    python -m papersseum.sandbox.host

The protocol channel is a private dup of the real stdin/stdout. Fds 0 and 1 are
then re-pointed (stdin to /dev/null, stdout to stderr), so an agent's print()
output can never corrupt the protocol or read it.
"""

import os
import sys
import time
import traceback


def _open_channel():
    rin = os.fdopen(os.dup(0), "rb", buffering=0)
    rout = os.fdopen(os.dup(1), "wb", buffering=0)
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, 0)
    os.dup2(2, 1)
    sys.stdin = open(os.devnull)
    sys.stdout = sys.stderr
    return rin, rout


def main():
    from papersseum.observation import observe
    from papersseum.loader import load_agent_from_file
    from papersseum.sandbox import protocol as P
    import papersseum.constants as C

    rin, rout = _open_channel()
    agent = None
    pid = 0
    while True:
        frame = P.read_frame(rin)
        if frame is None:
            return 0
        kind, body = frame
        if kind == b"Q":
            return 0
        if kind == b"I":
            import json
            msg = json.loads(body)
            pid = msg["config"]["pid"]
            try:
                agent = load_agent_from_file(msg["agent_path"])()
                agent.reset(msg["config"])
                P.write_frame(rout, b"R", {"ok": True})
            except BaseException as e:               # noqa: BLE001 - report everything
                P.write_frame(rout, b"R", {"ok": False, "error": f"{type(e).__name__}: {e}"[:300]})
                traceback.print_exc()
            continue
        if kind == b"S" and agent is not None:
            seq, state = P.decode_state(body)
            obs = observe(state, pid)
            err = None
            action = 0
            t = time.perf_counter()
            try:
                action = agent.act(obs)
            except BaseException as e:               # noqa: BLE001
                err = f"{type(e).__name__}: {e}"[:300]
                traceback.print_exc()
            ms = (time.perf_counter() - t) * 1000.0
            if err is None and (isinstance(action, bool) or action not in (0, 1, 2)):
                err = f"invalid action {action!r}"[:100]
            if err is not None:
                action = 0
            P.write_frame(rout, b"A", {"seq": seq, "a": int(action), "ms": round(ms, 2),
                                       **({"err": err} if err else {})})


if __name__ == "__main__":
    sys.exit(main())
