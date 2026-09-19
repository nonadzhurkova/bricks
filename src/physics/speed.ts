/** Ball speed model: fixed base per level, gentle per-paddle-hit acceleration, capped, resets on paddle hit. */

export const SPEED_CAP_MULTIPLIER = 1.6;

/** Multiplier applied per paddle hit during a rally (before the reset-on-hit rule kicks in for the *next* hit). */
export const RALLY_ACCEL_PER_BRICK_HIT = 1.015;

/** Base speed for a given level (1-indexed), rising gently level to level. */
export function baseSpeedForLevel(level: number, baseSpeed: number, perLevelIncrease: number): number {
  return baseSpeed + (level - 1) * perLevelIncrease;
}

/**
 * Same linear per-level speed model, but capped so endless mode's unbounded
 * level numbers never grow the ball's base speed past a playable ceiling.
 */
export function cappedBaseSpeedForLevel(
  level: number,
  baseSpeed: number,
  perLevelIncrease: number,
  maxMultiplier: number,
): number {
  const uncapped = baseSpeedForLevel(level, baseSpeed, perLevelIncrease);
  return Math.min(uncapped, baseSpeed * maxMultiplier);
}

/**
 * Applies gentle acceleration to the current speed after a brick hit
 * (rally continues), capped at SPEED_CAP_MULTIPLIER × base.
 */
export function accelerateOnRally(currentSpeed: number, baseSpeed: number): number {
  const next = currentSpeed * RALLY_ACCEL_PER_BRICK_HIT;
  const cap = baseSpeed * SPEED_CAP_MULTIPLIER;
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
