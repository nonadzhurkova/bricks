import { BRICK_COLS, BRICK_ROWS, MAX_BALL_SPEED } from "./constants";
import type { LevelDef } from "./levels/types";

/** Rows 0-1 are always left clear so a freshly-loaded level never starts with bricks touching the top wall immediately. */
const TOP_CLEAR_ROWS = 1;
/** Bottom rows are always left clear so bricks never encroach on paddle/launch space. */
const BOTTOM_CLEAR_ROWS = 2;

/** Endless levels 9-49 keep the original fixed grid height (matches the 8 hand-built levels). */
const BASE_PLAYABLE_ROWS = BRICK_ROWS - TOP_CLEAR_ROWS - BOTTOM_CLEAR_ROWS;

/**
 * Levels-per-step and starting level for endless mode's playable-row growth.
 * Sparse layout templates (checkerboard, staggered rows, etc.) only cover a
 * fraction of their cells, so once density maxes out (~level 40) they can't
 * reach the same total brick count as a full rectangle no matter how high
 * density goes — there just aren't enough eligible cells. Growing the grid
 * instead of excluding those templates gives every template more room to
 * reach the level's target density, so shape variety and difficulty scaling
 * stop fighting each other. There's ample arena space for it (see
 * ARENA_HEIGHT/PADDLE_Y_OFFSET) — 8 rows only reaches a third of the way
 * down even before this change.
 */
const ROW_GROWTH_STEP_LEVELS = 25;
const ROW_GROWTH_START_LEVEL = 25;

/**
 * Ceiling on playable rows so the brick field can never grow into the
 * paddle's safety margin — at BRICK_TOP_MARGIN=60/BRICK_HEIGHT=22/
 * BRICK_GAP=4, 15 playable rows (18 total with clear rows) leaves ~100px of
 * clearance above the paddle at PADDLE_Y_OFFSET=40; one more row would eat
 * into that margin. Reached around level 275 at the current growth rate.
 */
const MAX_PLAYABLE_ROWS = 15;

/** Extra playable rows (beyond BASE_PLAYABLE_ROWS) added every ROW_GROWTH_STEP_LEVELS levels, starting at ROW_GROWTH_START_LEVEL, capped at MAX_PLAYABLE_ROWS. */
export function playableRowsForLevel(level: number): number {
  if (level < ROW_GROWTH_START_LEVEL) return BASE_PLAYABLE_ROWS;
  const steps = Math.floor((level - ROW_GROWTH_START_LEVEL) / ROW_GROWTH_STEP_LEVELS) + 1;
  return Math.min(BASE_PLAYABLE_ROWS + steps, MAX_PLAYABLE_ROWS);
}

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
 * unlike density, toughness has no natural grid-size ceiling, so with ball
 * speed now capped and flattening out after SPEED_RAMP_LINEAR_UNTIL_LEVEL,
 * this is the main axis carrying endless mode's difficulty at high levels.
 * Time constant tightened from 60 to 35 levels so toughness picks up that
 * slack around the same level range (40-60) that speed stops climbing
 * meaningfully, instead of drifting toward its asymptote over 150-200
 * levels while speed was still the dominant difficulty source.
 *
 * Covers the main placement pass only — normal/reinforced/indestructible.
 * Explosive is deliberately NOT part of this roll: it's placed afterward by
 * placeExplosiveBricks as a small fixed-count pass (see
 * EXPLOSIVE_BRICK_CAP), not scaled with density/level like the other types,
 * so endless mode's growing brick count never proportionally increases how
 * many explosive bricks appear.
 */
function brickWeightsForLevel(level: number): { normal: number; reinforced: number; indestructible: number } {
  const t = 1 - Math.exp(-(level - 9) / 35); // approaches 1 asymptotically, never fully plateaus

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

/** True if any of (row, col)'s 8 grid neighbors already placed in `grid` is indestructible. */
function hasAdjacentIndestructible(grid: Cell[][], row: number, col: number): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) continue;
      if (grid[nr][nc] === "I") return true;
    }
  }
  return false;
}

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
 * Level past which base speed stops scaling linearly and starts decaying
 * asymptotically toward MAX_BALL_SPEED instead. Chosen so the familiar
 * linear ramp (used by the 8 hand-built levels too) continues a bit further
 * into endless mode before the curve bends — level 20-30 is where
 * playtesting still felt tracked/reactable.
 */
