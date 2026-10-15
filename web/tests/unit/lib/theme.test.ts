// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { readTheme, writeTheme } from "@/lib/theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  it("defaults to system and sets no attribute", () => {
    expect(readTheme()).toBe("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("writes dark to storage and the html attribute", () => {
    writeTheme("dark");
    expect(readTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("system removes the attribute", () => {
    writeTheme("light");
    writeTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("ignores garbage in storage", () => {
    localStorage.setItem("theme", "neon");
    expect(readTheme()).toBe("system");
  });
  it("announces the change so canvases can repaint", () => {
    let fired = 0;
    window.addEventListener("themechange", () => fired++);
    writeTheme("dark");
    expect(fired).toBe(1);
  });
});
