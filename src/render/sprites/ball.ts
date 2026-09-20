import { Container, Graphics } from "pixi.js";

export interface BallSprite {
  container: Container;
  glow: Graphics;
  trail: Graphics;
  trailPoints: { x: number; y: number }[];
  /** Trail color, swapped to fire tones while Fireball is active; defaults to the normal ice-cyan. */
  trailColor: number;
}

const NORMAL_GLOW_COLOR = 0x22d3ee;
const NORMAL_CORE_COLOR = 0xd7f9ff;
const FIREBALL_GLOW_COLOR = 0xf97316;
const FIREBALL_CORE_COLOR = 0xfed7aa;

export function createBallSprite(radius: number): BallSprite {
  const container = new Container();

  const trail = new Graphics();

  const glow = new Graphics();
  drawBallGlow(glow, radius, false);

  container.addChild(trail, glow);

  return { container, glow, trail, trailPoints: [], trailColor: NORMAL_GLOW_COLOR };
}

function drawBallGlow(glow: Graphics, radius: number, fireball: boolean): void {
  glow.clear();
  glow
    .circle(0, 0, radius * 2.2)
    .fill({ color: fireball ? FIREBALL_GLOW_COLOR : NORMAL_GLOW_COLOR, alpha: 0.18 });
  glow.circle(0, 0, radius).fill({ color: 0xffffff });
  glow.circle(0, 0, radius * 0.55).fill({ color: fireball ? FIREBALL_CORE_COLOR : NORMAL_CORE_COLOR });
}

/** Swaps the ball's glow/trail colors to fire tones while Fireball is active, or back to normal when it ends. */
export function setBallFireball(ball: BallSprite, radius: number, active: boolean): void {
  drawBallGlow(ball.glow, radius, active);
  ball.trailColor = active ? FIREBALL_GLOW_COLOR : NORMAL_GLOW_COLOR;
}

export function updateBallTrail(ball: BallSprite, x: number, y: number, speedRatio: number): void {
  ball.trailPoints.unshift({ x, y });
  const maxLen = Math.round(4 + speedRatio * 10);
  if (ball.trailPoints.length > maxLen) {
    ball.trailPoints.length = maxLen;
  }

  ball.trail.clear();
  ball.trailPoints.forEach((p, i) => {
    const t = 1 - i / ball.trailPoints.length;
    const alpha = t * (0.25 + speedRatio * 0.4);
    const r = 2 + t * 4;
    ball.trail.circle(p.x - x, p.y - y, r).fill({ color: ball.trailColor, alpha });
  });
}
