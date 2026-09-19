import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/** Glowing energy barrier across the bottom of the arena while Wall is active. Call once; pulses until stopped. */
export function startBottomWall(worldContainer: Container, arenaWidth: number, arenaHeight: number): () => void {
  const layer = new Container();
  layer.y = arenaHeight;
  worldContainer.addChild(layer);

  const glow = new Graphics();
  glow.rect(-2, -3, arenaWidth + 4, 6).fill({ color: 0x22c55e, alpha: 0.25 });
  layer.addChild(glow);

  const line = new Graphics();
  line.rect(0, -1.5, arenaWidth, 3).fill({ color: 0x86efac, alpha: 0.9 });
  layer.addChild(line);

  const pulse = { alpha: 0.9 };
  const tween = gsap.to(pulse, {
    alpha: 0.5,
    duration: 0.6,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      line.alpha = pulse.alpha;
      glow.alpha = pulse.alpha * 0.3;
    },
  });

  return () => {
    tween.kill();
    layer.destroy({ children: true });
  };
}
