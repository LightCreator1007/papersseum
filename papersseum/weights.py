"""Weights for single-file submissions.

The platform accepts one `.py` file (at most 1 MB), so trained weights have to
travel inside it as a string. Train anywhere with any framework, then:

    papersseum pack model.pt --into my_agent.py        # writes WEIGHTS = "..." into your agent

and in the agent:

    from papersseum import unpack_weights
    W = unpack_weights(WEIGHTS)                         # {"conv1.weight": ndarray, ...}

`pack_weights` / `unpack_weights` use a compressed numpy archive with pickling
disabled, so a blob can hold arrays and nothing else. `load_weights` reads a
file from the agent's own folder and exists only for local experiments: the
platform has no such folder.
"""

import base64
import io
import os
import zipfile

import numpy as np

_SCALE = "__scale__"
MAX_UNPACKED_BYTES = 64 * 1024 * 1024        # refuse blobs that inflate to more than this
DTYPES = ("float32", "float16", "int8")


def pack_weights(arrays, dtype="float16"):
    """Pack {name: array} into one base64 string.

    dtype "float16" halves the size and is accurate enough for most policies;
    "int8" quarters it (per-tensor scale; check your agent still plays well);
    "float32" is exact. Integer and boolean arrays are stored as they are.
    """
    if dtype not in DTYPES:
        raise ValueError(f"dtype must be one of {DTYPES}, got {dtype!r}")
    out = {}
    for name, a in arrays.items():
        if _SCALE in name:
            raise ValueError(f"tensor name may not contain {_SCALE!r}: {name!r}")
        a = np.asarray(a)
        if a.dtype.kind != "f":
            out[name] = a
        elif dtype == "float32":
            out[name] = a.astype(np.float32)
        elif dtype == "float16":
            out[name] = a.astype(np.float16)
        else:
            peak = float(np.max(np.abs(a))) if a.size else 0.0
            scale = peak / 127.0 if peak > 0 else 1.0
            out[name] = np.clip(np.round(a / scale), -127, 127).astype(np.int8)
            out[name + _SCALE] = np.asarray(scale, dtype=np.float32)
    buf = io.BytesIO()
    np.savez_compressed(buf, **out)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def unpack_weights(blob):
    """Inverse of pack_weights: returns {name: ndarray}, floats as float32."""
    raw = base64.b64decode(blob)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if sum(i.file_size for i in z.infolist()) > MAX_UNPACKED_BYTES:
            raise ValueError("weights blob inflates to more than 64 MB")
    with np.load(io.BytesIO(raw), allow_pickle=False) as npz:
        data = {k: npz[k] for k in npz.files}
    out = {}
    for name, a in data.items():
        if name.endswith(_SCALE):
            continue
        if name + _SCALE in data:
            a = a.astype(np.float32) * data[name + _SCALE]
        elif a.dtype.kind == "f":
            a = a.astype(np.float32)
        out[name] = a
    return out


def load_weights(config, name):
    """Local experiments only: read a weights file from the agent's own folder.
    Not available on the platform (use pack_weights / unpack_weights there)."""
    base = config.get("weights_dir")
    if not base:
        raise FileNotFoundError("no weights_dir in config; run the agent from a file")
    path = os.path.normpath(os.path.join(base, name))
    if os.path.commonpath([os.path.abspath(base), os.path.abspath(path)]) != os.path.abspath(base):
        raise ValueError(f"{name!r} escapes the agent folder")
    ext = os.path.splitext(path)[1].lower()
    if ext in (".npy", ".npz"):
        return np.load(path, allow_pickle=False)
    if ext in (".pt", ".pth"):
        import torch
        return torch.load(path, map_location="cpu", weights_only=True)
    raise ValueError(f"unsupported weights file type {ext!r} (use .npy, .npz, .pt, .pth)")
