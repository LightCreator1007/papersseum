// A tiny line chart for the demos: values are plotted left to right, scaled to [0, max].
export function Spark({
  values,
  max = 1,
  reference,
  label,
}: {
  values: number[];
  max?: number;
  reference?: number;
  label: string;
}) {
  const w = 300;
  const h = 70;
  const y = (v: number) => h - Math.min(1, Math.max(0, v / max)) * h;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label={label}>
      {reference !== undefined ? <line x1="0" x2={w} y1={y(reference)} y2={y(reference)} className="spark-ref" /> : null}
      <polyline points={pts} className="spark-line" fill="none" />
    </svg>
  );
}
