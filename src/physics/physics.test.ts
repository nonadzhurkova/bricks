import { describe, expect, it } from "vitest";
import { circleRectCollision, reflectVelocity, resolvePenetration } from "./collision";
import { MAX_BOUNCE_ANGLE_DEG, paddleBounce } from "./paddle";
import {
  accelerateOnRally,
  baseSpeedForLevel,
  rescaleVelocity,
  resetSpeedOnPaddleHit,
  SPEED_CAP_MULTIPLIER,
} from "./speed";

describe("circleRectCollision", () => {
  const rect = { x: 100, y: 100, width: 50, height: 20 };

  it("returns null when far apart", () => {
    expect(circleRectCollision({ x: 0, y: 0, radius: 5 }, rect)).toBeNull();
  });

  it("detects a top collision", () => {
    const result = circleRectCollision({ x: 120, y: 95, radius: 8 }, rect);
    expect(result).not.toBeNull();
    expect(result?.side).toBe("top");
    expect(result?.contact).toEqual({ x: 120, y: 100 });
  });

  it("detects a bottom collision", () => {
    const result = circleRectCollision({ x: 120, y: 125, radius: 8 }, rect);
    expect(result?.side).toBe("bottom");
  });

  it("detects a left collision", () => {
    const result = circleRectCollision({ x: 95, y: 110, radius: 8 }, rect);
    expect(result?.side).toBe("left");
  });

  it("detects a right collision", () => {
    const result = circleRectCollision({ x: 155, y: 110, radius: 8 }, rect);
    expect(result?.side).toBe("right");
  });

  it("computes penetration depth", () => {
    const result = circleRectCollision({ x: 120, y: 96, radius: 8 }, rect);
    // distance from circle center to rect top edge = 4, radius = 8 => penetration = 4
    expect(result?.penetration).toBeCloseTo(4);
  });
});

describe("reflectVelocity", () => {
  it("flips y on top/bottom hits", () => {
    expect(reflectVelocity({ x: 3, y: 5 }, "top")).toEqual({ x: 3, y: -5 });
    expect(reflectVelocity({ x: 3, y: -5 }, "bottom")).toEqual({ x: 3, y: 5 });
  });

  it("flips x on left/right hits", () => {
    expect(reflectVelocity({ x: 3, y: 5 }, "left")).toEqual({ x: -3, y: 5 });
    expect(reflectVelocity({ x: -3, y: 5 }, "right")).toEqual({ x: 3, y: 5 });
  });
});

describe("resolvePenetration", () => {
  it("pushes the circle out along the normal", () => {
    const circle = { x: 120, y: 96, radius: 8 };
    const collision = circleRectCollision(circle, { x: 100, y: 100, width: 50, height: 20 })!;
    const resolved = resolvePenetration(circle, collision);
    expect(resolved.y).toBeLessThan(circle.y);
  });
});

describe("paddleBounce", () => {
  const paddle = { x: 100, y: 500, width: 80, height: 14 };

  it("bounces straight up from dead center", () => {
    const v = paddleBounce(140, paddle, 10);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-10);
  });

  it("clamps to +60deg from vertical at the right edge", () => {
    const v = paddleBounce(180, paddle, 10);
    const angleFromVertical = Math.atan2(v.x, -v.y) * (180 / Math.PI);
    expect(angleFromVertical).toBeCloseTo(MAX_BOUNCE_ANGLE_DEG, 5);
  });

  it("clamps to -60deg from vertical at the left edge", () => {
    const v = paddleBounce(100, paddle, 10);
    const angleFromVertical = Math.atan2(v.x, -v.y) * (180 / Math.PI);
    expect(angleFromVertical).toBeCloseTo(-MAX_BOUNCE_ANGLE_DEG, 5);
  });

  it("never exceeds max angle even past the paddle edge", () => {
    const v = paddleBounce(300, paddle, 10);
    const angleFromVertical = Math.atan2(v.x, -v.y) * (180 / Math.PI);
    expect(Math.abs(angleFromVertical)).toBeLessThanOrEqual(MAX_BOUNCE_ANGLE_DEG + 1e-6);
  });

  it("preserves the requested speed magnitude", () => {
    const v = paddleBounce(160, paddle, 10);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10);
  });
});

describe("speed model", () => {
  it("increases base speed per level", () => {
    expect(baseSpeedForLevel(1, 5, 0.3)).toBeCloseTo(5);
    expect(baseSpeedForLevel(3, 5, 0.3)).toBeCloseTo(5.6);
  });

  it("accelerates gently on rally hits", () => {
    const base = 5;
    const next = accelerateOnRally(base, base);
    expect(next).toBeGreaterThan(base);
    expect(next).toBeCloseTo(base * 1.015);
  });

  it("caps acceleration at 1.6x base", () => {
    let speed = 5;
    const base = 5;
    for (let i = 0; i < 200; i++) {
      speed = accelerateOnRally(speed, base);
    }
    expect(speed).toBeCloseTo(base * SPEED_CAP_MULTIPLIER, 5);
    expect(speed).toBeLessThanOrEqual(base * SPEED_CAP_MULTIPLIER + 1e-9);
  });

  it("resets to base speed on paddle hit", () => {
    expect(resetSpeedOnPaddleHit(5)).toBe(5);
  });
});

describe("rescaleVelocity", () => {
  it("preserves direction while changing magnitude", () => {
    const v = rescaleVelocity({ x: 3, y: 4 }, 10);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10);
    expect(v.x / v.y).toBeCloseTo(3 / 4);
  });

  it("handles zero velocity by defaulting upward", () => {
    const v = rescaleVelocity({ x: 0, y: 0 }, 10);
    expect(v).toEqual({ x: 0, y: -10 });
  });
});
