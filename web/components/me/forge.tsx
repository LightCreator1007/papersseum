"use client";

import { useActionState, useState, useSyncExternalStore, type CSSProperties } from "react";
import { saveAppearance, type ActionState } from "@/features/upload/actions";
import { BotCharacter } from "@/components/character/bot-character";
import { Button } from "@/components/ui/button";
import {
  genomeFromSeed,
  parseGenome,
  PART_COUNTS,
  PART_NAMES,
  serializeGenome,
  type BotGenome,
  type GenomePart,
} from "@/lib/character/genome";
import styles from "./forge.module.css";

const PARTS: { key: GenomePart; label: string }[] = [
  { key: "head", label: "Head" },
  { key: "eyes", label: "Eyes" },
  { key: "antenna", label: "Antenna" },
  { key: "mouth", label: "Mouth" },
  { key: "pattern", label: "Pattern" },
  { key: "signature", label: "Colour" },
];

const storageKey = (name: string) => `papersseum:appearance:${name}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStored(name: string): BotGenome | null {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? parseGenome(JSON.parse(raw)) : null;
  } catch {
    return null; // storage blocked or the saved value is unreadable: fall back to the default
  }
}

// Serialised so useSyncExternalStore compares a stable string, not a new object.
function readStoredKey(name: string): string | null {
  const g = readStored(name);
  return g ? serializeGenome(g) : null;
}

export function Forge({ name, saved }: { name: string; saved: BotGenome | null }) {
  const storedKey = useSyncExternalStore(subscribe, () => readStoredKey(name), () => null);
  const base = saved ?? (storedKey ? parseGenome(JSON.parse(storedKey)) : null) ?? genomeFromSeed(name);
  const [draft, setDraft] = useState<BotGenome | null>(null);
  const g = draft ?? base;

  const [state, save, pending] = useActionState(
    async (prev: ActionState, form: FormData): Promise<ActionState> => {
      const res = await saveAppearance(prev, form);
      if (res.ok) {
        // Saved on the account, which now wins: drop this browser's older copy.
        try {
          localStorage.removeItem(storageKey(name));
          window.dispatchEvent(new StorageEvent("storage"));
        } catch {
          // storage blocked: there's no copy to drop
        }
        return res;
      }
      if (res.reason !== "unavailable") return res;
      // Saving on the account is off (dev login, or the database function is missing): keep the design in this browser meanwhile.
      try {
        localStorage.setItem(storageKey(name), String(form.get("appearance")));
        window.dispatchEvent(new StorageEvent("storage"));
      } catch {
        return { ok: false, message: "Saving isn't switched on yet, and this browser blocked local storage." };
      }
      return { ok: true, message: "Saved in this browser. It shows everywhere once the organisers switch saving on." };
    },
    { ok: true, message: "" },
  );

  const set = (key: GenomePart, value: number) => setDraft({ ...g, [key]: value });
  const step = (key: GenomePart, by: number) => set(key, (g[key] + by + PART_COUNTS[key]) % PART_COUNTS[key]);
  const accent = `var(--slot-${g.signature})`;

  return (
    <div className={styles.forge}>
      <div className={styles.stage} style={{ "--forge-accent": accent } as CSSProperties}>
        <div key={serializeGenome(g)} className={styles.pop}>
          <BotCharacter genome={g} size={208} accent={accent} state="idle" label={`${name}'s character`} lookAt />
        </div>
        <div className={styles.sizes} aria-hidden>
          {[24, 48].map((s) => (
            <BotCharacter key={s} genome={g} size={s} accent={accent} state="still" label="" />
          ))}
        </div>
        <p className={styles.name}>{name}</p>
      </div>

      <div className={styles.controls}>
        {PARTS.map(({ key, label }) => (
          <fieldset key={key} className={styles.part}>
            <legend>{label}</legend>
            <div className={styles.options}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => step(key, -1)}
                aria-label={`Previous ${label.toLowerCase()}`}
              >
                ‹
              </button>
              {PART_NAMES[key].map((option, i) => (
                <button
                  key={option}
                  type="button"
                  className={styles.option}
                  aria-pressed={g[key] === i}
                  aria-label={key === "signature" ? `Colour ${i + 1}` : undefined}
                  onClick={() => set(key, i)}
                  data-swatch={key === "signature" || undefined}
                  style={key === "signature" ? ({ "--chip": `var(--slot-${i})` } as CSSProperties) : undefined}
                >
                  {key === "signature" ? <span className={styles.swatch} aria-hidden /> : option}
                </button>
              ))}
              <button
                type="button"
                className={styles.arrow}
                onClick={() => step(key, 1)}
                aria-label={`Next ${label.toLowerCase()}`}
              >
                ›
              </button>
            </div>
          </fieldset>
        ))}

        <form action={save} className={styles.actions}>
          <input type="hidden" name="appearance" value={serializeGenome(g)} />
          <Button type="submit" pending={pending} pendingLabel="Saving…">
            Save character
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(genomeFromSeed(`${name}:${Date.now()}`))}>
            Randomise
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(genomeFromSeed(name))}>
            Reset to default
          </Button>
        </form>
        {state.message && (
          <p className={styles.msg} data-ok={state.ok} role={state.ok ? "status" : "alert"}>
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
