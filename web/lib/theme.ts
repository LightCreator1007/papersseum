export type Theme = "system" | "light" | "dark";

const KEY = "theme";

export function readTheme(): Theme {
  let v: string | null = null;
  try {
    v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
  } catch {
    v = null; // storage blocked (private mode): fall back to the OS setting
  }
  return v === "light" || v === "dark" ? v : "system";
}

export function writeTheme(t: Theme): void {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // storage blocked: the choice still applies for this page view
  }
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  window.dispatchEvent(new Event("themechange"));
}

/** Runs before paint so a stored choice never flashes the other theme. */
export const THEME_BOOT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
