import gsap from "gsap";
import type { Container } from "pixi.js";

/**
 * Very subtle looping glow pulse on a healthy regenerating brick's sprite —
 * a light idle "ambient" animation (not urgent) that visually distinguishes
 * it from a plain normal/reinforced brick at a glance. Call once per sprite;
 * returns a stop function to kill the loop when the sprite is replaced/
 * destroyed (e.g. on hit, on regrow-in).
 */
export function startRegrowIdlePulse(sprite: Container): () => void {
  const state = { alpha: 1 };
  const tween = gsap.to(state, {
    alpha: 0.82,
    duration: 1.4,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      sprite.alpha = state.alpha;
    },
  });

  return () => {
    tween.kill();
    sprite.alpha = 1;
  };
}
