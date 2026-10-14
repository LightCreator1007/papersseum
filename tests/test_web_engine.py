"""The web replay viewer's committed engine wheel and test fixture match the source.

Fix any failure here with:  uv run --frozen python web/scripts/build_engine.py
"""
import json
import pathlib
import zipfile

import papersseum
from papersseum.match import replay_match
from papersseum.replay_io import load_replay

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENGINE = ROOT / "web" / "public" / "engine"
FIXTURE = ROOT / "web" / "lib" / "fixtures" / "match.jsonl.gz"
HINT = "rebuild with: uv run --frozen python web/scripts/build_engine.py"


def manifest():
    return json.loads((ENGINE / "manifest.json").read_text())


def test_manifest_matches_the_engine():
    m = manifest()
    assert m["engine_hash"] == papersseum.ENGINE_HASH, HINT
    assert m["version"] == papersseum.__version__, HINT
    assert sorted(p.name for p in ENGINE.glob("*.whl")) == [m["wheel"]], HINT


def test_wheel_sources_match_the_repo():
    repo = {p.relative_to(ROOT).as_posix(): p.read_bytes() for p in (ROOT / "papersseum").rglob("*.py")}
    with zipfile.ZipFile(ENGINE / manifest()["wheel"]) as z:
        wheel = {n: z.read(n) for n in z.namelist() if n.startswith("papersseum/") and n.endswith(".py")}
    assert sorted(wheel) == sorted(repo), HINT
    changed = sorted(n for n in repo if wheel[n] != repo[n])
    assert not changed, f"{changed} differ from the wheel; {HINT}"


def test_fixture_replays_to_its_recorded_result():
    rep = load_replay(str(FIXTURE))
    assert rep["engine_hash"] == papersseum.ENGINE_HASH, HINT
    again = replay_match(rep["seed"], rep["action_log"])
    assert again["placements"] == rep["placements"], HINT
    assert [s["coverage"] for s in again["scores"]] == [s["coverage"] for s in rep["scores"]], HINT
