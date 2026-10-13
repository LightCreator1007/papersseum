import { elo } from "@/lib/format";
import { eloLinePoints } from "@/lib/elo-line";

const W = 600;
const H = 120;

export function EloLine({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="muted small">No rated matches yet.</p>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Elo from ${elo(values[0])} to ${elo(values[values.length - 1])}`}
        style={{ width: "100%", height: H, display: "block", borderBottom: "1px solid var(--rule)" }}>
        <polyline fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          points={eloLinePoints(values, W, H, 8)} />
      </svg>
      <figcaption className="muted small" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span>low {elo(min)}</span>
        <span>high {elo(max)}</span>
      </figcaption>
    </figure>
  );
}
