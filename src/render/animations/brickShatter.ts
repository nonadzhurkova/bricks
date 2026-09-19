import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

export interface BrickShatterOptions {
  /** parent container to add transient effect sprites to (world-space) */
  layer: Container;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  onComplete?: () => void;
}

/**
 * Chunky, solid, brick-colored shard shatter — bold rectangular fragments
 * that fly outward, tumble, and fall under gravity, like real breaking
 * glass or tile. No gradients or glow: flat fills, high contrast, reads
 * instantly against the dark arena.
 */
export function playBrickShatter(opts: BrickShatterOptions): gsap.core.Timeline {
  const { layer, x, y, width, height, color, onComplete } = opts;

  const group = new Container();
  group.x = x + width / 2;
  group.y = y + height / 2;
  layer.addChild(group);

  const tl = gsap.timeline({
    onComplete: () => {
      group.destroy({ children: true });
      onComplete?.();
    },
  });

  const highlight = mixColor(color, 0xffffff, 0.45);
  const shadow = mixColor(color, 0x000000, 0.4);

  // a bright flash where the brick was, gone almost immediately — the
  // "pop" that sells the impact
  const flash = new Graphics();
  flash.rect(-width / 2, -height / 2, width, height).fill({ color: 0xffffff });
  group.addChild(flash);
  tl.to(flash, { alpha: 0, duration: 0.12, ease: "power1.out" }, 0);

  const cols = 3;
  const rows = 2;
  const pieceW = width / cols;
  const pieceH = height / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const shardColor = Math.random() < 0.5 ? highlight : Math.random() < 0.5 ? color : shadow;

      const piece = new Graphics();
      const w = pieceW * (0.75 + Math.random() * 0.25);
      const h = pieceH * (0.75 + Math.random() * 0.25);
      piece.rect(-w / 2, -h / 2, w, h).fill({ color: shardColor });

      const startX = -width / 2 + (col + 0.5) * pieceW;
      const startY = -height / 2 + (row + 0.5) * pieceH;
      piece.x = startX;
      piece.y = startY;
      piece.rotation = Math.random() * Math.PI;
      group.addChild(piece);

      // outward burst direction, biased away from brick center
      const angle = Math.atan2(startY, startX) + (Math.random() - 0.5) * 0.8;
      const speed = 90 + Math.random() * 130;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60; // small upward pop before gravity takes over

      const state = { x: piece.x, y: piece.y, vx, vy, rot: piece.rotation };
      const spin = (Math.random() - 0.5) * 8;
      const gravity = 420;
      const duration = 0.9 + Math.random() * 0.4;
      let lastElapsed = 0;

      tl.to(
        piece,
        {
          alpha: 0,
          duration,
          ease: "power1.in",
          onUpdate: function onUpdate() {
            const elapsed = typeof this.time === "function" ? this.time() : 0;
            const dt = Math.max(elapsed - lastElapsed, 0);
            lastElapsed = elapsed;

            state.vy += gravity * dt;
            state.x += state.vx * dt;
            state.y += state.vy * dt;
            state.rot += spin * dt;

            piece.x = state.x;
            piece.y = state.y;
            piece.rotation = state.rot;
          },
        },
        0.05,
      );
    }
  }

  return tl;
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
