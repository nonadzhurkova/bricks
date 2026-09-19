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
 * Stagger callback helper: calls `onHit(brick)` for each touching brick with
 * ~80ms stagger, ordered by distance from the explosion center, so the
 * chain visually ripples outward.
 */
export function chainExplosiveHits<T extends { x: number; y: number; width: number; height: number }>(
  originX: number,
  originY: number,
  bricks: T[],
  onHit: (brick: T, index: number) => void,
  staggerMs = 80,
): void {
  const withDist = bricks
    .map((b) => ({
      brick: b,
      dist: Math.hypot(b.x + b.width / 2 - originX, b.y + b.height / 2 - originY),
    }))
    .sort((a, b) => a.dist - b.dist);

  withDist.forEach(({ brick }, i) => {
    gsap.delayedCall((i * staggerMs) / 1000, () => onHit(brick, i));
  });
}
