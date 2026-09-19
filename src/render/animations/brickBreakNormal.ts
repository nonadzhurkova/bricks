import gsap from "gsap";
import { Container, Graphics } from "pixi.js";
import { createShards } from "../sprites/shard";

export interface BreakAnimOptions {
  /** parent container to add transient shard/flash sprites to (world-space, positioned at brick x/y) */
  layer: Container;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  /** normalized direction the ball was traveling at impact, used to bias shard scatter away from it */
  ballDirX: number;
  ballDirY: number;
  onComplete?: () => void;
}

/**
 * Normal brick (1-hit) shatter: white impact flash -> crack lines -> shatter
 * into 5-7 shards flying outward -> fade/drift -> soft radial glow pulse.
 * Resolves well under 350ms.
 */
export function playNormalBreak(opts: BreakAnimOptions): gsap.core.Timeline {
  const { layer, x, y, width, height, color, ballDirX, ballDirY, onComplete } = opts;

  const group = new Container();
  group.x = x;
  group.y = y;
  layer.addChild(group);

  const flash = new Graphics().rect(0, 0, width, height).fill({ color: 0xffffff });
  flash.alpha = 0;
  group.addChild(flash);

  const cracks = new Graphics();
  cracks.alpha = 0;
  drawCrackLines(cracks, width, height, 2 + Math.floor(Math.random() * 2));
  group.addChild(cracks);

  const glow = new Graphics()
    .circle(width / 2, height / 2, Math.max(width, height) * 0.7)
    .fill({ color, alpha: 0.5 });
  glow.alpha = 0;
  glow.scale.set(0.3);
  group.addChild(glow);

  const shards = createShards(width, height, color, ballDirX, ballDirY);
  shards.forEach((s) => group.addChild(s.gfx));

  const tl = gsap.timeline({
    onComplete: () => {
      group.destroy({ children: true });
      onComplete?.();
    },
  });

  tl.to(flash, { alpha: 1, duration: 0.04, ease: "none" })
    .to(cracks, { alpha: 1, duration: 0.02 }, "<")
    .to(flash, { alpha: 0, duration: 0.08 })
    .to(
      glow,
      { alpha: 0, scale: 1.6, duration: 0.3, ease: "power1.out" },
      "<",
    )
    .set(glow, { alpha: 0.6 }, "<");

  shards.forEach((s) => {
    tl.to(
      s.gfx,
      {
        x: `+=${s.vx * 0.3}`,
        y: `+=${s.vy * 0.3 + 40}`, // gravity drift down
        rotation: s.vr,
        alpha: 0,
        duration: 0.3,
        ease: "power1.out",
      },
      "<",
    );
  });

  return tl;
}

function drawCrackLines(gfx: Graphics, width: number, height: number, count: number): void {
  const cx = width / 2;
  const cy = height / 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const len = Math.min(width, height) * 0.45;
    gfx.moveTo(cx, cy);
    gfx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  }
  gfx.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
}
