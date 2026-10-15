import { describe, expect, it } from "vitest";
import { firstName } from "@/lib/owner-name";

describe("firstName", () => {
  it("takes the first word of the owner name", () => {
    expect(firstName("Arunit Chakraborty")).toBe("Arunit");
    expect(firstName("  Ravi   Teja ")).toBe("Ravi");
    expect(firstName("Madonna")).toBe("Madonna");
  });

  it("gives null when there is no name", () => {
    expect(firstName(null)).toBeNull();
    expect(firstName(undefined)).toBeNull();
    expect(firstName("   ")).toBeNull();
  });
});
