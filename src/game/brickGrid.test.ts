import { describe, expect, it } from "vitest";
import { allBreakableBricksCleared, buildBricksFromLevel, type Brick } from "./brickGrid";
import type { LevelDef } from "./levels/types";

function makeBrick(overrides: Partial<Brick>): Brick {
  return {
    id: "0-0",
    col: 0,
    row: 0,
    x: 0,
    y: 0,
    width: 40,
    height: 20,
    type: "normal",
    hitsRemaining: 1,
    maxHits: 1,
    powerUp: null,
    alive: true,
    regrowAt: null,
    ...overrides,
  };
}

describe("allBreakableBricksCleared", () => {
  it("is false while a normal brick is still alive", () => {
    const bricks = [makeBrick({ alive: true, type: "normal" })];
    expect(allBreakableBricksCleared(bricks)).toBe(false);
  });

  it("is true once all normal/reinforced/explosive bricks are dead", () => {
    const bricks = [
      makeBrick({ id: "a", type: "normal", alive: false }),
      makeBrick({ id: "b", type: "reinforced", alive: false }),
      makeBrick({ id: "c", type: "explosive", alive: false }),
    ];
    expect(allBreakableBricksCleared(bricks)).toBe(true);
  });

  it("ignores indestructible bricks regardless of alive state", () => {
    const bricks = [
      makeBrick({ id: "a", type: "normal", alive: false }),
      makeBrick({ id: "b", type: "indestructible", alive: true }),
    ];
    expect(allBreakableBricksCleared(bricks)).toBe(true);
  });

  it("ignores regenerating bricks even while alive and healthy", () => {
    const bricks = [
      makeBrick({ id: "a", type: "normal", alive: false }),
      makeBrick({ id: "b", type: "regenerating", alive: true, hitsRemaining: 2, maxHits: 2 }),
    ];
    expect(allBreakableBricksCleared(bricks)).toBe(true);
  });

  it("ignores regenerating bricks while dead and waiting to regrow", () => {
    const bricks = [
      makeBrick({ id: "a", type: "normal", alive: false }),
      makeBrick({ id: "b", type: "regenerating", alive: false, regrowAt: 4000 }),
    ];
    expect(allBreakableBricksCleared(bricks)).toBe(true);
  });
});

describe("buildBricksFromLevel — diamond power-up gating", () => {
  const level: LevelDef = {
    id: 999, // overridden per test
    name: "test",
    grid: ["........", "NNNNNNNN", "........", "........", "........", "........", "........", "........"],
  };

  it("never assigns diamond below DIAMOND_MIN_LEVEL, even when the roll would otherwise hit it", () => {
    const belowThreshold: LevelDef = { ...level, id: 99 };
    // rng() always returns 0 — the smallest possible roll, would trigger
    // any chance-based drop including diamond's if the level were eligible
    const bricks = buildBricksFromLevel(belowThreshold, () => 0);
    expect(bricks.some((b) => b.powerUp === "diamond")).toBe(false);
  });

  it("can assign diamond at/above DIAMOND_MIN_LEVEL when the roll hits it", () => {
    const atThreshold: LevelDef = { ...level, id: 100 };
    const bricks = buildBricksFromLevel(atThreshold, () => 0);
    expect(bricks.every((b) => b.powerUp === "diamond")).toBe(true);
  });

  it("never assigns diamond when the roll misses, even at an eligible level", () => {
    const atThreshold: LevelDef = { ...level, id: 100 };
    // rng() always returns close to 1 — misses every chance-based roll
    const bricks = buildBricksFromLevel(atThreshold, () => 0.999);
    expect(bricks.some((b) => b.powerUp === "diamond")).toBe(false);
  });
});
