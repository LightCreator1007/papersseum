"""Trusted-side match runner: the engine runs here, each untrusted agent runs in
its own sandbox and is driven over pipes (see `protocol`).

    result = run_sandboxed_match(seed, ["a/agent.py", "b/agent.py", RandomAgent(), ...],
                                 backend=DockerBackend(image="papersseum-sandbox"))

A slot is either a path (file, or folder holding agent.py + weights), which is
sandboxed, or an Agent instance, which runs in-process (house bots only; never
pass untrusted code that way).

Per-decision rules: all sandboxed agents think in parallel. An answer whose
measured `act()` time exceeds ACT_TIMEOUT_MS counts as action 0 plus a strike;
an exception or invalid return is action 0 plus an error. An agent that exits or
sends nothing within `hard_timeout_s` is killed and plays action 0 for the rest
of the match.
"""

import itertools
import os
import queue
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time

import numpy as np

import papersseum.constants as C
from papersseum.engine import Engine
from papersseum.observation import observe
from papersseum.sandbox import protocol as P

RESET_TIMEOUT_S = 2.0
HARD_TIMEOUT_S = 1.0          # no answer at all within this => agent is dead
MATCH_TIMEOUT_S = 600.0


class MatchTimeout(RuntimeError):
    pass


# ---------------------------------------------------------------- backends

class _Proc:
    """A running host process plus how to kill it."""

    def __init__(self, popen, kill_extra=None):
        self.popen = popen
        self._kill_extra = kill_extra

    def kill(self):
        if self._kill_extra:
            try:
                self._kill_extra()
            except Exception:
                pass
        try:
            self.popen.kill()
        except Exception:
            pass
        try:
            self.popen.wait(timeout=5)
        except Exception:
            pass


