"""Papersseum: the reference environment for the Papersseum tournament.

Public API for participants:

    from papersseum import Agent, PapersseumEnv, play

    class MyAgent(Agent):
        def act(self, obs):
            return 0

    result = play(MyAgent, vs=["greedy", "safe_expander"], seed=7, render="match.mp4")

`ENGINE_HASH` identifies the exact engine build; the server prints the same hash
at match start, so a hash match guarantees local results equal ladder results.
"""

import hashlib

from papersseum.agents.base import Agent
from papersseum.agents import BASELINES, RandomAgent
from papersseum.env import PapersseumEnv
from papersseum.match import run_match, replay_match
from papersseum.loader import load_agent_from_file
from papersseum import constants

__all__ = [
    "Agent", "PapersseumEnv", "play", "run_match", "replay_match",
    "load_agent_from_file", "constants", "__version__", "ENGINE_HASH",
]

__version__ = "0.1.0"

# modules whose source defines match behavior; their combined hash must match
# the server's for local play to equal the ladder.
_ENGINE_MODULES = [
    "constants", "geometry", "state", "movement", "trail",
    "capture", "death", "respawn", "engine", "observation", "env",
]


def engine_hash():
    """SHA-256 over the engine source, truncated. Deterministic per build."""
    import os
    here = os.path.dirname(__file__)
    h = hashlib.sha256()
    for name in _ENGINE_MODULES:
        with open(os.path.join(here, f"{name}.py"), "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()[:16]


ENGINE_HASH = engine_hash()


def _resolve_agent(agent):
    """Accept a file path, an Agent subclass, or an Agent instance; return an instance."""
    if isinstance(agent, str):
        return load_agent_from_file(agent)()
    if isinstance(agent, type):
        return agent()
    return agent


def play(agent, vs=None, seed=7, render=None):
    """Play one match: your agent against baseline spar partners.

    agent:  path to a .py file, an Agent subclass, or an Agent instance.
    vs:     baseline names from BASELINES; defaults to greedy + safe_expander.
            The lobby is padded to 5 players with random agents.
    render: optional output path; writes an MP4 of the match if given.

    Returns the match result dict (scores, placements, action_log, final_owner).
    """
    vs = vs or ["greedy", "safe_expander"]
    lobby = [_resolve_agent(agent)]
    for name in vs:
        if name not in BASELINES:
            raise ValueError(f"unknown baseline {name!r}; choose from {sorted(BASELINES)}")
        lobby.append(BASELINES[name]())
    while len(lobby) < constants.N_PLAYERS:
        lobby.append(RandomAgent())
    lobby = lobby[:constants.N_PLAYERS]

    result = run_match(seed, lobby)
    if render:
        from papersseum.render import render_replay_mp4
        render_replay_mp4(seed, result["action_log"], render)
    return result
