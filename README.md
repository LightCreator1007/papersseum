# Papersseum

A real-time, multi-agent territory-capture tournament. Write an agent, submit it, and watch it fight four others for the map.

Five agents drop into a bounded circular arena for 180 seconds. Leave your land and you draw a trail behind you. Close the loop and everything you enclosed becomes yours. Cut a rival's trail and you don't just kill them, you take their whole territory and get a short speed burst to go after the next one. Whoever owns the most of the map when the clock runs out wins.

Anyone can enter. Your agent can be a few lines of rules, a trained neural net, a search routine, or anything in between. The server runs ladder rounds of random 5-agent lobbies, rates agents by how they place, and a final round sets the leaderboard. Every match is deterministic from its seed and action log, so any game can be replayed and any dispute settled by running it again.

The name is paper plus colosseum: an arena where paper-thin territories are fought over to the last tick.

## The game

- **Arena.** Circular, 11,304 playable cells on a 120x120 grid. The wall is solid. Steer into it and you slide along the edge instead of dying.
- **Match.** Five players, 180 seconds. Everyone starts with a small disc worth 1% of the map. The engine runs at 30 ticks per second; agents decide 10 times per second.
- **Movement.** Three actions: `0` straight, `1` left, `2` right. You move faster the more land you hold (+1 cell per second for every 5% of the map), and you get a 1.5x burst for 5 seconds after a kill. Speed is capped so you never move more than one cell per tick.
- **Capture.** Re-enter your own land with an open trail and everything the loop encloses becomes yours, including other players' land.
- **Death.** Two bots never share a cell: run into a bot's head on its trail and you cut it; otherwise one waits a tick. You can cross your own trail freely. Get cut by a rival, lose a head-on, or get caught inside a loop a rival closes, and the killer takes all your land. A bot's land is always one connected piece: separate pieces are joined by a thin one-cell strip over empty ground. You respawn with a fresh 1% patch on empty ground.
- **Score.** Your share of the map at the end. Ties break on time-averaged coverage, then fewer deaths.

A few rules (taking territory on a kill, the kill speed burst, solid walls) are intentional changes from a stock paper.io-style game.

## What your agent sees

Every decision, your agent gets a view built from its own point of view. There are 16 channels: your territory, trail, and head, the same three for each of the four opponents, and the arena mask.

- **Global view**, shape `(16, 120, 120)`. The whole arena, north up. Use it for planning.
- **Local view**, shape `(16, 31, 31)`. Cropped on your head and rotated so your heading points up, so "straight", "left", and "right" always mean the same pixels. Use it for quick reactions.
- **Scalars**: your coverage, rank, speed, boost remaining, time left, and each opponent's coverage, speed, and alive flag.

## Using the library

```bash
pip install -U papersseum        # Python 3.11+; the only dependency is NumPy
papersseum version               # library version and engine hash (must match the server's)
```

| Command | What it does |
|---|---|
| `papersseum new my_agent.py` | Write a starter agent |
| `papersseum play my_agent.py --vs greedy,hunter` | Play one match against baselines (`--render out.mp4` needs `ffmpeg`) |
| `papersseum eval my_agent.py --games 30` | Benchmark over many matches: placements, win rate, coverage, rating |
| `papersseum validate my_agent.py` | The platform's upload check, run locally |
| `papersseum pack model.pt --into my_agent.py` | Embed trained weights in a single-file agent |
| `papersseum render game.jsonl.gz out.mp4` | Render a saved replay |

From Python:

```python
import papersseum

result = papersseum.play("my_agent.py", vs=["greedy", "hunter"], seed=7)
print(result["placements"])

env = papersseum.PapersseumEnv(seed=7)       # a multi-agent environment for training
obs = env.reset()                            # {player: observation}
```

An agent is one `.py` file defining `Agent` with `reset(config)` and `act(obs) -> int` (`0` straight, `1` left, `2` right). Four baselines (`random`, `greedy`, `safe_expander`, `hunter`) ship in [`papersseum/agents/`](papersseum/agents), and [`examples/`](examples) has a starter and a neural-network agent.

Everything else (upload rules, time limits, scoring, deep-learning recipe) is in [COMPETITION.md](COMPETITION.md).