class SubprocessBackend:
    """Plain child process with a clean environment and rlimits. NOT a security
    boundary: for development, tests and CI only. Use DockerBackend for real
    submissions."""

    mount_dir = None          # agent path is used as-is

    def spawn(self, name, src_dir, entry, cpu_seconds=MATCH_TIMEOUT_S):
        def limits():
            try:
                import resource
                resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
                resource.setrlimit(resource.RLIMIT_CPU, (int(cpu_seconds), int(cpu_seconds) + 5))
            except Exception:
                pass
            os.setsid()

        popen = subprocess.Popen(
            [sys.executable, "-m", "papersseum.sandbox.host"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            cwd=src_dir, env={"PYTHONHASHSEED": "0", "PATH": os.environ.get("PATH", "")},
            preexec_fn=limits if os.name == "posix" else None,
        )
        return _Proc(popen), os.path.join(src_dir, entry), src_dir


class DockerBackend:
    """One locked-down container per agent: no network, no capabilities, no
    environment, read-only root, 512 MB / 1 CPU / 64 pids, code mounted read-only."""

    def __init__(self, image="papersseum-sandbox", memory="512m", cpus="1", pids=64, docker="docker"):
        self.image, self.memory, self.cpus, self.pids, self.docker = image, memory, cpus, pids, docker

    def command(self, name, src_dir):
        return [
            self.docker, "run", "--rm", "-i", "--name", name,
            "--network", "none", "--memory", self.memory, "--memory-swap", self.memory,
            "--cpus", self.cpus, "--pids-limit", str(self.pids),
            "--read-only", "--tmpfs", "/tmp:rw,size=16m,noexec,nosuid",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--user", "65534:65534", "--ulimit", "core=0", "--ulimit", "nofile=256",
            "-v", f"{src_dir}:/agent:ro",
            self.image,
        ]

    def spawn(self, name, src_dir, entry, cpu_seconds=None):
        popen = subprocess.Popen(
            self.command(name, src_dir),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        kill = lambda: subprocess.run([self.docker, "kill", name], capture_output=True, timeout=10)
        return _Proc(popen, kill), f"/agent/{entry}", "/agent"


# ---------------------------------------------------------------- remote slot

class _Remote:
    def __init__(self, slot, proc, agent_path, weights_dir):
        self.slot, self.proc = slot, proc
        self.agent_path, self.weights_dir = agent_path, weights_dir
        self.q = queue.Queue()
        self.dead = False
        self.status = "ok"             # ok | reset_failed | crashed | unresponsive
        self.error = None
        self.strikes = 0
        self.errors = 0
        self.max_ms = 0.0
        self.first_errors = []
        self._t = threading.Thread(target=self._pump, daemon=True)
        self._t.start()

    def _pump(self):
        try:
            while True:
                fr = P.read_frame(self.proc.popen.stdout)
                if fr is None:
                    break
                self.q.put(fr)
        except Exception:
            pass
        self.q.put(None)

    def send(self, kind, body=b""):
        try:
            P.write_frame(self.proc.popen.stdin, kind, body)
            return True
        except (BrokenPipeError, OSError, ValueError):
            return False

    def get(self, timeout):
        try:
            return self.q.get(timeout=max(0.0, timeout))
        except queue.Empty:
            return "timeout"

    def die(self, status, error=None):
        self.dead = True
        if self.status == "ok":
            self.status = status
            self.error = error
        self.proc.kill()


def _stage(slot_spec, workdir):
    """Copy a submission into its own fresh folder; return (dir, entry name)."""
    d = tempfile.mkdtemp(prefix="slot", dir=workdir)
    if os.path.isdir(slot_spec):
        shutil.copytree(slot_spec, d, dirs_exist_ok=True)
        entry = "agent.py"
        if not os.path.exists(os.path.join(d, entry)):
            raise FileNotFoundError(f"{slot_spec!r} must contain agent.py")
    else:
        entry = "agent.py"
        shutil.copyfile(slot_spec, os.path.join(d, entry))
    for root, dirs, files in os.walk(d):          # readable by the unprivileged container user
        os.chmod(root, 0o755)
        for f in files:
            os.chmod(os.path.join(root, f), 0o644)
    return d, entry


_names = itertools.count()


def _config(seed, pid, weights_dir):
    cfg = {k: getattr(C, k) for k in dir(C) if k.isupper()}
    cfg.update(seed=seed, pid=pid, weights_dir=weights_dir)
    return cfg


# ---------------------------------------------------------------- the match

def run_sandboxed_match(seed, agents, backend=None, max_decisions=None, players=None,
                        act_timeout_ms=C.ACT_TIMEOUT_MS, reset_timeout_s=RESET_TIMEOUT_S,
                        hard_timeout_s=HARD_TIMEOUT_S, match_timeout_s=MATCH_TIMEOUT_S):
    """Run one match; see the module docstring. `agents` has N_PLAYERS entries.

    Returns the usual match result plus: `replay` (JSONL bytes), `engine_hash`,
    `numpy_version`, and `slots`: per-slot {kind, status, error, strikes, errors,
    max_ms}. Raises MatchTimeout if the whole match exceeds `match_timeout_s`.
    """
    from papersseum import ENGINE_HASH
    from papersseum.replay_io import dumps_replay
    if len(agents) != C.N_PLAYERS:
        raise ValueError(f"need {C.N_PLAYERS} agents, got {len(agents)}")
    backend = backend or SubprocessBackend()
    workdir = tempfile.mkdtemp(prefix="papersseum-")
    os.chmod(workdir, 0o755)
    remotes = {}
    local = {}
    t_start = time.monotonic()
    try:
        # ---- start every sandbox, then reset them all in parallel
        for slot, spec in enumerate(agents):
            if isinstance(spec, (str, os.PathLike)):
                src, entry = _stage(os.fspath(spec), workdir)
                name = f"papersseum-{os.getpid()}-{next(_names)}"
                try:
                    proc, apath, wdir = backend.spawn(name, src, entry, match_timeout_s)
                except Exception as e:
                    raise RuntimeError(f"could not start sandbox for slot {slot}: {e}") from e
                remotes[slot] = _Remote(slot, proc, apath, wdir)
            else:
                local[slot] = spec
        for slot, r in remotes.items():
            r.send(b"I", {"agent_path": r.agent_path, "config": _config(seed, slot, r.weights_dir)})
        deadline = time.monotonic() + reset_timeout_s
        for slot, r in remotes.items():
            fr = r.get(deadline - time.monotonic())
            if fr == "timeout":
                r.die("reset_failed", f"reset exceeded {reset_timeout_s}s")
            elif fr is None:
                r.die("reset_failed", "process exited during load/reset")
            else:
                import json
                msg = json.loads(fr[1])
                if not msg.get("ok"):
                    r.die("reset_failed", msg.get("error", "reset failed"))
        for slot, ag in local.items():
            ag.reset(_config(seed, slot, None))

        # ---- play
        eng = Engine(seed)
        action_log = []
        seq = 0
        limit = max_decisions if max_decisions is not None else 10 ** 9
        while not eng.is_over() and seq < limit:
            if time.monotonic() - t_start > match_timeout_s:
                raise MatchTimeout(f"match exceeded {match_timeout_s}s")
            st = eng.state
            body = P.encode_state(seq, st)
            waiting = []
            for slot, r in remotes.items():
                if r.dead:
                    continue
                if r.send(b"S", body):
                    waiting.append(r)
                else:
                    r.die("crashed", "process closed its input")
            actions = {s: 0 for s in range(C.N_PLAYERS)}
            for slot, ag in local.items():
                try:
                    a = ag.act(observe(st, slot))
                    actions[slot] = a if a in (0, 1, 2) else 0
                except Exception:
                    actions[slot] = 0
            deadline = time.monotonic() + hard_timeout_s
            for r in waiting:
                while True:
                    fr = r.get(deadline - time.monotonic())
                    if fr == "timeout":
                        r.die("unresponsive", f"no answer within {hard_timeout_s}s")
                        break
                    if fr is None:
                        r.die("crashed", "process exited")
                        break
                    if fr[0] != b"A":
                        continue
                    import json
                    msg = json.loads(fr[1])
                    if msg.get("seq") != seq:
                        continue
                    ms = float(msg.get("ms", 0.0))
                    r.max_ms = max(r.max_ms, ms)
                    if msg.get("err"):
                        r.errors += 1
                        if len(r.first_errors) < 3:
                            r.first_errors.append(msg["err"])
                    elif ms > act_timeout_ms:
                        r.strikes += 1
                    else:
                        actions[r.slot] = int(msg["a"])
                    break
            row = [actions[s] for s in range(C.N_PLAYERS)]
            action_log.append(row)
            for k in range(C.STEP_PER_DECISION):
                eng.advance_tick(actions if k == 0 else None)
            seq += 1

        result = {
            "seed": seed,
            "action_log": action_log,
            "scores": eng.scores(),
            "placements": eng.placements(),
            "final_owner": eng.state.owner.copy(),
            "engine_hash": ENGINE_HASH,
            "numpy_version": np.__version__,
            "slots": [
                {"kind": "sandbox", "status": remotes[s].status, "error": remotes[s].error,
                 "strikes": remotes[s].strikes, "errors": remotes[s].errors,
                 "max_ms": remotes[s].max_ms, "first_errors": remotes[s].first_errors}
                if s in remotes else
                {"kind": "local", "status": "ok", "error": None, "strikes": 0, "errors": 0,
                 "max_ms": 0.0, "first_errors": []}
                for s in range(C.N_PLAYERS)
            ],
        }
        result["replay"] = dumps_replay(seed, result, players)
        return result
    finally:
        for r in remotes.values():
            if not r.dead:
                r.send(b"Q")
            r.proc.kill()
        shutil.rmtree(workdir, ignore_errors=True)


# ---------------------------------------------------------------- validation

def validate_sandboxed(agent_file, backend=None, decisions=100, seed=7):
    """Static scan, then a short smoke match with the agent in slot 0 against
    four random house bots. Returns {ok, error, violations, warnings, stats}."""
    from papersseum.agents import RandomAgent
    from papersseum.security.static_check import scan_file

    report = scan_file(agent_file)
    if not report["ok"]:
        v = report["violations"][0]
        return {"ok": False, "error": f'line {v["line"]}: {v["detail"]}',
                "violations": report["violations"], "warnings": [], "stats": {}}
    try:
        res = run_sandboxed_match(seed, [agent_file] + [RandomAgent() for _ in range(C.N_PLAYERS - 1)],
                                  backend=backend, max_decisions=decisions)
    except Exception as e:
        return {"ok": False, "error": f"validation run failed: {e}", "violations": [],
                "warnings": [], "stats": {}}
    s = res["slots"][0]
    warnings = []
    error = None
    if s["status"] != "ok":
        error = {"reset_failed": f'reset() failed: {s["error"]}',
                 "crashed": "agent process crashed", "unresponsive": "agent stopped responding"}[s["status"]]
    elif s["errors"]:
        error = f'act() failed {s["errors"]} time(s): {s["first_errors"][0]}'
    if s["strikes"]:
        warnings.append(f'{s["strikes"]} decision(s) over the {C.ACT_TIMEOUT_MS} ms budget '
                        f'(slowest {s["max_ms"]:.1f} ms)')
    return {"ok": error is None, "error": error, "violations": [], "warnings": warnings,
            "stats": {"max_ms": s["max_ms"], "strikes": s["strikes"], "errors": s["errors"],
                      "decisions": len(res["action_log"])}}
