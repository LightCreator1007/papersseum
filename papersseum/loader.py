"""Load a participant's Agent class from a .py file.

Used by the CLI and `papersseum.play`. Loading runs the file's top-level code, so
on the server this only ever happens inside the sandbox. Locally it runs in your
own interpreter, which is fine for your own agent.
"""

import importlib.util


def load_agent_from_file(path):
    """Import `path` and return its `Agent` class. Raises if missing."""
    spec = importlib.util.spec_from_file_location("papersseum_submission", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"could not load a module from {path!r}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "Agent"):
        raise AttributeError(f"{path!r} must define a class named 'Agent'")
    return module.Agent
