# Paper.io RL Tournament: Game Specification (Draft v0.2)

Status: draft for review. Anything marked **[ASSUMPTION]** was not decided yet and needs a yes or no. Anything marked **[CALIBRATE]** is a number we set by simulation, not by opinion.

## 1. Overview

Five agents, one circular arena, 180 seconds. Each agent controls a snake-like head that leaves a trail when it is outside its own territory. Close the trail back into your own land and everything you enclosed becomes yours. If anyone touches your trail before you close it, you die. Die as often as you like, you respawn until the clock runs out.

The winner of a match is whoever owns the largest share of the map when the timer ends.

Participants submit a Python script through our API. The server runs a ladder round every 15 to 30 minutes, with matches in random lobbies of 5. Agents are rated from placements, and a final round decides the leaderboard.

## 2. Decisions so far

| Topic | Decision | Source |
|---|---|---|
| Players per match | 5, random lobbies | Decided |
| Match length | 180 s | Decided |
| Objective | Maximum area share at the end of the match | Decided |
| Start territory | Circular patch, 2.5% to 5% of the map | Decided |
| Respawn | Unlimited until the timer ends | Decided |
| Death | Trail cut means death | Decided |
| Speed | Same base speed for all, +1 m/s per 5% of area owned | Decided |
| Base speed | Match paper.io feel | Decided, number is [CALIBRATE] |
| Observation | Local view plus full map view, plus own and opponents' coverage and rank | Decided |
| Map shape | Circular arena, circular start patches | Decided |
| Territory on death | All territory is lost and becomes neutral | Decided |
| Simulation quality | Accurate and smooth, paper.io feel | Decided, see section 3.1 |
| Ladder cadence | A round of matches every 15 to 30 minutes | Decided, reading in section 7 is an **[ASSUMPTION]** |
| Unit "meter" | 1 m = 1 grid cell **[ASSUMPTION]** | Open |
| Speed tied to | Current area, not peak area **[ASSUMPTION]** | Open |
| Local view shape | 31 x 31 crop centered on the head, aligned to heading **[ASSUMPTION]** | Open |

## 3. Game rules

### 3.1 Map

- Circular arena of radius `ARENA_RADIUS` = 60 cells, stored on a 120 x 120 grid. A cell is playable if its center lies within the radius of the arena center. That gives about 11,300 playable cells. Everything outside the circle is a wall.
- The playable mask is computed once and shared by the engine, the observation and the viewer. No floating point geometry at match time.
- Every playable cell is one of: neutral, owned by player P, or carrying P's trail (a trail cell also remembers the land owner underneath).
- Coverage percentage for a player = owned cells / playable cells x 100.
- **Smoothness.** A circle on a coarse grid has a jagged edge, and jagged edges feel wrong next to paper.io. The fix is in two layers. The engine stays on the integer grid so it is exact and deterministic. The viewer draws heads, trails and borders with interpolation between ticks and a smoothed outline, so it looks like continuous motion. If the jagged wall still hurts play after calibration, move the engine to a finer grid (for example radius 120 on a 240 x 240 grid) and scale speeds by 2. That costs 4x compute per match. **[CALIBRATE]**

### 3.2 Spawning at match start

- Each player gets a filled circle of owned cells covering `START_AREA_FRAC` of the playable cells. At 3% that is about 340 cells, radius about 10.4 cells.
- Centers sit on a ring around the arena center at ring radius 0.60 x `ARENA_RADIUS` (36 cells), spaced evenly (pentagon), with a random rotation per match so no slot has a fixed position. With these numbers neighbouring patches are about 42 cells apart and every patch sits well inside the wall.
- Spawn order and slot numbers are shuffled per match. Agents never learn who they are playing against.
- Start heading is random.

### 3.3 Movement and speed

- The engine runs at `TICK_HZ` = 30 ticks per second, 5,400 ticks per match.
- Agents decide at `DECISION_HZ` = 10 times per second. The chosen action is held until the next decision.
- Actions: `0 = straight`, `1 = turn left`, `2 = turn right`. No reversing, no stopping.
- Speed in cells per second: `speed = BASE_SPEED + floor(area_pct / 5) * 1`.
- Each tick a player adds `speed / TICK_HZ` to a movement accumulator. Each time it reaches 1, the head moves exactly one cell. Turns take effect at the next cell step.
- With the numbers below, the maximum speed stays under 30 cells/s, so a head never needs to move more than one cell per tick.

