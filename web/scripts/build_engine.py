"""Build the engine the web replay viewer runs in Pyodide, plus its test fixture.

    uv run --frozen python web/scripts/build_engine.py      (from the repo root)

Writes web/public/engine/<wheel> and manifest.json (served to the browser) and
web/tests/fixtures/match.jsonl.gz (a natively recorded match the Pyodide test
must reproduce). Rerun after any change under papersseum/; tests/test_web_engine.py
fails until you do.
"""
import json
import pathlib
import shutil
import subprocess
import tempfile

import papersseum
from papersseum.agents import BASELINES
from papersseum.match import run_match
from papersseum.replay_io import write_replay

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "engine"
FIXTURE = ROOT / "web" / "tests" / "fixtures" / "match.jsonl.gz"
FIXTURE_SEED = 7
FIXTURE_NAMES = ["greedy", "hunter", "safe_expander", "hunter", "greedy"]


def build_wheel():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["uv", "build", "--wheel", "--package", "papersseum", "--out-dir", tmp],
                       cwd=ROOT, check=True)
        (wheel,) = pathlib.Path(tmp).glob("papersseum-*.whl")
        OUT.mkdir(parents=True, exist_ok=True)
        for old in OUT.glob("*.whl"):
            old.unlink()
        shutil.copy(wheel, OUT / wheel.name)
    manifest = {"wheel": wheel.name, "engine_hash": papersseum.ENGINE_HASH, "version": papersseum.__version__}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {OUT / wheel.name} ({papersseum.ENGINE_HASH})")


def write_fixture():
    result = run_match(FIXTURE_SEED, [BASELINES[n]() for n in FIXTURE_NAMES])
    players = [{"slot": i, "bot_name": n} for i, n in enumerate(FIXTURE_NAMES)]
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    write_replay(str(FIXTURE), FIXTURE_SEED, result, players)
    print(f"wrote {FIXTURE}")


if __name__ == "__main__":
    build_wheel()
    write_fixture()
