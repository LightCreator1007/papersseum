import type { Theme } from "@/features/replay/replay-format";

// The board follows the site theme: an explicit data-theme on <html> wins,
// otherwise the system setting.
export function currentBoardTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function onBoardThemeChange(apply: (theme: Theme) => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const fire = () => apply(currentBoardTheme());
  media.addEventListener("change", fire);
  window.addEventListener("themechange", fire);
  return () => {
    media.removeEventListener("change", fire);
    window.removeEventListener("themechange", fire);
  };
}
