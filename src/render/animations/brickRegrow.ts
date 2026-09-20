import gsap from "gsap";
import type { Container } from "pixi.js";

/**
 * Regrow-in animation: a regenerating brick fading/scaling up from its
 * ghost outline back to full healthy state. Deliberately slower than the
 * break animations (background event, not a rapid-fire reaction) — call
 * with the brick's freshly created healthy sprite already positioned and
 * added to the brick layer, alpha 0 / scaled down.
 */
export function playBrickRegrow(sprite: Container, durationMs = 1000): gsap.core.Timeline {
  sprite.alpha = 0;
  sprite.scale.set(0.55);

  const tl = gsap.timeline();
  tl.to(sprite, { alpha: 1, duration: durationMs / 1000, ease: "power1.out" }, 0);
  tl.to(sprite.scale, { x: 1, y: 1, duration: durationMs / 1000, ease: "back.out(1.4)" }, 0);

  return tl;
}
