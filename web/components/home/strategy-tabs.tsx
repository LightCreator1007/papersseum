"use client";

import { useState } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { genomeFromSeed } from "@/lib/character/genome";
import styles from "./home.module.css";

// The four baselines that ship with the package, plus the trained-net route.
// Descriptions follow README.md and papersseum/agents/*.py.
const STRATEGIES = [
  {
    id: "greedy",
    label: "Greedy",
    slot: 0,
    body: "Grinds small capture loops. Out, around, home, bank the land, repeat. Steady and hard to kill early.",
    cmd: "papersseum play my_agent.py --vs greedy --seed 7",
  },
  {
    id: "safe_expander",
    label: "Safe expander",
    slot: 1,
    body: "Draws square loops and runs home the moment a rival head comes within ten cells. Rarely dies, rarely leads.",
    cmd: "papersseum play my_agent.py --vs safe_expander --seed 7",
  },
  {
    id: "hunter",
    label: "Hunter",
    slot: 2,
    body: "Chases and cuts exposed trails. A kill steals the victim's land and a 1.5x speed burst, so it snowballs fast.",
    cmd: "papersseum play my_agent.py --vs hunter --seed 7",
  },
  {
    id: "random",
    label: "Random",
    slot: 3,
    body: "Picks straight, left or right at random. The floor: if you can't beat this, start with the starter template.",
    cmd: "papersseum eval my_agent.py --games 30",
  },
  {
    id: "neural",
    label: "Neural net",
    slot: 4,
    body: "Train anywhere, then pack the weights into your one file and run them with numpy in the sandbox.",
    cmd: "papersseum pack model.pt --into my_agent.py",
  },
] as const;

export function StrategyTabs() {
  const [active, setActive] = useState(0);
  const s = STRATEGIES[active];
  return (
    <div className={styles.tabsWrap}>
      <div className={styles.tabList} role="tablist" aria-label="Strategies">
        {STRATEGIES.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`strat-tab-${t.id}`}
            aria-selected={active === i}
            aria-controls="strat-panel"
            onClick={() => setActive(i)}
            className={styles.tab}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="strat-panel" role="tabpanel" aria-labelledby={`strat-tab-${s.id}`} className={styles.tabPanel} key={s.id}>
        <div className={styles.tabArt} style={{ "--c": `var(--slot-${s.slot})` } as React.CSSProperties}>
          <BotCharacter genome={genomeFromSeed(s.id)} size={120} accent={`var(--slot-${s.slot})`} state="idle" label={s.label} />
        </div>
        <div className={styles.tabCopy}>
          <p>{s.body}</p>
          <code>{s.cmd}</code>
        </div>
      </div>
    </div>
  );
}
