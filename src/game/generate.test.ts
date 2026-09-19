import { describe, expect, it } from "vitest";
import { generateEndlessLevel, isSolvable, endlessBaseSpeed, type Cell } from "./generate";
import { BRICK_CHAR_MAP } from "./brickTypes";
import { BRICK_COLS, BRICK_ROWS } from "./constants";

describe("generateEndlessLevel", () => {
  it("produces a grid with valid dimensions and only known brick chars", () => {
    for (const level of [9, 12, 20, 35, 60]) {
      const def = generateEndlessLevel(level);
      expect(def.grid).toHaveLength(BRICK_ROWS);
      def.grid.forEach((row) => {
        expect(row).toHaveLength(BRICK_COLS);
        for (const ch of row) {
          expect(ch === "." || ch in BRICK_CHAR_MAP).toBe(true);
        }
      });
    }
  });

  it("is deterministic for a given level number (seeded)", () => {
    const a = generateEndlessLevel(15);
    const b = generateEndlessLevel(15);
    expect(a.grid).toEqual(b.grid);
  });

  it("produces different layouts for different level numbers", () => {
    const a = generateEndlessLevel(9);
    const b = generateEndlessLevel(10);
    expect(a.grid).not.toEqual(b.grid);
  });

  it("never fully encloses a breakable brick behind indestructible walls (solvable)", () => {
    // A brick is reachable if there's a path from the grid boundary through
    // cells that are empty OR breakable (breakable bricks don't block a
    // path — they can be destroyed to open it), blocked only by
    // indestructible cells. Re-derive that check independently of
    // generate.ts's internal isSolvable so this test doesn't just re-assert
    // the implementation.
    for (const level of [9, 14, 22, 40, 75, 120]) {
      const def = generateEndlessLevel(level);
      const grid = def.grid.map((row) => [...row]);
      const rows = grid.length;
      const cols = grid[0].length;

      const passable = (r: number, c: number) => grid[r][c] !== "I";

      const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
      const queue: [number, number][] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const onBoundary = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
          if (onBoundary && passable(r, c) && !visited[r][c]) {
            visited[r][c] = true;
            queue.push([r, c]);
          }
        }
      }
      const deltas = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      while (queue.length > 0) {
        const [r, c] = queue.pop()!;
        for (const [dr, dc] of deltas) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (visited[nr][nc] || !passable(nr, nc)) continue;
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          if (cell === "." || cell === "I") continue;
          expect(visited[r][c]).toBe(true);
        }
      }
    }
  });

  it("caps indestructible brick share well below full walling", () => {
    for (const level of [9, 30, 80, 150]) {
      const def = generateEndlessLevel(level);
      const all = def.grid.join("");
      const total = [...all].filter((c) => c !== ".").length;
      const indestructible = [...all].filter((c) => c === "I").length;
      if (total > 0) {
        expect(indestructible / total).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it("has at least one brick at every tested level", () => {
    for (const level of [9, 10, 50, 200]) {
      const def = generateEndlessLevel(level);
      const hasBrick = def.grid.some((row) => [...row].some((ch) => ch !== "."));
      expect(hasBrick).toBe(true);
    }
  });
});

describe("isSolvable", () => {
  it("rejects a breakable brick fully walled in by indestructible bricks", () => {
    const rows: Cell[][] = [
      [".", ".", ".", ".", "."],
      [".", "I", "I", "I", "."],
      [".", "I", "N", "I", "."],
      [".", "I", "I", "I", "."],
      [".", ".", ".", ".", "."],
    ];
    expect(isSolvable(rows)).toBe(false);
  });

  it("accepts the same brick when the wall has a single gap", () => {
    const rows: Cell[][] = [
      [".", ".", ".", ".", "."],
      [".", "I", "I", "I", "."],
      [".", ".", "N", "I", "."], // gap on the left of the pocket
      [".", "I", "I", "I", "."],
      [".", ".", ".", ".", "."],
    ];
    expect(isSolvable(rows)).toBe(true);
  });

  it("accepts a dense pack of breakable bricks with no indestructible walls at all", () => {
    const rows: Cell[][] = [
      [".", ".", ".", ".", "."],
      ["N", "N", "R", "N", "R"],
      ["R", "N", "E", "R", "N"],
      ["N", "R", "N", "N", "R"],
      [".", ".", ".", ".", "."],
    ];
    expect(isSolvable(rows)).toBe(true);
  });

  it("accepts a breakable brick reachable only by breaking through other breakable bricks first", () => {
    const rows: Cell[][] = [
      [".", ".", ".", ".", "."],
      [".", "I", "I", "I", "."],
      [".", "I", "R", "N", "."], // brick at (2,2) is walled on 3 sides but
      [".", "I", "I", "I", "."], // open toward (2,3), a breakable neighbor
      [".", ".", ".", ".", "."],
    ];
    expect(isSolvable(rows)).toBe(true);
  });
});

describe("endlessBaseSpeed", () => {
  const base = 260;
  const perLevel = 14;

  it("matches the plain linear model through level 8", () => {
    for (const level of [1, 4, 8]) {
      expect(endlessBaseSpeed(level, base, perLevel)).toBeCloseTo(base + (level - 1) * perLevel);
    }
  });

  it("keeps climbing indefinitely past level 8, never capping", () => {
    const speeds = [9, 50, 200, 900, 5000].map((level) => endlessBaseSpeed(level, base, perLevel));
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
    }
  });

  it("level 900 is meaningfully faster than level 90 (no plateau)", () => {
    const at90 = endlessBaseSpeed(90, base, perLevel);
    const at900 = endlessBaseSpeed(900, base, perLevel);
    expect(at900).toBeGreaterThan(at90 * 1.05);
  });

  it("growth rate slows down at higher levels (logarithmic, not linear forever)", () => {
    const delta10to20 = endlessBaseSpeed(20, base, perLevel) - endlessBaseSpeed(10, base, perLevel);
    const delta910to920 = endlessBaseSpeed(920, base, perLevel) - endlessBaseSpeed(910, base, perLevel);
    expect(delta910to920).toBeLessThan(delta10to20);
  });
});
