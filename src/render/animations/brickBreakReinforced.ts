import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/**
 * First hit on a reinforced brick: a quick white impact flash. The
 * persistent crack scratch itself is drawn directly into the brick's
 * sprite (see sprites/brick.ts's dimShade overlay) so it stays visible
 * until the second hit breaks the brick, rather than fading with this
 * transient effect.
 */
export function playReinforcedCrack(
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): gsap.core.Timeline {
  const group = new Container();
  group.x = x;
  group.y = y;
  layer.addChild(group);

  const flash = new Graphics().rect(0, 0, width, height).fill({ color: 0xffffff });
  flash.alpha = 0;
  group.addChild(flash);

  const tl = gsap.timeline({
    onComplete: () => group.destroy({ children: true }),
  });

  tl.to(flash, { alpha: 1, duration: 0.04 }).to(flash, { alpha: 0, duration: 0.1 });

  return tl;
}
