"""Submission-time static scan (a filter, not the security boundary).

Walks the submission's AST and rejects obvious escape routes: imports outside a
curated allowlist, dangerous builtins, `from x import *`, and introspection
dunders used to break out of the interpreter. This is the same check the server
runs on upload, shipped in the library so participants can run it locally.

The real isolation is the Docker sandbox on the match worker. An AST scan can be
defeated by a determined attacker; its job is to catch accidents and obvious
abuse early with a readable reason, before a submission ever reaches a sandbox.
"""

import ast

ALLOWED_IMPORTS = {
    "numpy", "math", "random", "itertools", "collections", "functools",
    "heapq", "bisect", "typing", "dataclasses", "enum", "json", "copy",
    "operator", "statistics", "array", "re", "string", "time", "abc",
    "fractions", "decimal", "numbers", "contextlib",
    "papersseum", "torch",
}

BANNED_CALLS = {
    "eval", "exec", "compile", "open", "__import__", "input", "breakpoint",
    "execfile", "globals", "locals",
}

BANNED_ATTRS = {
    "__subclasses__", "__globals__", "__code__", "__bases__", "__mro__",
    "__builtins__", "__reduce__", "__reduce_ex__", "__getattribute__",
}

MAX_BYTES = 2_000_000


def scan_source(src, filename="<submission>"):
    """Return {ok: bool, violations: [{line, kind, detail}]}."""
    violations = []
    if len(src.encode("utf-8", "ignore")) > MAX_BYTES:
        violations.append((0, "size", f"source exceeds {MAX_BYTES} bytes"))

    try:
        tree = ast.parse(src, filename)
    except SyntaxError as e:
        return {"ok": False, "violations": [{"line": e.lineno or 0, "kind": "syntax", "detail": str(e)}]}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                top = a.name.split(".")[0]
                if top not in ALLOWED_IMPORTS:
                    violations.append((node.lineno, "import", f"import '{a.name}' is not allowed"))
        elif isinstance(node, ast.ImportFrom):
            if node.names and node.names[0].name == "*":
                violations.append((node.lineno, "import", "'from ... import *' is not allowed"))
            top = (node.module or "").split(".")[0]
            if top and top not in ALLOWED_IMPORTS:
                violations.append((node.lineno, "import", f"import from '{node.module}' is not allowed"))
        elif isinstance(node, ast.Call):
            f = node.func
            if isinstance(f, ast.Name) and f.id in BANNED_CALLS:
                violations.append((node.lineno, "call", f"call to '{f.id}' is not allowed"))
        elif isinstance(node, ast.Attribute):
            if node.attr in BANNED_ATTRS:
                violations.append((node.lineno, "attr", f"attribute '{node.attr}' is not allowed"))
        elif isinstance(node, ast.Name):
            if node.id in BANNED_ATTRS:
                violations.append((node.lineno, "name", f"use of '{node.id}' is not allowed"))

    violations.sort(key=lambda v: (v[0], v[1]))
    return {"ok": not violations,
            "violations": [{"line": l, "kind": k, "detail": d} for l, k, d in violations]}


def scan_file(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        return scan_source(fh.read(), str(path))
