import { Container, Graphics } from "pixi.js";

export interface BallSprite {
  container: Container;
  glow: Graphics;
  trail: Graphics;
  trailPoints: { x: number; y: number }[];
}

export function createBallSprite(radius: number): BallSprite {
  const container = new Container();

  const trail = new Graphics();

  const glow = new Graphics();
  glow.circle(0, 0, radius * 2.2).fill({ color: 0x22d3ee, alpha: 0.18 });
  glow.circle(0, 0, radius).fill({ color: 0xffffff });
  glow.circle(0, 0, radius * 0.55).fill({ color: 0xd7f9ff });

  container.addChild(trail, glow);

  return { container, glow, trail, trailPoints: [] };
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
    ball.trail.circle(p.x - x, p.y - y, r).fill({ color: 0x22d3ee, alpha });
  });
}