### 3.4 Trails and capture

- Inside your own territory you leave no trail.
- The first step outside your territory starts a trail. Every cell you pass through outside your land becomes trail.
- When your head re-enters your own territory, the trail closes. All trail cells become owned. Every cell enclosed by the loop (not reachable from the map edge without crossing your land) also becomes owned, including cells that belonged to other players.
- Other players' trails inside the enclosed area are not affected by the capture. **[ASSUMPTION]** (Alternative: enclosing an opponent's trail kills them. More aggressive, harder to balance.)

### 3.5 Death

A player dies when:
1. Their head leaves the circular arena (touches the wall).
2. Their head enters a cell holding their own trail.
3. Any player's head enters a cell holding their trail (the trail owner dies, the cutter lives).
4. Head-on collision: two heads enter the same cell or swap cells in the same step while both are laying trail. The player with the smaller territory dies. Equal territory means both die. **[ASSUMPTION]** If only one of them is laying a trail, the heads pass through each other.

On death:
- The trail is erased.
- All of that player's territory becomes neutral. It is not given to the killer. (Decided.)
- The player is out for `RESPAWN_DELAY_S` seconds, then respawns.

### 3.6 Respawn

- Respawn point: a random location where a full start circle fits on neutral cells, at least 20 cells from every other head. If none exists, retry each tick.
- The respawned player gets a fresh circular patch of `START_AREA_FRAC` of the map and a random heading.
- Respawn count is unlimited. A respawn after t = 177 s is legal but nearly worthless, which is fine.

### 3.7 Match end and scoring

- At t = 180 s the match stops. Each player's score is final coverage percentage.
- Placement: sort by final coverage, descending.
- Tiebreaks in order: higher time-averaged coverage over the match, then fewer deaths, then lower slot number after shuffle (effectively random).
- A player who is dead at the final tick scores 0% and places last among alive players.

## 4. Constants (single source of truth)

```python
MAP_W = 120                  # grid storage size
MAP_H = 120
ARENA_RADIUS = 60            # cells, circular playable area inside the grid
N_PLAYERS = 5
MATCH_SECONDS = 180
TICK_HZ = 30
DECISION_HZ = 10

START_AREA_FRAC = 0.03       # allowed range 0.025 to 0.05
BASE_SPEED = 10              # cells per second  [CALIBRATE]
SPEED_STEP = 1               # cells per second added per step
SPEED_STEP_PCT = 5           # area percent per step

RESPAWN_DELAY_S = 3          # [CALIBRATE]
RESPAWN_MIN_DIST = 20        # cells from any other head
ACT_TIMEOUT_MS = 50          # per decision, on timeout the agent goes straight

LOCAL_VIEW = 31              # cells per side of the local crop (odd, head at center)

LADDER_ROUND_MINUTES = 20    # allowed range 15 to 30  [CALIBRATE]
GAMES_PER_ROUND = 4          # matches per active agent per round  [CALIBRATE]
SUBMISSION_FREEZE_S = 60     # submissions after this point wait for the next round
```

About base speed: I do not have an official number for paper.io, so the spec defines it by feel. At 10 cells/s a head crosses the map in 12 seconds. Tune that by playing the reference environment yourself until it feels like paper.io, then freeze it before the practice ladder opens.

## 5. Agent interface

### 5.1 Observation

Agents get two views every decision, a local one and the full map. Both use the same channels.

- **Channels** (C = 16):
  - own territory, own trail, own head
  - for each of the 4 opponents (fixed slot order for the whole match): territory, trail, head
  - arena mask (1 for playable cells, 0 for wall)
  - total 3 + 4 x 3 + 1 = 16 channels
