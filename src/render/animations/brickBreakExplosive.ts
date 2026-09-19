import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/** Expanding ring shockwave visual, centered on the exploding brick. */
export function playShockwaveRing(
  layer: Container,
  x: number,
  y: number,
  maxRadius: number,
): gsap.core.Timeline {
  const ring = new Graphics();
  ring.x = x;
  ring.y = y;
  layer.addChild(ring);

  const state = { r: 4, alpha: 0.9 };
  const tl = gsap.timeline({ onComplete: () => ring.destroy() });

  tl.to(state, {
    r: maxRadius,
    alpha: 0,
    duration: 0.35,
    ease: "power2.out",
    onUpdate: () => {
      ring.clear();
      ring.circle(0, 0, state.r).stroke({ color: 0xfb923c, width: 3, alpha: state.alpha });
    },
  });

  return tl;
}

/**
 * Stagger callback helper: calls `onHit(brick)` for each touching brick,
 * delayed in proportion to its actual distance from the explosion center
 * (one "ring" of brick-spacing ~= staggerMs), so the chain visually ripples
 * outward following the shockwave itself rather than an arbitrary array
 * order — two bricks equidistant from the blast break together.
 */
export function chainExplosiveHits<T extends { x: number; y: number; width: number; height: number }>(
  originX: number,
  originY: number,
  bricks: T[],
  onHit: (brick: T) => void,
  staggerMs = 80,
): void {
  if (bricks.length === 0) return;

  const ringSpacing = bricks[0].width + 4; // approx one brick+gap of travel per stagger step

  bricks.forEach((brick) => {
    const dist = Math.hypot(
      brick.x + brick.width / 2 - originX,
      brick.y + brick.height / 2 - originY,
    );
    const delayMs = (dist / ringSpacing) * staggerMs;
    gsap.delayedCall(delayMs / 1000, () => onHit(brick));
  });
}
