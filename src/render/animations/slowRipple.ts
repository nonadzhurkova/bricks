import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/** Faint expanding ripple rings around the paddle while Slow is active. Call once; loops until stopped. */
export function startSlowRipple(paddleContainer: Container, width: number, height: number): () => void {
  const layer = new Container();
  paddleContainer.addChild(layer);

  const tweens: gsap.core.Tween[] = [];
  let active = true;

  function spawnRing() {
    if (!active) return;
    const ring = new Graphics();
    ring.x = width / 2;
    ring.y = height / 2;
    layer.addChild(ring);
    const state = { r: height * 0.4, alpha: 0.5 };
    const tween = gsap.to(state, {
      r: width * 0.8,
      alpha: 0,
      duration: 1.1,
      ease: "power1.out",
      onUpdate: () => {
        ring.clear();
        ring.ellipse(0, 0, state.r, height * 0.5).stroke({ color: 0xfbbf24, width: 1.5, alpha: state.alpha });
      },
      onComplete: () => {
        ring.destroy();
        if (active) spawnRing();
      },
    });
    tweens.push(tween);
  }

  spawnRing();

  return () => {
    active = false;
    tweens.forEach((t) => t.kill());
    layer.destroy({ children: true });
  };
}
