import { describe, expect, it } from "vitest";
import { detectOpening } from "./opening-detect";

describe("detectOpening", () => {
  it("returns null for the start position", () => {
    expect(detectOpening([])).toBeNull();
  });

  it("returns null when the first move is not in book", () => {
    expect(detectOpening(["a3"])).toBeNull();
  });

  it("matches the Sicilian Najdorf by exact prefix", () => {
    const moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];
    const result = detectOpening(moves);
    expect(result?.name).toMatch(/Najdorf/i);
    expect(result?.eco).toBe("B90");
  });

  it("falls back to a shorter book name when extra moves continue out of book", () => {
    const result = detectOpening(["e4", "e5", "Nf3", "Nc6", "Bb5", "h6"]);
    expect(result?.name).toMatch(/Ruy Lopez/i);
  });

  it("prefers the longest matching line", () => {
    const result = detectOpening(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"]);
    expect(result?.name).toMatch(/Morphy/i);
  });

  it("recognizes the Queen's Gambit Accepted once the full book line is played", () => {
    const moves = ["d4", "d5", "c4", "dxc4", "Nf3", "Nf6", "e3", "e6"];
    const result = detectOpening(moves);
    expect(result?.name).toMatch(/Queen's Gambit Accepted/i);
  });

  it("does NOT claim a specific opening from a single-ply prefix", () => {
    expect(detectOpening(["d4"])).toBeNull();
    expect(detectOpening(["d4", "Nf6"])).toBeNull();
    expect(detectOpening(["e4", "e5"])).toBeNull();
  });
});