- **Global view**, shape `(16, 120, 120)`, float32 or uint8. The whole arena, north up, fixed orientation.
- **Local view**, shape `(16, 31, 31)`, same dtype. A crop centered on the agent's own head and rotated so its heading points up, so "straight, left, right" always mean the same thing in the crop. Cells outside the grid are filled with wall. **[ASSUMPTION]** (Alternative: keep north up and give the heading as a scalar. Simpler, but the agent has to learn four rotated copies of every pattern.)
- Agents can ignore either view. A small CNN on the local view plus a few scalars is a reasonable baseline, and the global view is for planning.
- **Scalars** (vector):
  - own coverage %, own rank (1 to 5), own speed, own heading (one-hot of 4), own alive flag, respawn countdown, own death count
  - time remaining (seconds)
  - each opponent's coverage %, alive flag, speed
- No player names, no submission IDs, no history from earlier matches.

### 5.2 Action

An integer in `{0, 1, 2}`: straight, left, right.

### 5.3 Script contract

One Python file per submission, with this shape:

```python
class Agent:
    def reset(self, config: dict) -> None:
        """Called once per match with the constants above and a seed."""

    def act(self, obs: dict) -> int:
        """Called every decision. Return 0, 1 or 2."""
```

Optional: one weights file up to 50 MB loaded by the script from its own folder.

## 6. Submission and sandbox

Running strangers' code is the biggest risk in this project. Minimum bar:

- Each submission runs in its own container: no network, read-only filesystem except a temp folder, no access to other submissions or engine memory.
- Hard caps: CPU time, RAM, and `ACT_TIMEOUT_MS` per decision. Timeout, crash, or invalid return means the agent goes straight for that decision.
- Approved libraries only (numpy, torch CPU, and whatever else we list up front). **[CALIBRATE]** Decide GPU or CPU based on the match-worker hardware.
- Import-time limit (for example 10 s) so loading weights cannot stall a lobby.
- Submission rate limit per team, and one active submission per team.
- Engine and agents talk over a narrow IPC channel. The agent gets the observation dict and nothing else.

## 7. Tournament structure

1. **Reference environment.** Release a Gym-style local environment that matches the server exactly (same constants, same rules, same observation), plus 3 baseline bots (random, greedy small-loop, safe expander). Without this, only people who can build their own simulator have a chance.
2. **Practice ladder (open for days).** A round of matches every 15 to 30 minutes, in random lobbies of 5, rated by OpenSkill (Plackett-Luce) on placements. Optional small blend of coverage margin so close finishes count differently from blowouts. See 7.1 for how a round works.
3. **Final.** Top 16 from the ladder. Fresh random lobbies, each agent plays at least 30 games, balanced so everyone plays the same number of matches against a spread of opponents. Final rank by conservative rating (mean minus 3 sigma).
4. **Live show.** A replay viewer that renders any match from its seed and action log. The finals should be watchable on a projector.

All matches are deterministic given seed plus actions, so every game can be replayed and disputes can be settled by rerunning.

### 7.1 How a ladder round works

**[ASSUMPTION]** I read "games are simulated every 15 to 30 minutes" as: the server runs one batch of matches on that schedule, and matches are simulated faster than real time, not played live. If you meant one live match per slot, say so and this section changes.

1. At the start of a round, the server snapshots every active submission. Anything uploaded after `SUBMISSION_FREEZE_S` before the start waits for the next round.
2. The scheduler builds random lobbies so every active agent plays `GAMES_PER_ROUND` matches against a mix of opponents.
3. Matches run in parallel on the workers. Results, ratings and replays are published when the round ends.
4. A new submission enters with a wide uncertainty, so its rating moves fast and then settles. It does not inherit the old rating of the same team.

Budget check, with example numbers: a match is 5,400 ticks and 1,800 decisions per agent. If an agent burns the full 50 ms on every decision, that is 90 s of agent time per match, so plan for about 100 s per match in the worst case. With 100 active agents and 4 games each, a round is 80 matches. On 8 workers that is 10 batches of about 100 s, roughly 17 minutes. That fits a 20 minute cadence only barely. More agents or slower agents need more workers or a 30 minute cadence. **[CALIBRATE]**

Over a three day ladder at 20 minute rounds, each agent plays about 4 x 72 x 3 = 864 games, far more than the 30 the final needs. The ladder is for rating and feedback, so the cadence can be slower if compute is tight.

