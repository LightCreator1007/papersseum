"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/button";
import styles from "./get-started.module.css";

// Install, scaffold, check, upload. Commands and output follow papersseum/cli.py; the
// timing in the validate line is an example. The terminal holds its full text in the DOM
// from the first render: the typing is a CSS reveal (width in ch, steps per character)
// that only runs once the panel scrolls into view, so screen readers, no-JS and reduced
// motion all get the finished session.

const STEPS = [
  {
    title: "Install",
    body: "Python 3.11 or newer.",
    cmd: "pip install papersseum",
    out: ["Successfully installed papersseum"],
    slot: 1,
  },
  {
    title: "Scaffold",
    body: "Writes a starter Agent class that already plays.",
    cmd: "papersseum new my_agent.py",
    out: ["wrote my_agent.py", "next:  papersseum validate my_agent.py   then   papersseum eval my_agent.py"],
    slot: 2,
  },
  {
    title: "Check",
    body: "The upload scan and a full test match, on your machine.",
    cmd: "papersseum validate my_agent.py",
    out: [
      "static scan: ok",
      "playing a full match (your agent x2 + greedy, safe_expander, hunter) ...",
      "smoke match: ok (1800 decisions, slowest 4.2 ms, budget 50 ms)",
      "PASSED",
    ],
    slot: 3,
  },
] as const;

const UPLOAD = {
  title: "Upload",
  body: "Sign in and upload the file. It plays a test match, then joins the next round.",
  slot: 4,
};

const CHAR_MS = 34;
const ENTER_MS = 320;
const LINE_MS = 160;
const GAP_MS = 700;

// When each step starts, when each of its output lines appears, and when the whole run ends.
function schedule() {
  let t = 400;
  const steps = STEPS.map((s) => {
    const start = t;
    const typed = s.cmd.length * CHAR_MS;
    const out = s.out.map((_, k) => start + typed + ENTER_MS + k * LINE_MS);
    t = out[out.length - 1] + GAP_MS;
    return { start, out };
  });
  return { steps, end: t - GAP_MS + LINE_MS };
}
const TIMES = schedule();

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.copy}
        data-copied={copied || undefined}
        aria-label={`Copy command: ${text}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          } catch {
            setCopied(false); // clipboard blocked: the command is still selectable
          }
        }}
      >
        <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
      </button>
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

export function GetStarted() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"rest" | "arm" | "play">("rest");
  const [run, setRun] = useState(0);
  // Index of the step the terminal is on. 3 (upload) once the run is over, and at rest.
  const [active, setActive] = useState<number>(STEPS.length);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.8) return;
    setPhase("arm");
    setActive(-1);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("play");
          setRun((r) => r + 1);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -25% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Keep the step list in step with the typing.
  useEffect(() => {
    if (run === 0) return;
    const timers = TIMES.steps.map((s, i) => window.setTimeout(() => setActive(i), s.start));
    timers.push(window.setTimeout(() => setActive(STEPS.length), TIMES.end));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [run]);

  const replay = () => {
    setActive(-1);
    setPhase("play");
    setRun((r) => r + 1);
  };

  return (
    <div ref={ref} className={styles.panel}>
      <ol className={styles.steps}>
        {[...STEPS, UPLOAD].map((s, i) => (
          <li
            key={s.title}
            data-state={i < active ? "done" : i === active ? "active" : "todo"}
            aria-current={i === active ? "step" : undefined}
            style={{ "--c": `var(--slot-${s.slot})` } as CSSProperties}
          >
            <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
            <span className={styles.stepTitle}>{s.title}</span>
            <span className={styles.stepBody}>{s.body}</span>
          </li>
        ))}
      </ol>

      <div className={styles.term}>
        <div className={styles.bar}>
          <span className={styles.lights} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.path}>~/my-bot</span>
          <button type="button" className={styles.replay} onClick={replay} hidden={phase === "rest"}>
            Replay
          </button>
        </div>
        <div
          className={styles.screen}
          key={run}
          data-arm={phase === "arm" || undefined}
          data-play={phase === "play" || undefined}
        >
          {STEPS.map((s, i) => (
            <div key={s.cmd} className={styles.block}>
              <div
                className={styles.line}
                style={{ "--d": `${TIMES.steps[i].start}ms`, "--c": `var(--slot-${s.slot})` } as CSSProperties}
              >
                <span className={styles.prompt} aria-hidden="true">
                  $
                </span>
                <code className={styles.typed} style={{ "--len": s.cmd.length } as CSSProperties}>
                  {s.cmd}
                </code>
                <span className={styles.caret} aria-hidden="true" style={{ "--len": s.cmd.length } as CSSProperties} />
                <CopyButton text={s.cmd} />
              </div>
              {s.out.map((o, k) => (
                <div
                  key={k}
                  className={styles.out}
                  data-pass={o === "PASSED" || undefined}
                  style={{ "--d": `${TIMES.steps[i].out[k]}ms` } as CSSProperties}
                >
                  {o}
                </div>
              ))}
            </div>
          ))}
          <div className={styles.line} style={{ "--d": `${TIMES.end}ms` } as CSSProperties} aria-hidden="true">
            <span className={styles.prompt}>$</span>
            <span className={styles.idle} />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <ButtonLink href="/docs/getting-started">Read the getting started guide</ButtonLink>
        <ButtonLink href="/me" variant="ghost">
          Upload a bot
        </ButtonLink>
      </div>
    </div>
  );
}
