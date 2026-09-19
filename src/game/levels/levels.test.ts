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
});
