import gsap from "gsap";
import type { Container } from "pixi.js";
import { playMeteorShower } from "./meteorShower";

export interface BreakAnimOptions {
  /** parent container to add transient effect sprites to (world-space, positioned at brick x/y) */
  layer: Container;
  x: number;
  y: number;
  width: number;
  height: number;
  onComplete?: () => void;
}

/**
 * Normal brick (1-hit) shatter — and shared by every other brick type's
 * final break (reinforced on its second hit, explosive) via engine.ts's
 * breakBrick: a light-based "meteor shower" effect (impact bloom, spark
 * burst, comet streaks — see meteorShower.ts), no solid shard/debris
 * shapes. Each call owns an independent GSAP timeline, so overlapping
 * breaks during a fast rally run concurrently rather than queuing.
 */
export function playNormalBreak(opts: BreakAnimOptions): gsap.core.Timeline {
  const { layer, x, y, width, height, onComplete } = opts;

  return playMeteorShower({
    layer,
    centerX: x + width / 2,
    centerY: y + height / 2,
    width,
    height,
    onComplete,
  });
}
