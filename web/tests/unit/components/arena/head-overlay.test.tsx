// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { compose } from "@/lib/character/compose";
import { genomeFromSeed, type BotGenome } from "@/lib/character/genome";
import { HeadOverlay } from "@/components/arena/head-overlay";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const SAVED: BotGenome = { v: 1, head: 5, eyes: 1, antenna: 3, mouth: 3, pattern: 2, signature: 4 };
const cellsOf = (svg: Element) =>
  [...svg.querySelectorAll("rect")].map((r) => `${r.getAttribute("x")},${r.getAttribute("y")},${r.getAttribute("data-part")}`);
const cellsFor = (g: BotGenome) => compose(g).map((c) => `${c.x},${c.y},${c.part}`);

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({
    matches: q.includes("reduce"), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }));
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("HeadOverlay", () => {
  it("rides each head with its saved character, or the one its name seeds", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    act(() =>
      root.render(
        <HeadOverlay
          width={100}
          height={100}
          heads={[[1, 1], [2, 2], null, null, null]}
          names={["forged", "plain", "c", "d", "e"]}
          appearances={[SAVED, null, null, null, null]}
          still
        />,
      ),
    );
    const [forged, plain] = [...host.querySelectorAll("svg")];
    expect(cellsOf(forged)).toEqual(cellsFor(SAVED));
    expect(cellsOf(plain)).toEqual(cellsFor(genomeFromSeed("plain")));
    act(() => root.unmount());
  });

  it("without appearances every head is seeded from its name, as before", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    act(() => root.render(<HeadOverlay width={100} height={100} heads={[[1, 1]]} names={["plain"]} still />));
    expect(cellsOf(host.querySelector("svg")!)).toEqual(cellsFor(genomeFromSeed("plain")));
    act(() => root.unmount());
  });
});
