import { Graphics } from "pixi.js";

export interface Shard {
  gfx: Graphics;
  vx: number;
  vy: number;
  vr: number;
}

/**
 * Builds 5-7 triangular shards from a brick's bounding box, biased to fly
 * away from the ball's approach direction.
 */
export function createShards(
  width: number,
  height: number,
  color: number,
  awayX: number,
  awayY: number,
): Shard[] {
  const count = 5 + Math.floor(Math.random() * 3); // 5-7
  const shards: Shard[] = [];
  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < count; i++) {
    const gfx = new Graphics();
    const angleBase = (i / count) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.8;
    const angle = angleBase + jitter;

    const r1 = Math.min(width, height) * (0.3 + Math.random() * 0.3);
    const p1x = Math.cos(angle) * r1;
    const p1y = Math.sin(angle) * r1;
    const p2x = Math.cos(angle + 0.9) * r1 * 0.6;
    const p2y = Math.sin(angle + 0.9) * r1 * 0.6;

    gfx.poly([0, 0, p1x, p1y, p2x, p2y]).fill({ color, alpha: 0.9 });
    gfx.x = cx;
    gfx.y = cy;

    // bias direction away from ball approach, blended with radial scatter
    const dirX = Math.cos(angle) * 0.5 + awayX * 0.7;
    const dirY = Math.sin(angle) * 0.5 + awayY * 0.7;
    const mag = Math.hypot(dirX, dirY) || 1;
    const speed = 60 + Math.random() * 90;

    shards.push({
      gfx,
      vx: (dirX / mag) * speed,
      vy: (dirY / mag) * speed,
      vr: (Math.random() - 0.5) * 8,
    });
  }

  return shards;
}
