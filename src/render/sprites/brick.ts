import { Container, Graphics } from "pixi.js";
import type { BrickType } from "@/game/brickTypes";

/** Base + highlight/shadow facet shades per brick type. Deeper glass = tougher. */
const BRICK_PALETTE: Record<BrickType, { base: number; highlight: number; shadow: number }> = {
  normal: { base: 0x3b82f6, highlight: 0x93c5fd, shadow: 0x1e3a8a },
  reinforced: { base: 0x6d28d9, highlight: 0xa78bfa, shadow: 0x2e1065 },
  indestructible: { base: 0x334155, highlight: 0x64748b, shadow: 0x0f172a },
  explosive: { base: 0xea580c, highlight: 0xfdba74, shadow: 0x7c2d12 },
};

export function createBrickGraphics(
  type: BrickType,
  width: number,
  height: number,
  dimShade = false,
): Container {
  const container = new Container();
  const palette = BRICK_PALETTE[type];
  const baseColor = dimShade ? mixColor(palette.base, 0x000000, 0.35) : palette.base;

  const body = new Graphics();
  body.roundRect(0, 0, width, height, 3).fill({ color: baseColor });

  // highlight facet — lighter diagonal cut top-left
  const highlight = new Graphics();
  highlight
    .poly([0, 0, width, 0, 0, height])
    .fill({ color: palette.highlight, alpha: 0.35 });

  // shadow facet — darker diagonal cut bottom-right
  const shadow = new Graphics();
  shadow
    .poly([width, 0, width, height, 0, height])
    .fill({ color: palette.shadow, alpha: 0.35 });

  container.addChild(body, highlight, shadow);
  return container;
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
