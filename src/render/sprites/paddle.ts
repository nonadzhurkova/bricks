import { Container, Graphics } from "pixi.js";
import type { PowerUpType } from "@/game/powerups";

export type PaddleVisualState = "normal" | PowerUpType;

const PADDLE_COLORS: Record<PaddleVisualState, { fill: number; highlight: number }> = {
  normal: { fill: 0x8b5cf6, highlight: 0xc4b5fd },
  enlarge: { fill: 0x8b5cf6, highlight: 0xc4b5fd },
  reduce: { fill: 0xef4444, highlight: 0xfca5a5 },
  laser: { fill: 0xf59e0b, highlight: 0xfde68a },
  catch: { fill: 0x2dd4bf, highlight: 0x99f6e4 },
  slow: { fill: 0xfbbf24, highlight: 0xfef3c7 },
  extraLife: { fill: 0x8b5cf6, highlight: 0xc4b5fd },
};

export interface PaddleSprite {
  container: Container;
  body: Graphics;
  width: number;
  height: number;
}

export function createPaddleSprite(width: number, height: number): PaddleSprite {
  const container = new Container();
  const body = new Graphics();
  drawPaddleBody(body, width, height, "normal");
  container.addChild(body);
  return { container, body, width, height };
}

export function drawPaddleBody(
  body: Graphics,
  width: number,
  height: number,
  state: PaddleVisualState,
): void {
  const { fill, highlight } = PADDLE_COLORS[state];
  body.clear();
  body.roundRect(0, 0, width, height, height / 2).fill({ color: fill, alpha: 0.85 });
  body
    .roundRect(width * 0.06, height * 0.15, width * 0.88, height * 0.28, height * 0.14)
    .fill({ color: highlight, alpha: 0.5 });

  if (state === "laser") {
    body.rect(-2, -4, 4, 8).fill({ color: 0xfde68a });
    body.rect(width - 2, -4, 4, 8).fill({ color: 0xfde68a });
  }
}
