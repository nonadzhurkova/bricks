import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/** Flash + small spark/dust burst at the contact point. Brick never breaks. */
export function playIndestructibleSpark(
  layer: Container,
  contactX: number,
  contactY: number,
): gsap.core.Timeline {
  const group = new Container();
  group.x = contactX;
  group.y = contactY;
  layer.addChild(group);

  const flash = new Graphics().circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.9 });
  group.addChild(flash);

  const sparkCount = 6;
  const sparks: Graphics[] = [];
  for (let i = 0; i < sparkCount; i++) {
    const g = new Graphics().rect(-1, -1, 2, 2).fill({ color: 0xcbd5e1 });
    group.addChild(g);
    sparks.push(g);
  }

  const tl = gsap.timeline({
    onComplete: () => group.destroy({ children: true }),
  });

  tl.to(flash, { alpha: 0, duration: 0.12, ease: "none" }, 0);

  sparks.forEach((g, i) => {
    const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.5;
    const dist = 10 + Math.random() * 10;
    tl.to(
      g,
      {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        alpha: 0,
        duration: 0.18,
        ease: "power2.out",
      },
      0,
    );
  });

  return tl;
}
