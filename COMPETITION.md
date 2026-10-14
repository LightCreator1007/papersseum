# Papersseum: competition guide

Write a bot, upload one Python file, and watch it fight four other bots for control of a circular arena. Your bot plays automatically, round after round, and a leaderboard ranks everyone by how well their bot does.

> **Dates, links and the exact end of the competition are announced by the organisers.**
> Open period: `[START DATE]` to `[END DATE]`. Final results: `[DATE]`. Site: `[URL]`.

**Read section 3 before you start.** A submission is **one `.py` file, at most 1 MB**. If your bot is a neural network, its weights have to be *inside that file*. Section 6 shows how, and it takes one command.

---

## 1. Quick start

```bash
pip install papersseum                       # Python 3.11+
papersseum new my_agent.py                   # write a starter bot
papersseum eval my_agent.py --games 30       # how does it do against the baselines?
papersseum validate my_agent.py              # the exact check the platform runs on upload
```

Then sign in to the site with your college Google account and upload `my_agent.py`.

If `papersseum validate` says **PASSED**, the upload check will pass too.

---

## 2. The game

Five bots start in a circular arena (11,304 playable cells on a 120×120 grid) and play for **180 seconds**.

- **Moving.** Your bot decides **10 times per second** (1,800 decisions per match) and returns one of three actions: `0` straight, `1` turn left, `2` turn right. The world runs at 30 ticks per second, so you move between decisions.
- **Speed.** You start at 10 cells per second and gain **+1 cell per second for every 5% of the map you own**. After a kill you get a **1.5× speed boost for 5 seconds**. Speed is capped at 29 cells per second.
- **Starting land.** Every bot starts with a disc of land worth about **1% of the map** (radius 6, 109 cells).
- **Trail.** While you are outside your own land you draw a trail behind you.
- **Capturing.** Re-enter your own land and everything enclosed by your loop becomes yours, **including other players' land**.
- **Crossing your own trail is harmless.** You can loop back over it, cross it, or run along it. Nothing happens.
- **Dying.** You die if a rival's head touches *your trail*, or if you lose a head-on collision. A head-on is when two bots that are both drawing a trail move into the same cell or swap cells: the bot with **less land dies** and the other takes its land; if they have equal land **both die** and the land becomes neutral. The bot that killed you takes all your land and gets the speed boost.
- **Respawning.** After **3 seconds** you come back with a fresh 1% patch on empty ground at least 20 cells from any live head. If the arena has no room, you try again a little later.
- **The wall is solid but safe.** Steering into it just slides you along the edge.
- **Winning a match.** The largest share of the map when the 180 seconds end. Ties break on time-averaged coverage (the share you held over the whole match), then on fewer deaths.

Every match is deterministic from its seed and the action log, so any game can be replayed exactly.

### What your bot sees

Every decision, `act(obs)` receives a dict:

- `obs["local"]`: shape `(16, 31, 31)`. A crop centred on your head, **rotated so you always face "up"**. This is the view for quick reactions.
- `obs["global"]`: shape `(16, 120, 120)`. The whole arena, north up. Use it for planning (it costs more to process).
- `obs["scalars"]`: your coverage, rank, speed, heading, boost left, respawn countdown, deaths, time remaining, and each opponent's coverage, speed and alive flag.

The 16 channels are: your territory, trail and head; the same three for each of the four opponents; and the arena mask. Use the named indices in `papersseum.channels` (`ch.OWN_TERRITORY`, `ch.OWN_TRAIL`, `ch.OWN_HEAD`, `ch.opponent(i)`, `ch.ARENA_MASK`) instead of magic numbers. To print what your bot sees:

```python
print(papersseum.ascii_obs(obs, "local"))
```

---

## 3. What you submit (read this)

**One Python file.** That is the whole submission.

| Rule | Detail |
|---|---|
| Format | A single `.py` file, UTF-8 text |
| Size | **At most 1 MB** |
| Contents | Must define a class named `Agent` with `reset(config)` and `act(obs) -> int` |
| Extra files | **Not accepted.** No zip, no folder, no `.npy`, `.pt`, `.pth` or other weight files |
| Bots per person | **One.** A new upload replaces your previous version |
| Upload limit | One upload every 10 minutes |

### Weights go inside the file

The platform has no folder where your bot could read a weights file from, and `open()` is blocked. So if your bot uses trained weights, they are **embedded in your `.py` as a text string**. A command does this for you (section 6):

```bash
papersseum pack model.pt --into my_agent.py
```

### What does not work on the platform

- **`import torch`** is rejected: PyTorch is not installed in the competition sandbox. Train with PyTorch (or JAX, TensorFlow, anything) on your own machine, then run the trained network with NumPy (`papersseum.nn`, section 6).
- **`papersseum.load_weights`** reads files from your bot's folder. It exists only for local experiments and is **rejected on upload**, because only your `.py` file is uploaded. Use `papersseum.unpack_weights` instead.
- **Reading files, the network, the environment**: all blocked (section 5).
- **Learning during or between matches.** Each match starts a fresh process, and nothing is saved. Your bot can adapt *within* a match, but not across matches.

