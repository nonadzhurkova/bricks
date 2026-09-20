import { BRICK_CHAR_MAP, type BrickType, BRICK_HIT_POINTS } from "./brickTypes";
import {
  BRICK_COLS,
  BRICK_GAP,
  BRICK_HEIGHT,
  BRICK_SIDE_MARGIN,
  BRICK_TOP_MARGIN,
  BRICK_WIDTH,
  DIAMOND_DROP_CHANCE,
  DIAMOND_MIN_LEVEL,
  POWERUP_DROP_CHANCE,
} from "./constants";
import type { LevelDef } from "./levels/types";
import { POWERUP_DROP_TABLE } from "./powerups";
import type { PowerUpType } from "./powerups";

export interface Brick {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BrickType;
  hitsRemaining: number;
  maxHits: number;
  powerUp: PowerUpType | null;
  alive: boolean;
  /** Regenerating bricks only: engine-clock ms timestamp when a dead one should regrow. Null otherwise/while alive. */
  regrowAt: number | null;
}

/** Minimal per-brick shape needed to persist/restore exact brick state (no derived x/y/width/height). */
export type SavedBrick = Pick<
  Brick,
  "id" | "col" | "row" | "type" | "hitsRemaining" | "maxHits" | "powerUp" | "alive" | "regrowAt"
>;

/**
 * Diamond is rolled independently of (before, not instead of) the normal
 * power-up table — a separate rare chance rather than one slot in the
 * weighted table, so adding it doesn't dilute how often the other
 * power-ups appear. Only eligible from DIAMOND_MIN_LEVEL onward.
 */
function pickPowerUp(rng: () => number, levelNumber: number): PowerUpType | null {
  if (levelNumber >= DIAMOND_MIN_LEVEL && rng() < DIAMOND_DROP_CHANCE) {
    return "diamond";
  }
  if (rng() > POWERUP_DROP_CHANCE) return null;
  const idx = Math.floor(rng() * POWERUP_DROP_TABLE.length);
  return POWERUP_DROP_TABLE[idx];
}

export function buildBricksFromLevel(level: LevelDef, rng: () => number = Math.random): Brick[] {
  const bricks: Brick[] = [];

  level.grid.forEach((rowStr, row) => {
    for (let col = 0; col < BRICK_COLS; col++) {
      const ch = rowStr[col];
      if (!ch || ch === ".") continue;
      const type = BRICK_CHAR_MAP[ch];
      if (!type) continue;

      const x = BRICK_SIDE_MARGIN + col * (BRICK_WIDTH + BRICK_GAP);
      const y = BRICK_TOP_MARGIN + row * (BRICK_HEIGHT + BRICK_GAP);
      const maxHits = BRICK_HIT_POINTS[type];

      const canCarryPowerUp = type === "normal" || type === "reinforced";

      bricks.push({
        id: `${row}-${col}`,
        col,
        row,
        x,
        y,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        type,
        hitsRemaining: maxHits,
        maxHits,
        powerUp: canCarryPowerUp ? pickPowerUp(rng, level.id) : null,
        alive: true,
        regrowAt: null,
      });
    }
  });

  return bricks;
}

/**
 * Win condition: every brick that actually needs to be destroyed is gone.
 * Indestructible bricks never count (can't be destroyed); regenerating
 * bricks never count either (destroying one is intentionally temporary —
 * a level can be "cleared" while regenerating bricks are still present or
 * mid-regrow, per their design).
 */
export function allBreakableBricksCleared(bricks: Brick[]): boolean {
  return bricks.every((b) => !b.alive || b.type === "indestructible" || b.type === "regenerating");
}

/** Rebuilds positioned Brick[] from a resume snapshot's saved bricks, deriving x/y from col/row. */
export function bricksFromSaved(saved: SavedBrick[]): Brick[] {
  return saved.map((s) => ({
    ...s,
    x: BRICK_SIDE_MARGIN + s.col * (BRICK_WIDTH + BRICK_GAP),
    y: BRICK_TOP_MARGIN + s.row * (BRICK_HEIGHT + BRICK_GAP),
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
  }));
}
