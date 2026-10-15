// The agent and environment loop, drawn once so chapters can reuse it: <AgentLoop />
export function AgentLoop() {
  return (
    <figure className="figure">
      <svg viewBox="0 0 380 170" className="diagram" role="img" aria-label="The agent sends an action to the environment. The environment sends back a new situation and a reward.">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="diagram-arrow-head" />
          </marker>
        </defs>
        <rect x="12" y="55" width="112" height="60" rx="6" className="diagram-box" />
        <text x="68" y="90" textAnchor="middle" className="diagram-text diagram-strong">Agent</text>
        <rect x="256" y="55" width="112" height="60" rx="6" className="diagram-box" />
        <text x="312" y="90" textAnchor="middle" className="diagram-text diagram-strong">Environment</text>
        <path d="M 124 70 C 170 20, 210 20, 256 70" className="diagram-line" markerEnd="url(#arrow)" fill="none" />
        <text x="190" y="30" textAnchor="middle" className="diagram-text">action</text>
        <path d="M 256 100 C 210 150, 170 150, 124 100" className="diagram-line" markerEnd="url(#arrow)" fill="none" />
        <text x="190" y="158" textAnchor="middle" className="diagram-text">new situation + reward</text>
      </svg>
      <figcaption className="small muted">The loop every RL problem shares: act, see what happened, repeat.</figcaption>
    </figure>
  );
}
