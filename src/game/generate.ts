import { BRICK_COLS, BRICK_ROWS } from "./constants";
import type { LevelDef } from "./levels/types";

/** Rows 0-1 are always left clear so a freshly-loaded level never starts with bricks touching the top wall immediately. */
const TOP_CLEAR_ROWS = 1;
/** Bottom rows are always left clear so bricks never encroach on paddle/launch space. */
const BOTTOM_CLEAR_ROWS = 2;

const PLAYABLE_ROWS = BRICK_ROWS - TOP_CLEAR_ROWS - BOTTOM_CLEAR_ROWS;

// ---- seeded PRNG (mulberry32) ----------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic seed derived from the endless level number, so the same level always generates identically. */
function seedForLevel(level: number): number {
  // simple integer hash, avoids trivially-similar seeds for adjacent levels
  let h = 2166136261 ^ level;
  h = Math.imul(h, 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 16777619);
  return h >>> 0;
}

// ---- difficulty curves --------------------------------------------------

/** Fraction of playable cells that are non-empty, ramping from ~55% to a cap of ~90%. */
function densityForLevel(level: number): number {
  const ramped = 0.55 + (level - 9) * 0.03;
  return Math.min(ramped, 0.9);
}

/** Brick-type weights shift toward tougher/hazard bricks as level rises, capped so it never becomes all-indestructible. */
function brickWeightsForLevel(level: number): { normal: number; reinforced: number; indestructible: number; explosive: number } {
  const t = Math.min((level - 9) / 20, 1); // 0 at level 9, 1 by level 29+

  return {
    normal: 0.55 - t * 0.25,
    reinforced: 0.25 + t * 0.15,
    // indestructible is intentionally capped low — it's a hazard/maze accent,
    // never allowed to dominate the mix (see MAX_INDESTRUCTIBLE_RATIO below)
    indestructible: 0.1 + t * 0.1,
    explosive: 0.1 + t * 0.1,
  };
}

/** Hard ceiling on indestructible share of the *placed* bricks, independent of the weight roll above. */
const MAX_INDESTRUCTIBLE_RATIO = 0.22;

/**
 * Ball base speed grows without bound past level 8 in the plain linear model
 * (see physics/speed.ts baseSpeedForLevel); this multiplier caps it so
 * endless mode never becomes physically unplayable at very high levels.
 * Applied uniformly via cappedBaseSpeedForLevel in the render engine.
 */
export const ENDLESS_SPEED_CAP_MULTIPLIER = 2.2;

// ---- generation ----------------------------------------------------------

export type Cell = "." | "N" | "R" | "I" | "E";

/** Maps brickWeightsForLevel's named keys to the single-char grid codes BRICK_CHAR_MAP expects. */
const TYPE_TO_CHAR: Record<string, Cell> = {
  normal: "N",
  reinforced: "R",
  indestructible: "I",
  explosive: "E",
};

function weightedPick(rng: () => number, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * Builds a raw candidate grid (may be unsolvable — caller validates and
 * regenerates with a bumped seed if needed).
 */
function buildCandidateGrid(level: number, rng: () => number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: BRICK_ROWS }, () => Array(BRICK_COLS).fill("."));
  const density = densityForLevel(level);
  const weights = brickWeightsForLevel(level);

  let placed = 0;
  let indestructiblePlaced = 0;

  for (let row = TOP_CLEAR_ROWS; row < TOP_CLEAR_ROWS + PLAYABLE_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      if (rng() > density) continue;

      let type = TYPE_TO_CHAR[weightedPick(rng, weights)];

      // enforce the indestructible ceiling by re-rolling into a breakable type
      if (type === "I" && (placed === 0 || indestructiblePlaced / (placed + 1) > MAX_INDESTRUCTIBLE_RATIO)) {
        type = TYPE_TO_CHAR[
          weightedPick(rng, { normal: weights.normal, reinforced: weights.reinforced, explosive: weights.explosive })
        ];
      }

      grid[row][col] = type;
      placed++;
      if (type === "I") indestructiblePlaced++;
    }
  }

  return grid;
}

/**
 * A layout is solvable if every breakable brick is reachable by some
 * sequence of ball impacts starting from the open play field. Breakable
 * bricks (normal/reinforced/explosive) don't block that path — they can be
 * destroyed to open it — only indestructible bricks and the grid edges do.
 * So: flood-fill from the boundary through every cell that is empty OR
 * breakable, blocked only by indestructible cells; any breakable brick the
 * flood-fill never reaches is fully walled in by indestructible bricks and
 * can never be broken — that's the only case this rejects.
 */
export function isSolvable(grid: Cell[][]): boolean {
  const rows = grid.length;
  const cols = grid[0].length;

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: [number, number][] = [];

  const passable = (row: number, col: number) => grid[row][col] !== "I";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const onBoundary = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      if (onBoundary && passable(row, col) && !visited[row][col]) {
        visited[row][col] = true;
        queue.push([row, col]);
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
    const [row, col] = queue.pop()!;
    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited[nr][nc]) continue;
      if (!passable(nr, nc)) continue;
      visited[nr][nc] = true;
      queue.push([nr, nc]);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = grid[row][col];
      if (cell === "." || cell === "I") continue;
      if (!visited[row][col]) return false;
    }
  }

  return true;
}

function gridToRows(grid: Cell[][]): string[] {
  return grid.map((row) => row.join(""));
}

const MAX_GENERATION_ATTEMPTS = 25;

/**
 * Generates a deterministic (seeded by level number) brick layout for
 * endless mode levels (9+). Density, brick-type mix, and ball speed all
 * scale with the level number. Regenerates with a bumped seed up to
 * MAX_GENERATION_ATTEMPTS times if the candidate layout isn't solvable
 * (i.e. indestructible bricks fully wall off a pocket of breakable ones);
 * falls back to an empty-indestructible-free grid on the (practically
 * unreachable) case that every attempt fails.
 */
export function generateEndlessLevel(level: number): LevelDef {
  const baseSeed = seedForLevel(level);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const rng = mulberry32(baseSeed + attempt * 104729);
    const grid = buildCandidateGrid(level, rng);
    if (isSolvable(grid)) {
      return {
        id: level,
        name: `Endless ${level}`,
        grid: gridToRows(grid),
      };
    }
  }

  // Fallback: same density/mix pass but with indestructible bricks stripped
  // out entirely, which is always solvable (no walls to enclose anything).
  const fallbackRng = mulberry32(baseSeed);
  const grid = buildCandidateGrid(level, fallbackRng).map((row) =>
    row.map((cell) => (cell === "I" ? "N" : cell)),
  );
  return {
    id: level,
    name: `Endless ${level}`,
    grid: gridToRows(grid as Cell[][]),
  };
}
