import type { Rect, Vec2 } from "./types";

/** Ball can bounce at most this many degrees from vertical (straight up). */
export const MAX_BOUNCE_ANGLE_DEG = 60;

/**
 * Computes the ball's outgoing velocity after hitting the paddle, based on
 * where along the paddle's width the ball made contact. Center = straight
 * up; edges = clamped to ±MAX_BOUNCE_ANGLE_DEG from vertical.
 *
 * @param ballX - x position of the ball at contact
 * @param paddle - paddle rect
 * @param speed - resulting velocity magnitude (post-hit speed)
 */
export function paddleBounce(ballX: number, paddle: Rect, speed: number): Vec2 {
  const paddleCenter = paddle.x + paddle.width / 2;
  const halfWidth = paddle.width / 2;

  const offset = clamp((ballX - paddleCenter) / halfWidth, -1, 1);
  const angleRad = offset * (MAX_BOUNCE_ANGLE_DEG * (Math.PI / 180));

  return {
    x: speed * Math.sin(angleRad),
    y: -speed * Math.cos(angleRad),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
