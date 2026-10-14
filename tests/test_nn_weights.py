import numpy as np
import pytest

import papersseum as p
from papersseum import nn


def _ref_conv(x, w, b, stride, pad):
    x = np.pad(x, ((0, 0), (pad, pad), (pad, pad)))
    O, I, kh, kw = w.shape
    _, H, W = x.shape
    oh, ow = (H - kh) // stride + 1, (W - kw) // stride + 1
    y = np.zeros((O, oh, ow))
    for o in range(O):
        for i in range(oh):
            for j in range(ow):
                y[o, i, j] = (x[:, i * stride:i * stride + kh, j * stride:j * stride + kw] * w[o]).sum()
                if b is not None:
                    y[o, i, j] += b[o]
    return y


@pytest.mark.parametrize("stride,pad", [(1, 0), (1, 1), (2, 1), (3, 2)])
def test_conv2d_matches_reference(stride, pad):
    rng = np.random.default_rng(stride * 10 + pad)
    x, w, b = rng.normal(size=(5, 13, 11)), rng.normal(size=(4, 5, 3, 3)), rng.normal(size=4)
    assert np.allclose(nn.conv2d(x, w, b, stride, pad), _ref_conv(x, w, b, stride, pad))
    assert np.allclose(nn.conv2d(x, w, None, stride, pad), _ref_conv(x, w, None, stride, pad))


def test_other_layers():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(3, 6, 6))
    assert nn.max_pool2d(x, 2).shape == (3, 3, 3) and np.isclose(nn.max_pool2d(x, 2)[0, 0, 0], x[0, :2, :2].max())
    assert np.isclose(nn.avg_pool2d(x, 2)[1, 2, 2], x[1, 4:6, 4:6].mean())
    assert nn.global_avg_pool(x).shape == (3,) and nn.global_max_pool(x).shape == (3,)
    assert nn.flatten(x).shape == (108,)
    s = nn.softmax(np.array([1.0, 2.0, 3.0]))
    assert np.isclose(s.sum(), 1.0) and s.argmax() == 2
    assert np.allclose(nn.linear(np.ones(3), np.eye(3) * 2, np.ones(3)), 3.0)
    bn = nn.batch_norm(x, np.zeros(3), np.ones(3), np.full(3, 2.0), np.full(3, 1.0), eps=0.0)
    assert np.allclose(bn, x * 2 + 1)


@pytest.mark.parametrize("dtype,tol", [("float32", 0), ("float16", 2e-3), ("int8", 2e-2)])
def test_pack_unpack_roundtrip(dtype, tol):
    rng = np.random.default_rng(1)
    arrays = {"c1.weight": rng.normal(size=(8, 4, 3, 3)).astype(np.float32),
              "fc.bias": rng.normal(size=3).astype(np.float32),
              "steps": np.arange(5, dtype=np.int64)}
    back = p.unpack_weights(p.pack_weights(arrays, dtype))
    assert set(back) == set(arrays)
    assert np.array_equal(back["steps"], arrays["steps"])
    for k in ("c1.weight", "fc.bias"):
        assert back[k].dtype == np.float32 and back[k].shape == arrays[k].shape
        assert np.max(np.abs(back[k] - arrays[k])) <= tol + 1e-9


def test_pack_sizes_and_validation():
    w = {"w": np.random.default_rng(0).normal(size=(100_000,)).astype(np.float32)}
    sizes = {d: len(p.pack_weights(w, d)) for d in ("float32", "float16", "int8")}
    assert sizes["int8"] < sizes["float16"] < sizes["float32"]
    with pytest.raises(ValueError):
        p.pack_weights(w, "bfloat16")
    with pytest.raises(ValueError):
        p.pack_weights({"a__scale__": np.zeros(2)})


def test_unpack_rejects_pickles_and_bombs():
    import base64, io, zipfile
    buf = io.BytesIO()
    np.savez(buf, a=np.array([object()], dtype=object))           # object arrays need pickle
    with pytest.raises(ValueError):
        p.unpack_weights(base64.b64encode(buf.getvalue()))
    bomb = io.BytesIO()
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("a.npy", b"\0" * (70 * 1024 * 1024))
    with pytest.raises(ValueError, match="64 MB"):
        p.unpack_weights(base64.b64encode(bomb.getvalue()))


def test_policy_runs_inside_the_time_budget():
    import time
    rng = np.random.default_rng(0)
    W = p.unpack_weights(p.pack_weights({
        "c1": rng.normal(size=(32, 16, 3, 3)) * .1, "c2": rng.normal(size=(64, 32, 3, 3)) * .1,
        "fc": rng.normal(size=(3, 64)) * .1}, "float16"))
    obs = p.PapersseumEnv(7).reset()[0]["local"]
    t = time.perf_counter()
    h = nn.relu(nn.conv2d(obs, W["c1"], padding=1))
    h = nn.relu(nn.conv2d(h, W["c2"], stride=2, padding=1))
    logits = nn.linear(nn.global_avg_pool(h), W["fc"])
    assert (time.perf_counter() - t) * 1000 < 50 and int(np.argmax(logits)) in (0, 1, 2)
