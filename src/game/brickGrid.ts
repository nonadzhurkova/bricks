import { BRICK_CHAR_MAP, type BrickType, BRICK_HIT_POINTS } from "./brickTypes";
import {
  BRICK_COLS,
  BRICK_GAP,
  BRICK_HEIGHT,
  BRICK_SIDE_MARGIN,
  BRICK_TOP_MARGIN,
  BRICK_WIDTH,
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
}

function pickPowerUp(rng: () => number): PowerUpType | null {
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
        powerUp: canCarryPowerUp ? pickPowerUp(rng) : null,
        alive: true,
      });
    }
  });

  return bricks;
}

export function allBreakableBricksCleared(bricks: Brick[]): boolean {
  return bricks.every((b) => !b.alive || b.type === "indestructible");
}