---

## 4. How the competition runs

### Rounds and the ladder

- **A new round starts every 15 minutes.** In each round, every active bot plays a match. Bots are grouped by similar rating (with some randomness, so you do not always face the same opponents), seats are shuffled, and the seed is random.
- If there are not enough bots to fill a lobby, **house bots** fill the empty seats. They appear on the leaderboard too. The house bots are the baselines `greedy`, `safe_expander` and `random`.
- You can submit **any time**. A new version joins from the next round on. Matches already queued with your old version still play it.
- **Your rating survives new uploads.** Improving your bot never resets your rating.

### How a match turns into a rating

1. Each bot gets a **match score**: its final coverage (in %) plus a placement bonus of **+8, +6, +4, +2, +0** for 1st to 5th. Placement matters most, and a big win beats a narrow one.
2. Ratings are Elo-style, updated pairwise after each match. Everyone starts at **1000**, with K = 32. A margin-aware result means beating someone by a lot moves ratings more than a photo finish.
3. The leaderboard ranks by a **conservative rating: `rating - 2 × uncertainty`**, where uncertainty is `350 / sqrt(1 + games played)`. A new bot has high uncertainty, so a lucky first game cannot put it on top. As your bot plays more games, the penalty shrinks.

### Final results

Near the end the organisers freeze submissions and let the ratings converge over many more matches. The final ranking is announced by the organisers and is based on the whole match record. The library includes a batch Plackett-Luce fit (`papersseum.rating.final_ranking`) so you can study how a record of finishes becomes strengths.

### Privacy

- **Your code stays private.** Nobody, including you, can download an uploaded file back from the platform, so **keep your own copy**. Code is not published after the competition.
- **Replays are public.** Every match page offers the replay as a downloadable file (`.jsonl.gz`, about 2 KB), and anyone can render it locally.

---

## 5. The sandbox and the time rules

When you upload, and for every match, your bot runs in an isolated container:

- no network, no access to files outside your bot, read-only filesystem
- 512 MB of memory, 1 CPU, 64 processes
- a fresh process every match

**Time limits** (the platform measures time itself, from when it sends the state to when it gets your answer):

| Call | Limit | If you break it |
|---|---|---|
| `reset(config)` | 2 seconds | the upload is rejected, or in a match your bot is disqualified |
| each `act(obs)` | **50 ms** | that decision is ignored: your bot goes straight, and you get a *strike* |
| no answer at all for 1 second | | your bot is killed and plays straight for the rest of the match |

- An exception or an answer other than `0`, `1`, `2` also makes that decision "straight".
- **Occasional slow decisions are fine** and only cost you that move. A bot that is late on **more than 20% of its decisions** (once at least 50 have been played), or that keeps the match waiting more than **20 seconds in total**, is **disqualified** from that match: it plays straight, and the match is recorded with your bot as crashed. Upload validation uses the same rule, so a bot that is slow every time is rejected before it ever plays.
- Do your heavy setup in `reset()` (2 seconds), not in `act()`.

**Allowed imports:** `numpy`, `math`, `random`, `itertools`, `collections`, `functools`, `heapq`, `bisect`, `typing`, `dataclasses`, `enum`, `json`, `copy`, `operator`, `statistics`, `array`, `re`, `string`, `time`, `abc`, `fractions`, `decimal`, `numbers`, `contextlib`, and `papersseum`.

**Blocked:** `eval`, `exec`, `compile`, `open`, `__import__`, `input`, `breakpoint`, `globals`, `locals`, `getattr`, `setattr`, `delattr`, `vars`, `from x import *`, interpreter-escape attributes such as `__subclasses__` and `__globals__`, raw `numpy.load` / `numpy.fromfile`, and `torch`. The upload check names the offending line and the reason.

Do not try to escape the sandbox, tamper with the platform or other bots, or abuse the service. Attempts get a bot banned.

---

## 6. Deep learning and trained models

You can use deep learning, including deep reinforcement learning. The constraint is where each part happens:

| Step | Where | What |
|---|---|---|
| Training | **Your own machine** (or Colab, a server, anything) | PyTorch, JAX, TensorFlow, ... without limits. `papersseum.PapersseumEnv` is a standard environment you can train in. |
| Inference | **The competition sandbox** | NumPy only, at most 50 ms per decision on one CPU. |
| Weights | **Inside your `.py` file** | A compressed text string, at most 1 MB for the whole file. |

### Step by step

**1. Train and save the weights.**

```python
torch.save(model.state_dict(), "model.pt")        # or: np.savez("model.npz", **arrays)
```

**2. Write your agent with a `WEIGHTS` line.** Start from [`examples/nn_agent.py`](examples/nn_agent.py), which has everything wired up:

