import gsap from "gsap";
import type { Container } from "pixi.js";
import { playBrickShatter } from "./brickShatter";

export interface BreakAnimOptions {
  /** parent container to add transient effect sprites to (world-space, positioned at brick x/y) */
  layer: Container;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  onComplete?: () => void;
}

/**
 * Normal brick (1-hit) shatter — and shared by every other brick type's
 * final break (reinforced on its second hit, explosive) via engine.ts's
 * breakBrick: chunky, brick-colored rectangular shards that burst outward,
 * tumble, and fall under gravity (see brickShatter.ts). Each call owns an
 * independent GSAP timeline, so overlapping breaks during a fast rally run
 * concurrently rather than queuing.
 */
export function playNormalBreak(opts: BreakAnimOptions): gsap.core.Timeline {
  const { layer, x, y, width, height, color, onComplete } = opts;

  return playBrickShatter({
    layer,
    x,
    y,
    width,
    height,
    color,
    onComplete,
  });
}
