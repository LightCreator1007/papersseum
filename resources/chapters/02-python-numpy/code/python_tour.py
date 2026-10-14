"""Chapter 2: Python in ten minutes, then NumPy. Every snippet from the lesson, runnable.

Run it:
    python python_tour.py            # print everything
    python python_tour.py --fast     # the same, checking itself (for tests)

Needs only numpy.
"""

import sys

import numpy as np


# ---------------------------------------------------------------- plain Python

def variables_and_lists():
    reward = 1
    rewards = [1, 0, 1, 1, 0]
    total = sum(rewards)
    average = total / len(rewards)
    print("total", total, "average", average)
    return reward, rewards, total, average


def loops_and_ifs(rewards):
    total = 0
    for r in rewards:
        total += r
    print("total from a loop:", total)

    words = []
    for r in rewards:
        if r == 1:
            words.append("win")
        else:
            words.append("lose")
    print(words)
    return total, words


def average(values):
    """A function: give it a list, get the average back."""
    return sum(values) / len(values)


def dictionaries():
    q = {"A": 0.6, "B": 0.4}  # a dictionary: names and their values
    best = max(q, key=q.get)
    print("best machine:", best)
    return best


class Counter:
    """A class bundles some data with the things you can do to it."""

    def __init__(self):
        self.count = 0

    def add(self, amount):
        self.count += amount


def classes():
    c = Counter()
    c.add(2)
    c.add(3)
    print("count:", c.count)
    return c.count


# ---------------------------------------------------------------- NumPy

def numpy_arrays():
    a = np.array([1, 2, 3, 4])
    print("a * 2     :", a * 2)
    print("sum, mean :", a.sum(), a.mean())
    print("a[1:3]    :", a[1:3])
    print("a[a > 2]  :", a[a > 2])
    b = np.array([10, 20, 30, 40])
    print("a @ b     :", a @ b)
    m = np.array([[1, 2], [3, 4]])
    print("m.shape   :", m.shape)
    print("m @ [5, 6]:", m @ np.array([5, 6]))
    return a, b, m


def seeds():
    one = np.random.default_rng(42).integers(1, 7, size=5)
    two = np.random.default_rng(42).integers(1, 7, size=5)
    other = np.random.default_rng(43).integers(1, 7, size=5)
    print("same seed, same numbers:", one, two, "| a different seed:", other)
    return one, two, other


def main(fast=False):
    reward, rewards, total, avg = variables_and_lists()
    loop_total, words = loops_and_ifs(rewards)
    print("average() ->", average([1, 0, 1, 1, 0]))
    best = dictionaries()
    count = classes()
    a, b, m = numpy_arrays()
    one, two, other = seeds()
    if fast:
        assert total == 3 and avg == 0.6 and loop_total == 3
        assert words == ["win", "lose", "win", "win", "lose"]
        assert average([1, 0, 1, 1, 0]) == 0.6
        assert best == "A" and count == 5
        assert list(a * 2) == [2, 4, 6, 8] and a.sum() == 10 and a.mean() == 2.5
        assert list(a[1:3]) == [2, 3] and list(a[a > 2]) == [3, 4]
        assert a @ b == 300 and m.shape == (2, 2) and list(m @ np.array([5, 6])) == [17, 39]
        assert list(one) == list(two) and 1 <= one.min() and one.max() <= 6
        print("ok")


if __name__ == "__main__":
    main(fast="--fast" in sys.argv)