```python
import numpy as np
from papersseum import nn, unpack_weights

WEIGHTS = ""

class Agent:
    def reset(self, config):
        self.W = unpack_weights(WEIGHTS)           # {"conv1.weight": array, ...} as float32

    def act(self, obs):
        h = nn.relu(nn.conv2d(obs["local"], self.W["conv1.weight"], self.W["conv1.bias"], padding=1))
        h = nn.relu(nn.conv2d(h, self.W["conv2.weight"], self.W["conv2.bias"], stride=2, padding=1))
        logits = nn.linear(nn.global_avg_pool(h), self.W["fc.weight"], self.W["fc.bias"])
        return int(np.argmax(logits))
```

**3. Embed the weights** (this rewrites the `WEIGHTS = "..."` line and tells you the size):

```bash
papersseum pack model.pt --into my_agent.py                 # float16: half the size, almost no accuracy loss
papersseum pack model.pt --into my_agent.py --dtype int8    # smallest, check your bot still plays well
```

It accepts `.pt`, `.pth`, `.npz` and `.npy`. Reading `.pt` files needs PyTorch on *your* machine, not in the sandbox. If the file would exceed 1 MB, `pack` refuses and writes nothing.

**4. Check it.**

```bash
papersseum validate my_agent.py        # the platform's upload check
papersseum eval my_agent.py --games 30
```

### What fits

About **350,000 weights at float16** or **700,000 at int8** inside the 1 MB limit, leaving room for your code. That comfortably fits convolutional and fully connected policies over the local view (the example network has about 7,000 weights and runs a forward pass in well under a millisecond). Large networks (ResNets, transformers) do not fit. Prefer small, efficient architectures.

### `papersseum.nn`: the building blocks

All functions work on **one sample** in PyTorch layouts, so a state dict maps straight across: `conv2d(x, w, b, stride, padding)` with `x: (C, H, W)` and `w: (out, in, kh, kw)`; `linear(x, w, b)` with `w: (out, in)`; `relu`, `leaky_relu`, `tanh`, `sigmoid`, `softmax`; `max_pool2d`, `avg_pool2d`, `global_avg_pool`, `global_max_pool`, `flatten`; and inference-mode `batch_norm(x, running_mean, running_var, weight, bias)`. Anything else (dilated or grouped convolutions, recurrent layers, attention) you write in NumPy yourself.

**Tips**

- **Check parity first.** Run the same observation through your PyTorch model and your NumPy forward pass and compare the outputs before you embed anything.
- **Bake in preprocessing.** Fold batch normalisation into the preceding convolution during export if you can, and keep any input normalisation inside `act`.
- **Measure.** `papersseum validate` reports your slowest decision. Keep it well under 50 ms, and assume a modest single CPU: your bot gets one core, shared with nothing else but not a fast one.
- **Use `reset()`** to unpack weights, precompute tables and allocate buffers.
- **Exploration noise.** Your bot's random stream is seeded by `config["seed"]` and `config["pid"]`.

---

## 7. Command reference

| Command | What it does |
|---|---|
| `papersseum new [path]` | Write a starter agent (default `my_agent.py`) |
| `papersseum play AGENT [--vs a,b] [--seed N] [--render out.mp4] [--save-replay f.jsonl.gz]` | Play your bot in slot 0 against baselines (`random`, `greedy`, `safe_expander`, `hunter`) |
| `papersseum eval AGENT [--games N] [--vs ...] [--seed N]` | Benchmark over many games: placements, win rate, coverage, rating |
| `papersseum validate AGENT [--decisions N]` | The platform's upload check: static scan, then a full match against itself and three baselines |
| `papersseum pack WEIGHTS --into AGENT [--dtype float16\|int8\|float32]` | Embed trained weights in your agent file |
| `papersseum render REPLAY out.mp4` | Render a saved replay as video (needs `ffmpeg`) |
| `papersseum version` | Library version and the engine hash (it must match the server's) |

`papersseum.ENGINE_HASH` identifies the exact game build. If it matches the server's, a local match plays out exactly as it would on the platform. Update the package (`pip install -U papersseum`) when the organisers announce a new version.

---

## 8. FAQ

**Can I upload a zip with my model?** No. One `.py` file only. Embed the weights with `papersseum pack`.

**Can I import PyTorch in my bot?** No, it is not installed in the sandbox. Run inference with NumPy and `papersseum.nn`.

**My model is bigger than 1 MB.** Quantize with `--dtype int8`, prune, or use a smaller network.

**Can my bot remember things between matches?** No. Each match is a fresh process.

**I uploaded a broken version. Did I lose my place?** No. A new version only becomes active after it passes validation. A rejected upload leaves your previous version playing.

**Why was my upload rejected?** The site shows the reason and, for scan errors, the line. Run `papersseum validate` locally to reproduce it.

**Why can't I download my code back?** Uploaded code is private by design, even from you. Keep your own copy.

**Is the game random?** Each match is deterministic from its seed and the actions, but you do not choose the seed, and opponents differ. Your own bot may use randomness.

**Can I team up?** One bot per account. Check with the organisers for team rules.
