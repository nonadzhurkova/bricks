import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/**
 * First hit on a reinforced brick: flash + single visible crack line, brick
 * dims one shade (dimming itself is handled by the caller re-rendering the
 * brick sprite with dimShade=true — this just plays the impact flash/crack).
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

  const angle = Math.random() * Math.PI * 2;
  const crack = new Graphics();
  crack
    .moveTo(width * 0.15, height * 0.15)
    .lineTo(width * 0.5 + Math.cos(angle) * width * 0.3, height * 0.5 + Math.sin(angle) * height * 0.3)
    .lineTo(width * 0.85, height * 0.85)
    .stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
  crack.alpha = 0;
  group.addChild(crack);

  const tl = gsap.timeline({
    onComplete: () => group.destroy({ children: true }),
  });

  tl.to(flash, { alpha: 1, duration: 0.04 })
    .to(crack, { alpha: 1, duration: 0.03 }, "<")
    .to(flash, { alpha: 0, duration: 0.1 });

  return tl;
}
