import gsap from "gsap";
import type { Container } from "pixi.js";
import { playMeteorShower } from "./meteorShower";

/**
 * Power-up-carrying brick's break: the same light-based meteor shower
 * effect as every other brick break, with the capsule spawning shortly
 * after the burst starts (matching the previous "converge before reveal"
 * timing beat) rather than waiting for the whole effect to finish.
 */
export function playPowerUpRevealBreak(
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  onCapsuleReady: () => void,
): gsap.core.Timeline {
  const tl = playMeteorShower({
    layer,
    centerX: x + width / 2,
    centerY: y + height / 2,
    width,
    height,
  });

  tl.call(onCapsuleReady, undefined, 0.15);

  return tl;
}
