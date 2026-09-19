import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/** Quick squash + spring-back on ball contact, plus a ripple traveling along the top edge from the contact point. */
export function playPaddleImpact(
  paddleContainer: Container,
  paddleWidth: number,
  paddleHeight: number,
  contactXRatio: number, // 0-1 across paddle width
): void {
  gsap.killTweensOf(paddleContainer.scale);
  gsap.fromTo(
    paddleContainer.scale,
    { x: 1, y: 1 },
    {
      x: 1.08,
      y: 0.78,
      duration: 0.06,
      ease: "power1.out",
      yoyo: true,
      repeat: 1,
    },
  );

  const ripple = new Graphics();
  ripple.y = 0;
  ripple.x = contactXRatio * paddleWidth;
  paddleContainer.addChild(ripple);

  const state = { r: 1, alpha: 0.8 };
  gsap.to(state, {
    r: paddleWidth * 0.5,
    alpha: 0,
    duration: 0.25,
    ease: "power1.out",
    onUpdate: () => {
      ripple.clear();
      ripple
        .ellipse(0, 0, state.r, paddleHeight * 0.3)
        .stroke({ color: 0xffffff, width: 1.5, alpha: state.alpha });
    },
    onComplete: () => ripple.destroy(),
  });
}
