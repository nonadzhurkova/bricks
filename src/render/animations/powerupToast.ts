import gsap from "gsap";
import { Container, Text } from "pixi.js";
import type { PowerUpType } from "@/game/powerups";

const POWERUP_MESSAGES: Record<PowerUpType, string> = {
  enlarge: "Paddle Enlarged",
  reduce: "Paddle Reduced",
  laser: "Laser Ready",
  catch: "Sticky Paddle",
  slow: "Ball Slowed",
  extraLife: "+1 Life",
  wall: "Floor Sealed",
  magnet: "Magnet Paddle",
  fireball: "Fireball!",
  diamond: "Diamond Power!",
};

/** Floating label that rises and fades, explaining what a caught power-up does. */
export function playPowerUpToast(layer: Container, x: number, y: number, type: PowerUpType): void {
  playFloatingToast(layer, x, y, POWERUP_MESSAGES[type], 0xffffff);
}

/** Floating label that rises and fades, reporting a life lost when the ball drops. */
export function playLifeLostToast(layer: Container, x: number, y: number): void {
  playFloatingToast(layer, x, y, "-1 Life", 0xfca5a5);
}

/**
 * Floating "+N" that rises and fades from a brick's position when it scores
 * points. Deliberately lighter/less opaque than the other toasts here (soft
 * icy-blue, thin stroke, capped below full alpha) — it fires on every hit,
 * far more often than a power-up pickup or life-lost toast, so it reads as
 * a quiet ambient confirmation rather than competing for attention.
 */
export function playScorePopup(layer: Container, x: number, y: number, points: number): void {
  const text = new Text({
    text: `+${points}`,
    style: {
      fontSize: 12,
      fontWeight: "600",
      fill: 0xcbe4ff,
      stroke: { color: 0x0a0715, width: 1.5 },
    },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  text.alpha = 0;
  layer.addChild(text);

  gsap
    .timeline({ onComplete: () => text.destroy() })
    .to(text, { alpha: 0.75, y: y - 14, duration: 0.15, ease: "power1.out" })
    .to(text, { alpha: 0, y: y - 46, duration: 0.65, ease: "power1.out" }, 0.5);
}

function playFloatingToast(layer: Container, x: number, y: number, message: string, color: number): void {
  const text = new Text({
    text: message,
    style: {
      fontSize: 13,
      fontWeight: "700",
      fill: color,
      stroke: { color: 0x0a0715, width: 3 },
    },
  });
  text.anchor.set(0.5);
  text.x = x;
  text.y = y;
  text.alpha = 0;
  layer.addChild(text);

  gsap
    .timeline({ onComplete: () => text.destroy() })
    .to(text, { alpha: 1, y: y - 14, duration: 0.15, ease: "power1.out" })
    .to(text, { alpha: 0, y: y - 46, duration: 0.65, ease: "power1.out" }, 0.5);
}
