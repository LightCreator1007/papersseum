// Wording for the check card on /me. Only promise "a few minutes" when the queue is short
// enough for that to be true; otherwise state the number ahead.
export const SHORT_QUEUE = 3;

type Wait = { stage: "queued" | "checking"; ahead: number | null; paused: boolean; stuck: boolean };

const UPDATES = "This page updates on its own.";

export function waitLine({ stage, ahead, paused, stuck }: Wait): string {
  if (paused || stuck) return UPDATES;
  if (stage === "checking") return `Usually a few minutes. ${UPDATES}`;
  if (ahead === null) return `Waiting for a checker. ${UPDATES}`;
  if (ahead < SHORT_QUEUE) return `Usually a few minutes. ${UPDATES}`;
  return `${ahead} uploads ahead of yours. ${UPDATES}`;
}

// The "In line" step while queued. A null count here means the queue couldn't be read.
export function inLine(ahead: number | null): string {
  if (ahead === null) return "Waiting";
  if (ahead === 0) return "Next in line";
  return `${ahead} ahead of you`;
}
