import gsap from "gsap";
import { Container, Graphics } from "pixi.js";
import { createShards } from "../sprites/shard";

/**
 * Variant of the normal-brick shatter used when the breaking brick carries a
 * power-up: shards briefly converge toward the drop point (~150ms) before
 * scattering, instead of flying outward immediately.
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
  const group = new Container();
  group.x = x;
  group.y = y;
  layer.addChild(group);

  const flash = new Graphics().rect(0, 0, width, height).fill({ color: 0xffffff });
  flash.alpha = 0;
  group.addChild(flash);

  const dropX = width / 2;
  const dropY = height / 2;

  const shards = createShards(width, height, color, 0, 0);
  shards.forEach((s) => {
    group.addChild(s.container);
  });

  const tl = gsap.timeline({
    onComplete: () => group.destroy({ children: true }),
  });

  tl.to(flash, { alpha: 1, duration: 0.04 }).to(flash, { alpha: 0, duration: 0.08 });

  shards.forEach((s) => {
    // converge toward drop point first, then scatter and drift away slowly,
    // lingering like firework embers before fading
    tl.to(s.container, { x: dropX, y: dropY, scale: 0.9, duration: 0.15, ease: "power2.in" }, 0)
      .to(
        s.container,
        {
          x: `+=${s.vx * 0.55}`,
          rotation: s.vr * 3,
          duration: 0.7,
          ease: "power1.out",
        },
        0.15,
      )
      .to(
        s.container,
        {
          y: `+=${s.vy * 0.3 + 100}`,
          duration: 0.7,
          ease: "power1.in",
        },
        0.15,
      )
      .to(
        s.container,
        { alpha: 0.55, duration: 0.12, repeat: 2, yoyo: true, ease: "sine.inOut" },
        0.25,
      )
      .to(s.container, { alpha: 0, duration: 0.35, ease: "power1.in" }, 0.64);
  });

  tl.call(onCapsuleReady, undefined, 0.15);

  return tl;
}
