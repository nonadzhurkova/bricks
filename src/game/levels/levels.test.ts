import { describe, expect, it } from "vitest";
import { levels } from "./index";
import { BRICK_CHAR_MAP } from "../brickTypes";
import { BRICK_COLS, BRICK_ROWS } from "../constants";

describe("level grids", () => {
  it("has exactly 8 levels", () => {
    expect(levels).toHaveLength(8);
  });

  it("each level has consistent, valid grid dimensions and chars", () => {
    levels.forEach((level) => {
      expect(level.grid).toHaveLength(BRICK_ROWS);
      level.grid.forEach((row) => {
        expect(row).toHaveLength(BRICK_COLS);
        for (const ch of row) {
          expect(ch === "." || ch in BRICK_CHAR_MAP).toBe(true);
        }
      });
    });
  });

  it("each level has at least one brick", () => {
    levels.forEach((level) => {
      const hasBrick = level.grid.some((row) => [...row].some((ch) => ch !== "."));
      expect(hasBrick).toBe(true);
    });
  });

  it("levels 1-2 use only normal bricks", () => {
    for (const id of [1, 2]) {
      const level = levels[id - 1];
      const chars = new Set(level.grid.join(""));
      chars.delete(".");
      expect([...chars]).toEqual(["N"]);
    }
  });

  it("levels 7-8 include an explosive brick", () => {
    for (const id of [7, 8]) {
      const level = levels[id - 1];
      expect(level.grid.join("").includes("E")).toBe(true);
    }
  });

  it("no level places two explosive bricks adjacent (including diagonally)", () => {
    levels.forEach((level) => {
      const grid = level.grid.map((row) => [...row]);
      const positions: [number, number][] = [];
      grid.forEach((row, r) => row.forEach((ch, c) => ch === "E" && positions.push([r, c])));

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const [r1, c1] = positions[i];
          const [r2, c2] = positions[j];
          const isAdjacent = Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
          expect(isAdjacent).toBe(false);
        }
      }
    });
  });

  it("no level exceeds a small fixed explosive brick count", () => {
    levels.forEach((level) => {
      const explosiveCount = [...level.grid.join("")].filter((c) => c === "E").length;
      expect(explosiveCount).toBeLessThanOrEqual(4);
    });
  });

  it("none of the 8 hand-built levels use the regenerating brick type (endless-mode only)", () => {
    levels.forEach((level) => {
      expect(level.grid.join("").includes("G")).toBe(false);
    });
  });
});
