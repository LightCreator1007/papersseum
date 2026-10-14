"use client";

import { useState } from "react";
import { ReplayViewer } from "@/components/replay-viewer";
import { replayFileProblem } from "@/lib/replay-input";

type Chosen = { id: number; name: string; source: { bytes: Uint8Array } };

// Pick or drop a replay file; it is read here and never uploaded. Choosing
// another file remounts the viewer, which cancels the run in progress.
export function ReplayDrop() {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    const issue = replayFileProblem(file);
    setProblem(issue);
    if (issue) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setChosen((prev) => ({ id: (prev?.id ?? 0) + 1, name: file.name, source: { bytes } }));
  };

  return (
    <>
      <label
        className="drop-zone"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept=".jsonl,.gz"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        Drop a replay file here, or <span className="link-button">choose one</span>.
        <br />
        <span className="muted small">
          A <code>.jsonl</code> or <code>.jsonl.gz</code> file. It stays on your computer.
        </span>
      </label>
      {problem && (
        <p className="error-text small" style={{ marginTop: 8 }}>
          {problem}
        </p>
      )}
      {chosen && (
        <section style={{ marginTop: 24 }}>
          <p className="mono muted" style={{ marginBottom: 10 }}>
            {chosen.name}
          </p>
          <ReplayViewer key={chosen.id} source={chosen.source} />
        </section>
      )}
    </>
  );
}
