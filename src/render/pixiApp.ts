import { Application } from "pixi.js";
import { ARENA_HEIGHT, ARENA_WIDTH } from "@/game/constants";

export async function createPixiApp(canvas: HTMLCanvasElement): Promise<Application> {
  const app = new Application();
  await app.init({
    canvas,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  return app;
}