const SPEED_RAMP_LINEAR_UNTIL_LEVEL = 30;

/** Levels-to-63%-of-remaining-headroom time constant for the post-ramp decay curve — smaller = reaches the cap sooner. */
const SPEED_RAMP_DECAY_LEVELS = 30;

/**
 * Ball base speed for endless levels: linear (same per-level increase as
 * the 8 hand-built levels) through SPEED_RAMP_LINEAR_UNTIL_LEVEL, then an
 * exponential-decay curve that approaches MAX_BALL_SPEED asymptotically —
 * quick early growth, increasingly diminishing returns, and a real ceiling
 * it can get arbitrarily close to but never reach or exceed (so it never
 * needs a separate min() cap — the asymptote IS the cap). Replaces an
 * earlier version that used slow log growth past level 8, which still grew
 * unboundedly (just slowly) and made very high levels (e.g. 100+)
 * unplayably fast. Applied in the render engine via GameEngine's speed
 * calc; the in-level rally acceleration on top of this is separately
 * capped at the same MAX_BALL_SPEED (see physics/speed.ts).
 */
export function endlessBaseSpeed(level: number, baseSpeed: number, perLevelIncrease: number): number {
  if (level <= SPEED_RAMP_LINEAR_UNTIL_LEVEL) {
    return Math.min(baseSpeed + (level - 1) * perLevelIncrease, MAX_BALL_SPEED);
  }

  // Headroom can be zero or negative if the linear ramp already reached
  // MAX_BALL_SPEED by SPEED_RAMP_LINEAR_UNTIL_LEVEL (e.g. a lowered cap) —
  // clamp to 0 so the decay curve holds flat at the cap instead of the
  // exponential term flipping sign and making speed dip past the ramp.
  const speedAtRampStart = Math.min(
    baseSpeed + (SPEED_RAMP_LINEAR_UNTIL_LEVEL - 1) * perLevelIncrease,
    MAX_BALL_SPEED,
  );
  const remainingHeadroom = Math.max(MAX_BALL_SPEED - speedAtRampStart, 0);
  const levelsPastRamp = level - SPEED_RAMP_LINEAR_UNTIL_LEVEL;

  return (
    speedAtRampStart +
    remainingHeadroom * (1 - Math.exp(-levelsPastRamp / SPEED_RAMP_DECAY_LEVELS))
  );
}

// ---- layout templates -----------------------------------------------------
//
// Without a template, every level was just uniform-random noise over the
// same fixed 8-col x PLAYABLE_ROWS-row rectangle — different fill amounts,
// but always the same silhouette, which read as "the same level" across
// very different densities/levels. Templates fix that by masking which
// cells are even eligible to hold a brick; density/type rolls (and the
// difficulty curve behind them) still happen exactly as before, only
// within the masked-in cells, so a template changes shape, never how hard
// a level is.

interface LayoutTemplate {
  name: string;
  /** Rough fill weight, used to bias selection toward fuller shapes at high levels — see templateWeightForLevel. */
  tier: "sparse" | "medium" | "full";
  /** row is 0-indexed within the playable band (0..rows-1), col is 0..BRICK_COLS-1, rows is that level's total playable row count (see playableRowsForLevel). Returns true if this cell is eligible to hold a brick. */
  mask(row: number, col: number, rows: number): boolean;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    name: "full",
    tier: "full",
    mask: () => true,
  },
  {
    name: "pyramid",
    tier: "medium",
    // widens by one column on each side per row going down
    mask: (row, col, rows) => {
      const half = BRICK_COLS / 2;
      const width = Math.round(((row + 1) / rows) * half);
      return Math.abs(col - (half - 0.5)) < width;
    },
  },
  {
    name: "invertedPyramid",
    tier: "medium",
    mask: (row, col, rows) => {
      const half = BRICK_COLS / 2;
      const width = Math.round(((rows - row) / rows) * half);
      return Math.abs(col - (half - 0.5)) < width;
    },
  },
  {
    name: "diagonalBand",
    tier: "sparse",
    mask: (row, col, rows) => {
      const bandCenter = (row / Math.max(rows - 1, 1)) * (BRICK_COLS - 1);
      return Math.abs(col - bandCenter) <= 2.5;
    },
  },
  {
    name: "checkerboard",
    tier: "medium",
    mask: (row, col) => (row + col) % 2 === 0,
  },
  {
    name: "columnsWithCenterGap",
    tier: "medium",
    mask: (_row, col) => col < 3 || col >= BRICK_COLS - 3,
  },
  {
    name: "hollowFrame",
    tier: "sparse",
    mask: (row, col, rows) => row === 0 || row === rows - 1 || col === 0 || col === BRICK_COLS - 1,
  },
  {
    name: "staggeredRows",
    tier: "medium",
    mask: (row, col) => (row % 2 === 0 ? true : col % 2 === 0),
  },
  {
    name: "diamond",
    tier: "sparse",
    mask: (row, col, rows) => {
      const rowCenter = (rows - 1) / 2;
      const colCenter = (BRICK_COLS - 1) / 2;
      const rNorm = Math.abs(row - rowCenter) / (rows / 2);
      const cNorm = Math.abs(col - colCenter) / (BRICK_COLS / 2);
      return rNorm + cNorm <= 1.05;
    },
  },
];

