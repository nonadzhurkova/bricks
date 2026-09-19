import { Container, Graphics } from "pixi.js";

export interface Shard {
  container: Container;
  vx: number;
  vy: number;
  vr: number;
}

/**
 * Builds 5-8 triangular glass-fragment shards from a brick's bounding box,
 * biased to fly away from the ball's approach direction. Each shard has a
 * bold two-tone fill (base + a vivid lit edge) plus a bright rim stroke and
 * an outer glow so it reads clearly against the dark background instead of
 * disappearing as a tiny sliver.
 */
export function createShards(
  width: number,
  height: number,
  color: number,
  awayX: number,
  awayY: number,
): Shard[] {
  const count = 5 + Math.floor(Math.random() * 4); // 5-8
  const shards: Shard[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const litColor = mixColor(color, 0xffffff, 0.75);

  // Size shards off the brick's shorter dimension (its height, since bricks
  // are much wider than tall) so fragments stay proportional to the brick
  // itself rather than ballooning past it.
  const baseSize = Math.min(width, height);

  for (let i = 0; i < count; i++) {
    const container = new Container();

    const angleBase = (i / count) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.9;
    const angle = angleBase + jitter;

    const r1 = baseSize * (0.35 + Math.random() * 0.3);
    const spread = 0.7 + Math.random() * 0.6;
    const p1x = Math.cos(angle) * r1;
    const p1y = Math.sin(angle) * r1;
    const p2x = Math.cos(angle + spread) * r1 * 0.6;
    const p2y = Math.sin(angle + spread) * r1 * 0.6;

    const gfx = new Graphics();
    // soft outer glow so the fragment pops against the dark scene
    gfx.poly([0, 0, p1x, p1y, p2x, p2y]).fill({ color: litColor, alpha: 0.25 });
    // base fill for the whole fragment
    gfx.poly([0, 0, p1x, p1y, p2x, p2y]).fill({ color, alpha: 1 });
    // vivid lit sliver along one edge, like light catching a cut facet
    gfx.poly([0, 0, p1x, p1y, p1x * 0.5 + p2x * 0.5, p1y * 0.5 + p2y * 0.5]).fill({
      color: litColor,
      alpha: 0.85,
    });
    // bright rim so the silhouette stays crisp against the dark background
    gfx.poly([0, 0, p1x, p1y, p2x, p2y]).stroke({ color: litColor, width: 1.5, alpha: 0.9 });

    container.addChild(gfx);
    container.x = cx;
    container.y = cy;
    container.pivot.set(0, 0);

    // bias direction away from ball approach, blended with radial scatter
    const dirX = Math.cos(angle) * 0.5 + awayX * 0.7;
    const dirY = Math.sin(angle) * 0.5 + awayY * 0.7;
    const mag = Math.hypot(dirX, dirY) || 1;
    const speed = 70 + Math.random() * 110;

    shards.push({
      container,
      vx: (dirX / mag) * speed,
      vy: (dirY / mag) * speed,
      vr: (Math.random() - 0.5) * 10,
    });
  }

  return shards;
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
