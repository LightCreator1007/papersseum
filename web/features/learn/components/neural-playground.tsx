"use client";

import { useRef, useState } from "react";
import { accuracy, gridProbabilities, loss, makeData, makeNet, train, type Data, type Dataset, type Net } from "@/features/learn/neural";

const CELLS = 28;
const SIZE = 280;
const DATASETS: { id: Dataset; label: string }[] = [
  { id: "blobs", label: "Two blobs" },
  { id: "xor", label: "XOR" },
  { id: "circle", label: "Circle" },
];

type Snap = { probs: number[]; loss: number; acc: number; steps: number };

function snap(net: Net, data: Data, steps: number): Snap {
  return { probs: gridProbabilities(net, CELLS), loss: loss(net, data), acc: accuracy(net, data), steps };
}

// Chapter 10's demo: train a tiny network on a yes/no problem and watch the regions it draws.
export function NeuralPlayground() {
  const [dataset, setDataset] = useState<Dataset>("xor");
  const [hidden, setHidden] = useState(4);
  const [lr, setLr] = useState(0.5);
  const seedRef = useRef(1);
  const data = useRef<Data>(makeData("xor", 160, 1));
  const net = useRef<Net>(makeNet(4, 1));
  const steps = useRef(0);
  const [view, setView] = useState<Snap>(() => snap(makeNet(4, 1), makeData("xor", 160, 1), 0));
  const [points, setPoints] = useState<Data>(() => makeData("xor", 160, 1));

  function restart(nextDataset: Dataset, nextHidden: number) {
    seedRef.current += 1;
    setDataset(nextDataset);
    setHidden(nextHidden);
    data.current = makeData(nextDataset, 160, seedRef.current);
    net.current = makeNet(nextHidden, seedRef.current);
    steps.current = 0;
    setPoints(data.current);
    setView(snap(net.current, data.current, 0));
  }

  function run(count: number) {
    train(net.current, data.current, count, lr);
    steps.current += count;
    setView(snap(net.current, data.current, steps.current));
  }

  const cell = SIZE / CELLS;
  const px = (v: number) => ((v + 1) / 2) * SIZE;

  return (
    <div className="demo" aria-label="Neural playground">
      <p className="demo-title">Neural playground</p>
      <p className="small muted">
        The network sees a point and says how likely it is to be a blue one. It starts with random weights. Press Train and watch the colours it paints behind the points: blue where it says &ldquo;blue&rdquo;, orange where it says &ldquo;orange&rdquo;.
      </p>

      <div className="actions">
        {DATASETS.map((d) => (
          <button key={d.id} type="button" className={d.id === dataset ? "btn" : "btn-secondary"} onClick={() => restart(d.id, hidden)} aria-pressed={d.id === dataset}>
            {d.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="plot" role="img" aria-label="The regions the network has drawn, with the data points on top">
        {view.probs.map((p, i) => (
          <rect key={i} x={(i % CELLS) * cell} y={Math.floor(i / CELLS) * cell} width={cell + 0.5} height={cell + 0.5} className={p > 0.5 ? "np-blue" : "np-orange"} style={{ opacity: Math.min(0.75, Math.abs(p - 0.5) * 1.5) }} />
        ))}
        {points.x.map((p, i) => (
          <circle key={i} cx={px(p[0])} cy={SIZE - px(p[1])} r="3.2" className={points.y[i] ? "np-pt-blue" : "np-pt-orange"} />
        ))}
      </svg>

      <div className="actions">
        <button type="button" className="btn" onClick={() => run(50)}>
          Train 50 steps
        </button>
        <button type="button" className="btn-secondary" onClick={() => run(500)}>
          Train 500
        </button>
        <button type="button" className="link-button small" onClick={() => restart(dataset, hidden)}>
          New random weights
        </button>
      </div>

      <div className="actions">
        <label className="small">
          hidden neurons = <strong>{hidden}</strong>{" "}
          <input type="range" min={1} max={8} step={1} value={hidden} onChange={(e) => restart(dataset, Number(e.target.value))} aria-label="Number of hidden neurons" />
        </label>
        <label className="small">
          step size = <strong>{lr.toFixed(2)}</strong>{" "}
          <input type="range" min={0.05} max={2} step={0.05} value={lr} onChange={(e) => setLr(Number(e.target.value))} aria-label="Step size" />
        </label>
      </div>

      <p className="demo-status" aria-live="polite">
        Steps: <strong>{view.steps}</strong> · loss: <strong>{view.loss.toFixed(3)}</strong> · right on <strong>{Math.round(view.acc * 100)}%</strong> of the points
      </p>
    </div>
  );
}
