"""Numpy-only neural-network building blocks for running trained policies.

The sandbox has no torch (importing it is slow and the limits are tight), so
train with whatever you like and run the forward pass here. Everything works on
a single sample in PyTorch layouts, so a state dict maps straight across:

    conv2d(x, w, b)   x: (C, H, W)   w: (out, in, kh, kw)   -> (out, H', W')
    linear(x, w, b)   x: (in,)       w: (out, in)           -> (out,)

Example (a small policy over obs["local"], shape (16, 31, 31)):

    h = nn.relu(nn.conv2d(obs["local"], W["c1.weight"], W["c1.bias"], padding=1))
    h = nn.relu(nn.conv2d(h, W["c2.weight"], W["c2.bias"], stride=2, padding=1))
    logits = nn.linear(nn.global_avg_pool(h), W["fc.weight"], W["fc.bias"])
    action = int(np.argmax(logits))                       # 0 straight, 1 left, 2 right
"""

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


def relu(x):
    return np.maximum(x, 0)


def leaky_relu(x, slope=0.01):
    return np.where(x > 0, x, x * slope)


def tanh(x):
    return np.tanh(x)


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -60, 60)))


def softmax(x, axis=-1):
    z = x - np.max(x, axis=axis, keepdims=True)
    e = np.exp(z)
    return e / np.sum(e, axis=axis, keepdims=True)


def linear(x, w, b=None):
    y = w @ x
    return y if b is None else y + b


def _pad(x, padding, value=0.0):
    if not padding:
        return x
    return np.pad(x, ((0, 0), (padding, padding), (padding, padding)), constant_values=value)


def conv2d(x, w, b=None, stride=1, padding=0):
    """Cross-correlation like torch.nn.Conv2d (no dilation or groups)."""
    x = _pad(x, padding)
    kh, kw = w.shape[2], w.shape[3]
    win = sliding_window_view(x, (kh, kw), axis=(1, 2))[:, ::stride, ::stride]   # (C, oh, ow, kh, kw)
    y = np.tensordot(w, win, axes=([1, 2, 3], [0, 3, 4]))                        # (out, oh, ow)
    return y if b is None else y + b[:, None, None]


def max_pool2d(x, k, stride=None, padding=0):
    stride = stride or k
    x = _pad(x, padding, value=-np.inf)
    win = sliding_window_view(x, (k, k), axis=(1, 2))[:, ::stride, ::stride]
    return win.max(axis=(3, 4))


def avg_pool2d(x, k, stride=None):
    stride = stride or k
    win = sliding_window_view(x, (k, k), axis=(1, 2))[:, ::stride, ::stride]
    return win.mean(axis=(3, 4))


def global_avg_pool(x):
    return x.mean(axis=(1, 2))


def global_max_pool(x):
    return x.max(axis=(1, 2))


def flatten(x):
    return x.reshape(-1)


def batch_norm(x, mean, var, weight=None, bias=None, eps=1e-5):
    """Inference-mode BatchNorm2d on (C, H, W) using the running statistics."""
    y = (x - mean[:, None, None]) / np.sqrt(var[:, None, None] + eps)
    if weight is not None:
        y = y * weight[:, None, None]
    if bias is not None:
        y = y + bias[:, None, None]
    return y
