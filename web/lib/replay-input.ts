// Checks on a replay file a visitor picks, made before the file is read.
export const MAX_REPLAY_BYTES = 1024 * 1024;

export function replayFileProblem(file: { size: number }): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_REPLAY_BYTES) return "That file is too big to be a replay; real ones are a few KB.";
  return null;
}
