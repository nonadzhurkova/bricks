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

  it("never places two indestructible bricks adjacent (including diagonally) — avoids maze-like dead walls", () => {
    for (const level of [9, 15, 20, 30, 50, 78, 81, 90, 120, 200, 500]) {
      const def = generateEndlessLevel(level);
      const grid = def.grid.map((row) => [...row]);
      const positions: [number, number][] = [];
      grid.forEach((row, r) => row.forEach((ch, c) => ch === "I" && positions.push([r, c])));

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const [r1, c1] = positions[i];
          const [r2, c2] = positions[j];
          const isAdjacent = Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
          expect(isAdjacent).toBe(false);
        }
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

  it("caps explosive bricks at a small fixed count, not scaled with level/density", () => {
    for (const level of [9, 20, 50, 100, 300, 900]) {
      const def = generateEndlessLevel(level);
      const explosiveCount = [...def.grid.join("")].filter((c) => c === "E").length;
      expect(explosiveCount).toBeLessThanOrEqual(4);
    }
  });

  it("never places two explosive bricks adjacent (including diagonally)", () => {
    for (const level of [9, 15, 20, 30, 50, 80, 120, 200, 500]) {
      const def = generateEndlessLevel(level);
      const grid = def.grid.map((row) => [...row]);
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
    }
  });

  it("never places explosive bricks in the always-clear bottom rows", () => {
    for (const level of [9, 20, 50, 100]) {
      const def = generateEndlessLevel(level);
      const lastTwoRows = def.grid.slice(-2).join("");
      expect(lastTwoRows.includes("E")).toBe(false);
    }
  });

  it("caps regenerating bricks at a small fixed count, not scaled with level/density", () => {
    for (const level of [9, 20, 50, 100, 300, 900]) {
      const def = generateEndlessLevel(level);
      const count = [...def.grid.join("")].filter((c) => c === "G").length;
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("never places regenerating bricks in the always-clear bottom rows", () => {
    for (const level of [9, 20, 50, 100]) {
      const def = generateEndlessLevel(level);
      const lastTwoRows = def.grid.slice(-2).join("");
      expect(lastTwoRows.includes("G")).toBe(false);
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
  const MAX_BALL_SPEED = 950;

  it("matches the plain linear model through level 8 (and up through the linear ramp's end)", () => {
    for (const level of [1, 4, 8, 20, 30]) {
      expect(endlessBaseSpeed(level, base, perLevel)).toBeCloseTo(base + (level - 1) * perLevel);
    }
  });

  it("never exceeds the absolute MAX_BALL_SPEED ceiling at any tested level", () => {
    for (const level of [1, 30, 31, 40, 60, 100, 200, 500, 900, 5000, 50000]) {
      expect(endlessBaseSpeed(level, base, perLevel)).toBeLessThanOrEqual(MAX_BALL_SPEED);
    }
  });

  it("keeps rising (never decreases) as level increases, staying strictly below the ceiling until it's effectively reached", () => {
    const speeds = [9, 30, 50, 100, 200, 500, 900].map((level) => endlessBaseSpeed(level, base, perLevel));
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]);
    }
  });

  it("gets very close to the ceiling by level 500 and stays there at much higher levels (asymptotic, not still climbing meaningfully)", () => {
    const at500 = endlessBaseSpeed(500, base, perLevel);
    const at5000 = endlessBaseSpeed(5000, base, perLevel);
    expect(at500).toBeGreaterThan(MAX_BALL_SPEED - 5);
    expect(at5000).toBeGreaterThan(MAX_BALL_SPEED - 1);
  });

  it("growth rate slows down sharply after the linear ramp ends (diminishing returns, not linear forever)", () => {
    const delta20to30 = endlessBaseSpeed(30, base, perLevel) - endlessBaseSpeed(20, base, perLevel);
    const delta910to920 = endlessBaseSpeed(920, base, perLevel) - endlessBaseSpeed(910, base, perLevel);
    expect(delta910to920).toBeLessThan(delta20to30);
  });

  it("level 100 stays clearly playable relative to level 20-30 (the old bug: level 100 was far faster with no ceiling)", () => {
    const at20 = endlessBaseSpeed(20, base, perLevel);
    const at100 = endlessBaseSpeed(100, base, perLevel);
    // level 100 is still faster than level 20 (difficulty keeps rising) but
    // by a bounded, reasonable margin rather than compounding indefinitely
    expect(at100).toBeGreaterThan(at20);
    expect(at100).toBeLessThan(at20 * 1.8);
  });
});
