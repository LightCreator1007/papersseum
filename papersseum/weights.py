"""Safe weight loading for agents.

    weights = load_weights(config, "policy.npy")     # inside Agent.reset

Reads a file from the agent's own folder (`config["weights_dir"]`). `.npy` and
`.npz` load with pickling disabled; `.pt`/`.pth` load with torch's
`weights_only=True`. The static scan bans raw `numpy.load` / `torch.load`, so
this is the supported route.
"""

import os


def load_weights(config, name):
    base = config.get("weights_dir")
    if not base:
        raise FileNotFoundError("no weights_dir in config; run the agent from a file")
    path = os.path.normpath(os.path.join(base, name))
    if os.path.commonpath([os.path.abspath(base), os.path.abspath(path)]) != os.path.abspath(base):
        raise ValueError(f"{name!r} escapes the agent folder")
    ext = os.path.splitext(path)[1].lower()
    if ext in (".npy", ".npz"):
        import numpy as np
        return np.load(path, allow_pickle=False)
    if ext in (".pt", ".pth"):
        import torch
        return torch.load(path, map_location="cpu", weights_only=True)
    raise ValueError(f"unsupported weights file type {ext!r} (use .npy, .npz, .pt, .pth)")