## 8. Known failure modes and fixes

| Failure mode | Why it happens | Fix |
|---|---|---|
| Snowballing leader | +1 m/s per 5% makes a 40% player about 1.8x faster than a new one | Speed tied to current area (self-correcting). Cap or shrink step if baseline bots show runaway wins [CALIBRATE]. |
| Outcomes decided by one death | Leader loses all territory in one cut | Measure rank stability (half-time rank vs final rank) with baseline bots. If too noisy, blend final share with time-averaged share in the score, or keep part of the territory on death. |
| Ranks never stabilize | 5 players, high variance | At least 30 games per finalist. Use rating uncertainty, not raw win counts. |
| Hiding and camping | Agents learn to sit on a small safe patch after a lead | Territory is the only score, so passivity is capped by whoever expands. Check that baseline "safe expander" does not win outright. |
| Collusion | Friends feed each other in random lobbies | Anonymous slots, shuffled per match, one submission per team, no communication channel in the interface, rules stating this. |
| Dogpiling the leader | Everyone sees ranks and targets first place | Keep it, it is emergent play. Document it so nobody calls it a bug. |
| Agent crash or hang | Student code | Timeout means default action. Agent that crashes repeatedly in a match is just a dead snake, not a stalled lobby. |
| Spawn camping | Killers wait near respawn points | Minimum distance from other heads on respawn, random locations. |
| Sim/server mismatch | Local env drifts from server | One engine package shared by both, versioned, with a hash printed at match start. |
| Tick-rate cheating | Slow agent loses decisions | Fixed `ACT_TIMEOUT_MS`, everyone gets the same budget. |
| Jagged circular wall | A circle on a coarse grid has stair steps, and the rounded edge can be exploited or feel unfair | Shared precomputed mask, viewer-side smoothing. Move to a finer grid only if calibration shows edge-hugging strategies winning. |
| Corner and wall hugging | Safe expansion along the wall needs fewer cells to enclose | Test with the safe expander baseline. If wall huggers dominate, the wall is too safe. Options: raise speed so close wall passes are riskier, or lower `START_AREA_FRAC` so patches start farther from it. |
| Round overruns the cadence | Slow agents and many submissions push a round past its slot | Per-match wall-clock cap, worker count sized for the worst case, a late match is dropped and rerun next round, never delays the schedule. |
| Rating thrash from re-submitting | Teams resubmit every round and each new agent starts rated 0 | New submissions enter with high uncertainty. Limit submissions per team per day. |
| Rotated local view mismatch | Agent trained on a north-up crop gets heading-aligned input | Reference environment emits exactly the server format. The format is versioned and documented with a sample. |

## 9. Open items before freezing

1. Confirm the [ASSUMPTION] rows in section 2 and the round reading in 7.1.
2. Pick the final number for `BASE_SPEED` by playing the reference build, and for `SPEED_STEP` by running baseline bots.
3. Decide CPU only or CPU plus GPU for match workers.
4. Event date and ladder opening date, so the freeze deadline can be set backwards from them. Expected number of participants and worker count, so the round cadence in 7.1 can be sized.
5. Approved library list.
6. Tiebreak order and final-round size (16 is a placeholder).

## 10. Calibration plan

Before any participant sees the spec as final, run these against the reference engine:

1. 1,000 matches with three baseline bots plus two copies of each to see lobby balance.
2. Plot final coverage distribution. Strong play should reach roughly 25% to 40%. If everyone ends under 10%, speed or time is too low. If one bot regularly hits 70%, the speed step is too generous.
3. Measure the correlation between half-time rank and final rank. If it is near 1, the game is a snowball. If it is near 0, it is a coin flip. Aim for the middle.
4. Check average number of deaths per player per match. If it is above about 6, the map is too cramped or respawns are too punishing.
5. Compare coverage by position relative to the wall. If agents that hug the wall win far more often than agents that expand through the middle, the circular edge is too forgiving.
6. Time a worst-case match (every agent using the full 50 ms per decision) and size the worker pool from that number, not from the average.
