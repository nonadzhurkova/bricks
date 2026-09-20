/** Ball speed model: fixed base per level, gentle per-paddle-hit acceleration, capped, resets on paddle hit. */

import { MAX_BALL_SPEED } from "@/game/constants";

export const SPEED_CAP_MULTIPLIER = 1.6;

/** Multiplier applied per paddle hit during a rally (before the reset-on-hit rule kicks in for the *next* hit). */
export const RALLY_ACCEL_PER_BRICK_HIT = 1.015;

/** Base speed for a given level (1-indexed), rising gently level to level. */
export function baseSpeedForLevel(level: number, baseSpeed: number, perLevelIncrease: number): number {
  return baseSpeed + (level - 1) * perLevelIncrease;
}

/**
 * Applies gentle acceleration to the current speed after a brick hit
 * (rally continues), capped at SPEED_CAP_MULTIPLIER x base — AND at
 * MAX_BALL_SPEED absolutely, whichever is lower. The relative cap alone
 * isn't enough once base speed itself can approach MAX_BALL_SPEED at high
 * endless levels (see endlessBaseSpeed in game/generate.ts): 1.6x an
 * already-near-the-ceiling base would overshoot it, so a long rally at a
 * high level needs the absolute ceiling to actually hold.
 */
export function accelerateOnRally(currentSpeed: number, baseSpeed: number): number {
  const next = currentSpeed * RALLY_ACCEL_PER_BRICK_HIT;
  const cap = Math.min(baseSpeed * SPEED_CAP_MULTIPLIER, MAX_BALL_SPEED);
  return Math.min(next, cap);
}

/** Resets speed to base — called on every paddle hit. */
export function resetSpeedOnPaddleHit(baseSpeed: number): number {
  return baseSpeed;
}

/** Rescales a velocity vector to a target magnitude, preserving direction. */
export function rescaleVelocity(
  velocity: { x: number; y: number },
  targetSpeed: number,
): { x: number; y: number } {
  const currentSpeed = Math.hypot(velocity.x, velocity.y);
  if (currentSpeed === 0) return { x: 0, y: -targetSpeed };
  const scale = targetSpeed / currentSpeed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}
