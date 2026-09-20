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
//
// Level 8 (the hardest hand-built level) sits at ~69% brick density, ~56
// total hit-points, and a base speed of 358px/s (260 + 7*14). Endless mode
// (9+) needs to pick up at least that hard and keep climbing indefinitely —
// density alone can't carry that past the ~90% grid ceiling, so once it
// caps, ball speed and brick toughness keep rising instead so level 900 is
// still clearly harder than level 90.

/** Fraction of playable cells that are non-empty: starts at level 8's own density, ramps to a ~92% ceiling by level ~40. */
function densityForLevel(level: number): number {
  const t = Math.min((level - 9) / 31, 1); // 0 at level 9, 1 by level 40+
  const ramped = 0.7 + t * 0.22;
  return Math.min(ramped, 0.92);
}

/**
 * Brick-type weights shift toward tougher/hazard bricks as level rises. The
 * ramp continues (slowly) indefinitely past its initial 20-level stretch —
 * unlike density, toughness has no natural grid-size ceiling, so it's one
 * of the two axes (with speed) that keeps endless mode getting harder well
 * past the point brick density maxes out.
 *
 * Covers the main placement pass only — normal/reinforced/indestructible.
 * Explosive is deliberately NOT part of this roll: it's placed afterward by
 * placeExplosiveBricks as a small fixed-count pass (see
 * EXPLOSIVE_BRICK_CAP), not scaled with density/level like the other types,
 * so endless mode's growing brick count never proportionally increases how
 * many explosive bricks appear.
 */
function brickWeightsForLevel(level: number): { normal: number; reinforced: number; indestructible: number } {
  const t = 1 - Math.exp(-(level - 9) / 60); // approaches 1 asymptotically, never fully plateaus

  return {
    normal: Math.max(0.65 - t * 0.35, 0.3),
    reinforced: 0.25 + t * 0.2,
    // indestructible is intentionally capped low — it's a hazard/maze accent,
    // never allowed to dominate the mix (see MAX_INDESTRUCTIBLE_RATIO below)
    indestructible: 0.1 + t * 0.1,
  };
}

/** Hard ceiling on indestructible share of the *placed* bricks, independent of the weight roll above. */
const MAX_INDESTRUCTIBLE_RATIO = 0.22;

/**
 * Fixed cap on explosive bricks per level, regardless of level number or
 * total brick count — explosion radius is a 3x3 grid-neighbor blast (see
 * GameEngine.triggerExplosion), so a handful is already a significant
 * board-clearing tool; scaling this with endless mode's growing density
 * would make high levels degenerate into chain-explosion spam.
 */
const EXPLOSIVE_BRICK_CAP = 4;

/** Retries allowed when placeExplosiveBricks can't find a spacing-legal cell for the next explosive brick. */
const EXPLOSIVE_PLACEMENT_ATTEMPTS = 10;

/** True if (row, col) is one of the 8 immediate grid neighbors of (r2, c2), or the same cell. */
function isAdjacentOrSame(row: number, col: number, r2: number, c2: number): boolean {
  return Math.abs(row - r2) <= 1 && Math.abs(col - c2) <= 1;
}

/**
 * Final pass: converts up to EXPLOSIVE_BRICK_CAP already-placed breakable
 * cells (normal/reinforced) to explosive, enforcing that no two explosive
 * bricks are ever adjacent (including diagonally) so one hit can't chain
 * into a second explosion by placement chance alone. Mutates `grid` in
 * place. Each placement attempt picks a random breakable cell and retries
 * up to EXPLOSIVE_PLACEMENT_ATTEMPTS times if it violates spacing against
 * already-placed explosive bricks; if attempts run out, fewer than the cap
 * are placed rather than looping indefinitely.
 */
