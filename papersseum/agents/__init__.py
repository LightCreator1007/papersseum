from papersseum.agents.base import Agent
from papersseum.agents.random_agent import RandomAgent
from papersseum.agents.greedy_agent import GreedyAgent
from papersseum.agents.safe_expander import SafeExpanderAgent

# baseline spar partners, referenced by name on the CLI (--vs greedy,safe_expander)
BASELINES = {
    "random": RandomAgent,
    "greedy": GreedyAgent,
    "safe_expander": SafeExpanderAgent,
}
