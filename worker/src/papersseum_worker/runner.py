"""Runs uploaded bots through the papersseum sandbox.

The engine runs in this process; every uploaded bot runs in its own sandbox
(see papersseum.sandbox). House bots run in-process, since they're our code.

SANDBOX_BACKEND picks the sandbox:
  docker      one locked-down container per bot. Use this for anything real.
  subprocess  a plain child process, NOT a security boundary. Fails closed:
              it only runs when PAPERSSEUM_UNSAFE_LOCAL=1 is set. Never set it
              on a worker connected to the production database.
"""
import gzip
import os
import subprocess

from papersseum.agents import BASELINES
from papersseum.sandbox import (DockerBackend, SubprocessBackend, run_sandboxed_match,
                                validate_sandboxed)

from papersseum_worker import config

SMOKE_DECISIONS = 200
UNSAFE_ENV = "PAPERSSEUM_UNSAFE_LOCAL"


class SandboxMissing(RuntimeError):
    """Raised instead of running uploaded code without a usable sandbox."""


def check_allowed():
    """Refuse to run uploaded code unless a real sandbox is configured, or the
    unsafe local mode is switched on."""
    if config.SANDBOX_BACKEND == "docker":
        return
    if config.SANDBOX_BACKEND != "subprocess":
        raise SandboxMissing(
            f"unknown SANDBOX_BACKEND {config.SANDBOX_BACKEND!r}; use 'docker' or 'subprocess'")
    if os.environ.get(UNSAFE_ENV) != "1":
        raise SandboxMissing(
            f"SANDBOX_BACKEND=subprocess does not isolate bots. Set {UNSAFE_ENV}=1 to run "
            "uploaded bots on your own machine; never set it on a worker connected to prod.")


def check_ready():
    """Startup check: the sandbox is allowed, and with Docker, the image exists
    and was built from the same engine as this worker."""
    check_allowed()
    if config.SANDBOX_BACKEND != "docker":
        return
    try:
        r = subprocess.run(
            [config.DOCKER, "run", "--rm", "--network", "none", "--entrypoint", "python",
             config.SANDBOX_IMAGE, "-c", "import papersseum; print(papersseum.ENGINE_HASH)"],
            capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise SandboxMissing(f"could not run docker: {e}") from e
    if r.returncode != 0:
        raise SandboxMissing(
            f"could not start sandbox image {config.SANDBOX_IMAGE!r} "
            f"(build it with docker/Dockerfile): {r.stderr.strip()[-300:]}")
    image_hash = r.stdout.strip()
    if image_hash != config.ENGINE_HASH:
        raise SandboxMissing(
            f"sandbox image engine {image_hash} != worker engine {config.ENGINE_HASH}; "
            "rebuild the image from this checkout")


def _backend():
    check_allowed()
    if config.SANDBOX_BACKEND == "docker":
        return DockerBackend(image=config.SANDBOX_IMAGE, docker=config.DOCKER)
    return SubprocessBackend()


def validate(path):
    """Static scan plus a short smoke match. -> {ok, error, violations}"""
    res = validate_sandboxed(path, backend=_backend(), decisions=SMOKE_DECISIONS)
    # validate_sandboxed reports a sandbox that wouldn't start (docker down, ...)
    # as a failed upload. That's our fault, not the uploader's: raise so the job
    # fails and gets retried instead of rejecting their bot.
    if not res["ok"] and (res["error"] or "").startswith("validation run failed"):
        raise SandboxMissing(res["error"])
    return {"ok": res["ok"], "error": res["error"], "violations": res["violations"]}


def play(seed, players):
    """players: 5 dicts with "slot", "bot_id", "submission_id" and either
    "path" or "builtin".
    -> scores, placements, action_log, strikes, crashed (plain Python types)
       and replay (gzipped JSONL bytes)"""
    players = sorted(players, key=lambda p: p["slot"])       # engine player id == slot
    uploaded = any(not p.get("builtin") for p in players)
    agents = [BASELINES[p["builtin"]]() if p.get("builtin") else p["path"] for p in players]
    header = [{"slot": p["slot"], "bot_id": p["bot_id"], "submission_id": p["submission_id"]}
              for p in players]

    # A house-bots-only match never starts a sandbox, so it needs no backend.
    result = run_sandboxed_match(seed, agents, backend=_backend() if uploaded else None,
                                 players=header)

    slots = result["slots"]
    return {
        "scores": [{"pid": int(s["pid"]), "coverage": float(s["coverage"]),
                    "time_avg_coverage": float(s["time_avg_coverage"]),
                    "deaths": int(s["deaths"])} for s in result["scores"]],
        "placements": [int(p) for p in result["placements"]],
        "action_log": [[int(a) for a in row] for row in result["action_log"]],
        "strikes": {i: s["strikes"] for i, s in enumerate(slots) if s["strikes"]},
        "crashed": {i: True for i, s in enumerate(slots) if s["status"] != "ok"},
        "replay": gzip.compress(result["replay"], mtime=0),
    }
