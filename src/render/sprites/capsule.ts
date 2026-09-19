import { Container, Graphics, Text } from "pixi.js";
import { POWERUPS, type PowerUpType } from "@/game/powerups";

export interface CapsuleSprite {
  container: Container;
}

export function createCapsuleSprite(type: PowerUpType): CapsuleSprite {
  const def = POWERUPS[type];
  const container = new Container();

  const width = 26;
  const height = 14;

  const body = new Graphics();
  body.roundRect(-width / 2, -height / 2, width, height, height / 2).fill({ color: def.color, alpha: 0.9 });
  body
    .roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height * 0.35, height * 0.15)
    .fill({ color: 0xffffff, alpha: 0.35 });
  container.addChild(body);

  const label = new Text({
    text: def.label,
    style: { fontSize: 9, fontWeight: "700", fill: 0xffffff },
  });
  label.anchor.set(0.5);
  container.addChild(label);

  return { container };
}
