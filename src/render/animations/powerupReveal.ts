import gsap from "gsap";
import type { Container } from "pixi.js";
import { playBrickShatter } from "./brickShatter";

/**
 * Power-up-carrying brick's break: the same chunky shard shatter as every
 * other brick break, with the capsule spawning shortly after the burst
 * starts (matching the previous "converge before reveal" timing beat)
 * rather than waiting for the whole effect to finish.
 */
export function playPowerUpRevealBreak(
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  onCapsuleReady: () => void,
): gsap.core.Timeline {
  const tl = playBrickShatter({
    layer,
    x,
    y,
    width,
    height,
    color,
  });

  tl.call(onCapsuleReady, undefined, 0.15);

  return tl;
}
