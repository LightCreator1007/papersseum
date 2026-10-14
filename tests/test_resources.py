"""Runs the code that ships with every chapter of the Learn course (resources/chapters/*/code).

Conventions (see resources/README.md):
  * check_*.py   verifies the numbers quoted in the lesson; run with no arguments.
  * other *.py   a runnable example; it must accept --fast (a tiny, quick, self-checking run).
  * a line "# requires: <module>" near the top skips the file when that module is missing.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

RESOURCES = Path(__file__).resolve().parent.parent / "resources"
SCRIPTS = sorted(RESOURCES.glob("chapters/*/code/[!_]*.py"))


def _skip_if_missing(script):
    head = "\n".join(script.read_text().splitlines()[:15])
    for module in re.findall(r"^#\s*requires:\s*(\w+)", head, flags=re.M):
        pytest.importorskip(module)


@pytest.mark.parametrize("script", SCRIPTS, ids=lambda p: f"{p.parent.parent.name}/{p.name}")
def test_chapter_code_runs(script):
    _skip_if_missing(script)
    args = [] if script.name.startswith("check_") else ["--fast"]
    out = subprocess.run([sys.executable, script.name, *args], cwd=script.parent,
                         capture_output=True, text=True, timeout=300)
    assert out.returncode == 0, out.stdout[-1500:] + out.stderr[-1500:]


def test_every_ready_chapter_has_its_numbers_checked():
    course = json.loads((RESOURCES / "course.json").read_text())
    for part in course["parts"]:
        for ch in part["chapters"]:
            if ch["status"] != "ready":
                continue
            code = RESOURCES / "chapters" / ch["slug"] / "code"
            assert (code / "check_numbers.py").exists(), f"{ch['slug']}: add code/check_numbers.py"


def test_there_is_chapter_code_to_test():
    assert SCRIPTS, "no chapter code found under resources/chapters/*/code"
