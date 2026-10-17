// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { compose } from "@/lib/character/compose";
import { genomeFromSeed, serializeGenome, type BotGenome } from "@/lib/character/genome";

const saveAppearance = vi.hoisted(() => vi.fn());
vi.mock("@/features/upload/actions", () => ({ saveAppearance }));
import { Forge } from "@/components/me/forge";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const NAME = "ash_bot";
const KEY = `papersseum:appearance:${NAME}`;
const SAVED: BotGenome = { v: 1, head: 5, eyes: 1, antenna: 3, mouth: 3, pattern: 2, signature: 4 };
const LOCAL: BotGenome = { v: 1, head: 0, eyes: 0, antenna: 0, mouth: 0, pattern: 0, signature: 0 };

let host: HTMLDivElement;
let root: Root;

function mount(saved: BotGenome | null) {
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root.render(<Forge name={NAME} saved={saved} />));
}

// The big portrait, compared cell by cell with what the genome composes.
function drawn(): string[] {
  const svg = host.querySelector(`svg[aria-label="${NAME}'s character"]`)!;
  return [...svg.querySelectorAll("rect")].map((r) => `${r.getAttribute("x")},${r.getAttribute("y")},${r.getAttribute("data-part")}`);
}
const cellsFor = (g: BotGenome) => compose(g).map((c) => `${c.x},${c.y},${c.part}`);

// Clicks "Save character" and lets the form action and its transition finish.
async function save() {
  await act(async () => {
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({
    matches: q.includes("reduce"), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }));
});

beforeEach(() => {
  localStorage.clear();
  saveAppearance.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Forge", () => {
  it("opens on the account's saved character, over this browser's copy", () => {
    localStorage.setItem(KEY, serializeGenome(LOCAL));
    mount(SAVED);
    expect(drawn()).toEqual(cellsFor(SAVED));
  });

  it("falls back to this browser's copy when the account has none", () => {
    localStorage.setItem(KEY, serializeGenome(LOCAL));
    mount(null);
    expect(drawn()).toEqual(cellsFor(LOCAL));
  });

  it("falls back to the name's character when neither has one", () => {
    mount(null);
    expect(drawn()).toEqual(cellsFor(genomeFromSeed(NAME)));
  });

  it("drops this browser's copy once the account save succeeds", async () => {
    localStorage.setItem(KEY, serializeGenome(LOCAL));
    saveAppearance.mockResolvedValue({ ok: true, message: "Saved." });
    mount(null);
    await save();
    expect(saveAppearance).toHaveBeenCalledOnce();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the design in this browser when saving isn't available", async () => {
    saveAppearance.mockResolvedValue({ ok: false, reason: "unavailable", message: "Dev login." });
    mount(SAVED);
    await save();
    expect(localStorage.getItem(KEY)).toBe(serializeGenome(SAVED));
  });
});