function placeExplosiveBricks(grid: Cell[][], rng: () => number): void {
  const candidates: [number, number][] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === "N" || grid[row][col] === "R") {
        candidates.push([row, col]);
      }
    }
  }

  const placed: [number, number][] = [];

  for (let i = 0; i < EXPLOSIVE_BRICK_CAP && candidates.length > 0; i++) {
    let attempt = 0;
    let placedThisRound = false;

    while (attempt < EXPLOSIVE_PLACEMENT_ATTEMPTS && candidates.length > 0) {
      const idx = Math.floor(rng() * candidates.length);
      const [row, col] = candidates[idx];

      const tooClose = placed.some(([pr, pc]) => isAdjacentOrSame(row, col, pr, pc));
      if (tooClose) {
        attempt++;
        continue;
      }

      grid[row][col] = "E";
      placed.push([row, col]);
      candidates.splice(idx, 1);
      placedThisRound = true;
      break;
    }

    if (!placedThisRound) break; // couldn't satisfy spacing within the attempt budget — stop, place fewer than the cap
  }
}

/**
 * Fixed cap on regenerating bricks per level, same reasoning as
 * EXPLOSIVE_BRICK_CAP — a background "keeps coming back" mechanic should
 * stay a rare accent, not scale with endless mode's growing brick density
 * (which would otherwise turn very high levels into mostly-regenerating
 * boards that never actually clear).
 */
const REGENERATING_BRICK_CAP = 4;

/**
 * Final pass (runs after explosive placement, on whatever normal/reinforced
 * cells remain): converts up to REGENERATING_BRICK_CAP of them to
 * regenerating. No strict spacing rule is required here (unlike explosive),
 * but picks are spread across column bands — one per band — so the cap
 * doesn't cluster into a single dead zone on a dense board; if a band runs
 * out of candidates, remaining picks just draw from whatever's left.
 */
function placeRegeneratingBricks(grid: Cell[][], rng: () => number): void {
  const candidates: [number, number][] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === "N" || grid[row][col] === "R") {
        candidates.push([row, col]);
      }
    }
  }
  if (candidates.length === 0) return;

  const cols = grid[0].length;
  const bandWidth = Math.max(1, Math.ceil(cols / REGENERATING_BRICK_CAP));

  for (let i = 0; i < REGENERATING_BRICK_CAP; i++) {
    const bandStart = i * bandWidth;
    const bandEnd = bandStart + bandWidth;
    const inBand = candidates.filter(([, col]) => col >= bandStart && col < bandEnd);
    const pool = inBand.length > 0 ? inBand : candidates;
    if (pool.length === 0) break;

    const pick = pool[Math.floor(rng() * pool.length)];
    const [row, col] = pick;
    grid[row][col] = "G";

    const idx = candidates.findIndex(([r, c]) => r === row && c === col);
    if (idx !== -1) candidates.splice(idx, 1);
  }
}

/**
 * Ball base speed for endless levels: matches the same per-level increase
 * used by the hand-built levels through level 8, then keeps climbing at a
 * slower, purely logarithmic rate — meaningfully faster at level 900 than
 * level 90, but without the runaway growth of staying linear forever.
 * Applied in the render engine via GameEngine's speed calc.
 */
export function endlessBaseSpeed(level: number, baseSpeed: number, perLevelIncrease: number): number {
  if (level <= 8) return baseSpeed + (level - 1) * perLevelIncrease;

  const speedAtEight = baseSpeed + 7 * perLevelIncrease;
  const levelsIntoEndless = level - 8;
  // slow log growth: roughly +perLevelIncrease for the first level past 8,
  // tapering off so it never becomes literally unplayable at very high levels
  return speedAtEight + perLevelIncrease * Math.log2(levelsIntoEndless + 1) * 4;
}

// ---- generation ----------------------------------------------------------

export type Cell = "." | "N" | "R" | "I" | "E" | "G";

/** Maps brickWeightsForLevel's named keys to the single-char grid codes BRICK_CHAR_MAP expects. */
const TYPE_TO_CHAR: Record<string, Cell> = {
  normal: "N",
  reinforced: "R",
  indestructible: "I",
  explosive: "E",
  regenerating: "G",
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
          weightedPick(rng, { normal: weights.normal, reinforced: weights.reinforced })
        ];
      }

      grid[row][col] = type;
      placed++;
      if (type === "I") indestructiblePlaced++;
    }
  }

  placeExplosiveBricks(grid, rng);
  placeRegeneratingBricks(grid, rng);

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
