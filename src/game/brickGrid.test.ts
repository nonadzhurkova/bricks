import { describe, expect, it } from "vitest";
import { allBreakableBricksCleared, type Brick } from "./brickGrid";

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