/**
 * Per-tier selection weight given the level number — biases toward fuller
 * templates as level rises so shape variety never undercuts the intended
 * difficulty curve (a sparse template plus max density can still end up
 * with far fewer bricks than a full template, which would make a high
 * level feel easier by shape alone rather than by the density/toughness
 * curve that's supposed to carry difficulty).
 */
function tierWeightForLevel(tier: LayoutTemplate["tier"], level: number): number {
  const t = Math.min(Math.max((level - 9) / 60, 0), 1); // 0 at level 9, 1 by level ~69
  switch (tier) {
    case "sparse":
      return Math.max(1 - t, 0.15);
    case "medium":
      return 1;
    case "full":
      return 0.6 + t * 0.8;
  }
}

function pickLayoutTemplate(level: number, rng: () => number): LayoutTemplate {
  const weights = LAYOUT_TEMPLATES.map((tpl) => tierWeightForLevel(tpl.tier, level));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < LAYOUT_TEMPLATES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return LAYOUT_TEMPLATES[i];
  }
  return LAYOUT_TEMPLATES[LAYOUT_TEMPLATES.length - 1];
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
  const playableRows = playableRowsForLevel(level);
  const totalRows = TOP_CLEAR_ROWS + playableRows + BOTTOM_CLEAR_ROWS;
  const grid: Cell[][] = Array.from({ length: totalRows }, () => Array(BRICK_COLS).fill("."));
  const density = densityForLevel(level);
  const weights = brickWeightsForLevel(level);
  const template = pickLayoutTemplate(level, rng);

  // A template masks out cells (e.g. hollowFrame only covers ~40% of the
  // playable area), so filling masked-in cells at the same density used for
  // the full rectangle would make sparse templates produce far fewer total
  // bricks — turning shape choice into an unintended difficulty swing
  // (see the brick-count variance this caused per-level before this fix).
  // Rescale so the *expected total brick count* stays what the plain
  // rectangle at densityForLevel(level) would give, regardless of template;
  // capped at 1 for templates too sparse to hit that count even fully solid
  // (growing playableRowsForLevel over time is what keeps that cap from
  // binding at high levels — more cells to work with, same target density).
  let maskedCells = 0;
  for (let row = 0; row < playableRows; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      if (template.mask(row, col, playableRows)) maskedCells++;
    }
  }
  const totalCells = playableRows * BRICK_COLS;
  const effectiveDensity =
    maskedCells === 0 ? 0 : Math.min((density * totalCells) / maskedCells, 1);

  let placed = 0;
  let indestructiblePlaced = 0;

  for (let row = TOP_CLEAR_ROWS; row < TOP_CLEAR_ROWS + playableRows; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      if (!template.mask(row - TOP_CLEAR_ROWS, col, playableRows)) continue;
      if (rng() > effectiveDensity) continue;

      let type = TYPE_TO_CHAR[weightedPick(rng, weights)];

      // enforce the indestructible ceiling and no-adjacency rule by
      // re-rolling into a breakable type — two indestructible bricks
      // touching (including diagonally) can wall off narrow dead corridors
      // that make a layout feel like a maze rather than "hard but fair"
      if (
        type === "I" &&
        (placed === 0 ||
          indestructiblePlaced / (placed + 1) > MAX_INDESTRUCTIBLE_RATIO ||
          hasAdjacentIndestructible(grid, row, col))
      ) {
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
