from enclave.agents.base import Agent
from enclave.agents.random_agent import RandomAgent
from enclave.agents.greedy_agent import GreedyAgent
from enclave.agents.safe_expander import SafeExpanderAgent

# baseline spar partners, referenced by name on the CLI (--vs greedy,safe_expander)
BASELINES = {
    "random": RandomAgent,
    "greedy": GreedyAgent,
    "safe_expander": SafeExpanderAgent,
}
