import gsap from "gsap";
import { Container, Graphics } from "pixi.js";

/**
 * Expanding shockwave visual, centered on the exploding brick: a bright
 * core flash, a thick leading ring, and a second trailing ring just behind
 * it for a more visible "blast" read. Runs ~0.7s so it's clearly seen even
 * during a fast rally.
 */
export function playShockwaveRing(
  layer: Container,
  x: number,
  y: number,
  maxRadius: number,
): gsap.core.Timeline {
  const container = new Container();
  container.x = x;
  container.y = y;
  layer.addChild(container);

  const core = new Graphics();
  container.addChild(core);
  const ringLead = new Graphics();
  container.addChild(ringLead);
  const ringTrail = new Graphics();
  container.addChild(ringTrail);

  const duration = 0.7;
  const leadState = { r: 6, alpha: 1 };
  const trailState = { r: 6, alpha: 1 };
  const coreState = { r: maxRadius * 0.35, alpha: 0.8 };

  const tl = gsap.timeline({ onComplete: () => container.destroy({ children: true }) });

  // bright core flash that blooms then fades fast
  tl.to(
    coreState,
    {
      r: maxRadius * 0.55,
      alpha: 0,
      duration: duration * 0.4,
      ease: "power2.out",
      onUpdate: () => {
        core.clear();
        core.circle(0, 0, coreState.r).fill({ color: 0xfed7aa, alpha: coreState.alpha * 0.5 });
      },
    },
    0,
  );

  // thick leading ring
  tl.to(
    leadState,
    {
      r: maxRadius,
      alpha: 0,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        ringLead.clear();
        ringLead.circle(0, 0, leadState.r).stroke({ color: 0xfb923c, width: 6, alpha: leadState.alpha });
      },
    },
    0,
  );

  // second ring trailing just behind the leading edge for extra visibility
  tl.to(
    trailState,
    {
      r: maxRadius * 0.8,
      alpha: 0,
      duration: duration * 0.9,
      ease: "power2.out",
      onUpdate: () => {
        ringTrail.clear();
        ringTrail
          .circle(0, 0, trailState.r)
          .stroke({ color: 0xfdba74, width: 3, alpha: trailState.alpha * 0.7 });
      },
    },
    0.08,
  );

  return tl;
}

/**
 * Stagger callback helper: calls `onHit(brick)` for each touching brick,
 * delayed in proportion to its actual distance from the explosion center
 * (one "ring" of brick-spacing ~= staggerMs), so the chain visually ripples
 * outward following the shockwave itself rather than an arbitrary array
 * order — two bricks equidistant from the blast break together. staggerMs
 * default is tuned to roughly track playShockwaveRing's ~0.7s sweep.
 */
export function chainExplosiveHits<T extends { x: number; y: number; width: number; height: number }>(
  originX: number,
  originY: number,
  bricks: T[],
  onHit: (brick: T) => void,
  staggerMs = 150,
): void {
  if (bricks.length === 0) return;

  const ringSpacing = bricks[0].width + 4; // approx one brick+gap of travel per stagger step

  bricks.forEach((brick) => {
    const dist = Math.hypot(
      brick.x + brick.width / 2 - originX,
      brick.y + brick.height / 2 - originY,
    );
    const delayMs = (dist / ringSpacing) * staggerMs;
    gsap.delayedCall(delayMs / 1000, () => onHit(brick));
  });
}
