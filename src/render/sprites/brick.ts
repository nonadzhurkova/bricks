import { Container, Graphics } from "pixi.js";
import type { BrickType } from "@/game/brickTypes";

/** Base + highlight/shadow facet shades per brick type. Deeper glass = tougher. */
export const BRICK_PALETTE: Record<BrickType, { base: number; highlight: number; shadow: number }> = {
  normal: { base: 0x3b82f6, highlight: 0x93c5fd, shadow: 0x1e3a8a },
  reinforced: { base: 0x6d28d9, highlight: 0xa78bfa, shadow: 0x2e1065 },
  indestructible: { base: 0x334155, highlight: 0x64748b, shadow: 0x0f172a },
  explosive: { base: 0xea580c, highlight: 0xfdba74, shadow: 0x7c2d12 },
  regenerating: { base: 0x14b8a6, highlight: 0x5eead4, shadow: 0x0f766e },
};

export interface BrickGraphicsOptions {
  /** First-hit crack overlay (reinforced/regenerating on their first hit). */
  cracked?: boolean;
  /** Darken the base color — reinforced's "damaged" read. Regenerating stays undimmed while cracked (still teal = "alive"). */
  dimmed?: boolean;
}

export function createBrickGraphics(
  type: BrickType,
  width: number,
  height: number,
  opts: BrickGraphicsOptions = {},
): Container {
  const { cracked = false, dimmed = false } = opts;
  const container = new Container();
  const palette = BRICK_PALETTE[type];
  const baseColor = dimmed ? mixColor(palette.base, 0x000000, 0.35) : palette.base;

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

  // A brick that's taken its first hit (reinforced or regenerating) keeps a
  // visible crack scratched into it until the next hit breaks it.
  if (cracked) {
    container.addChild(createCrackOverlay(width, height));
  }

  return container;
}

/**
 * Faint dashed teal outline shown at a regenerating brick's grid position
 * while it's destroyed and waiting to regrow — signals "coming back", not
 * just empty space. Pixi's Graphics has no native dashed-stroke, so the
 * dash pattern is drawn as individual short segments around the rect's
 * perimeter.
 */
export function createRegrowGhost(width: number, height: number): Graphics {
  const palette = BRICK_PALETTE.regenerating;
  const ghost = new Graphics();

  const dash = 4;
  const gap = 3;
  const inset = 1;
  const w = width - inset * 2;
  const h = height - inset * 2;

  // perimeter points, starting top-left, going clockwise
  const points: [number, number][] = [
    [inset, inset],
    [inset + w, inset],
    [inset + w, inset + h],
    [inset, inset + h],
    [inset, inset],
  ];

  let dashOn = true;
  let remaining = dash;

  for (let i = 0; i < points.length - 1; i++) {
    let [x, y] = points[i];
    const [ex, ey] = points[i + 1];
    let segLen = Math.hypot(ex - x, ey - y);
    const dx = (ex - x) / segLen;
    const dy = (ey - y) / segLen;

    while (segLen > 0) {
      const step = Math.min(remaining, segLen);
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (dashOn) {
        ghost.moveTo(x, y).lineTo(nx, ny);
      }
      x = nx;
      y = ny;
      segLen -= step;
      remaining -= step;
      if (remaining <= 0) {
        dashOn = !dashOn;
        remaining = dashOn ? dash : gap;
      }
    }
  }

  ghost.stroke({ color: palette.base, width: 1.5, alpha: 0.4 });
  return ghost;
}

/** Persistent crack-line overlay baked into a brick sprite (used for a reinforced brick's cracked first-hit state). */
function createCrackOverlay(width: number, height: number): Graphics {
  const cx = width / 2;
  const cy = height / 2;
  const crack = new Graphics();

  const angle = Math.random() * Math.PI * 2;
  crack
    .moveTo(width * 0.15, height * 0.2)
    .lineTo(cx + Math.cos(angle) * width * 0.22, cy + Math.sin(angle) * height * 0.3)
    .lineTo(width * 0.85, height * 0.8);
  crack
    .moveTo(cx + Math.cos(angle) * width * 0.22, cy + Math.sin(angle) * height * 0.3)
    .lineTo(width * 0.75, height * 0.2);
  crack.stroke({ color: 0xffffff, width: 1.25, alpha: 0.55 });

  return crack;
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
