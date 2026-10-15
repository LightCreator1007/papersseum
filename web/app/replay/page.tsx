import type { Metadata } from "next";
import Link from "next/link";
import { ReplayDrop } from "@/features/replay/components/replay-drop";

export const metadata: Metadata = { title: "Replay" };

export default function ReplayPage() {
  return (
    <>
      <h1>Watch a replay</h1>
      <p className="muted" style={{ margin: "4px 0 20px", maxWidth: 640 }}>
        Your browser re-runs the match with the real engine and checks the result against the one in the file. Save one
        with <span className="mono">papersseum play my_agent.py --save-replay game.jsonl.gz</span>, or download one from
        any <Link href="/matches">match</Link>.
      </p>
      <ReplayDrop />
    </>
  );
}
