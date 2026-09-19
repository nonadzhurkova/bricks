"use client";

import { useEffect, useRef } from "react";
import { createPixiApp } from "@/render/pixiApp";
import { GameEngine } from "@/render/engine";
import { levels } from "@/game/levels";
import { ARENA_HEIGHT, ARENA_WIDTH } from "@/game/constants";
import { useGameStore } from "@/state/store";
import TimerBar from "./TimerBar";
import { bricksFromSaved, type Brick } from "@/game/brickGrid";
import { clearResumeSnapshot, getResumeSnapshot, saveResumeSnapshot } from "@/state/storage";

function saveSnapshotIfLive(engine: GameEngine): void {
  const s = useGameStore.getState();
  if (s.phase !== "playing" && s.phase !== "paused") return;
  const bricks = engine
    .getBricks()
    .map(({ id, col, row, type, hitsRemaining, maxHits, powerUp, alive }: Brick) => ({
      id,
      col,
      row,
      type,
      hitsRemaining,
      maxHits,
      powerUp,
      alive,
    }));
  saveResumeSnapshot({ level: s.level, score: s.score, lives: s.lives, bricks });
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const phase = useGameStore((s) => s.phase);
  const level = useGameStore((s) => s.level);
  const activePowerUp = useGameStore((s) => s.activePowerUp);

  const prevLevelRef = useRef<number | null>(null);

  // Mount Pixi + engine once.
  useEffect(() => {
    let disposed = false;
    let engine: GameEngine | null = null;
    let app: Awaited<ReturnType<typeof createPixiApp>> | null = null;

    (async () => {
      if (!canvasRef.current) return;
      app = await createPixiApp(canvasRef.current);
      if (disposed) {
        app.destroy({ removeView: false });
        return;
      }
      engine = new GameEngine(app, {
        onScore: (points) => useGameStore.getState().addScore(points),
        onLifeLost: () => useGameStore.getState().loseLife(),
        onLevelClear: () => {
          clearResumeSnapshot();
          useGameStore.getState().levelClear();
        },
        onPowerUpCaught: () => {},
        onPowerUpChanged: (type) => useGameStore.getState().setActivePowerUp(type),
        onPowerUpTimeRatio: (ratio) => useGameStore.getState().setPowerUpTimeRatio(ratio),
        onExtraLife: () => useGameStore.getState().addLife(),
        onBricksChanged: () => saveSnapshotIfLive(engine!),
      });
      engineRef.current = engine;

      const currentLevelNum = useGameStore.getState().level;
      const currentLevel = levels[currentLevelNum - 1] ?? levels[0];

      const snapshot = getResumeSnapshot();
      const savedBricks =
        snapshot && snapshot.level === currentLevelNum ? bricksFromSaved(snapshot.bricks) : undefined;

      engine.loadLevel(currentLevel, currentLevelNum, savedBricks);
      prevLevelRef.current = currentLevelNum;
      engine.start();
    })();

    return () => {
      disposed = true;
      engine?.destroy();
      engineRef.current = null;
      app?.destroy({ removeView: false });
    };
  }, []);

  // Reload level when the level number changes (next level, or restart).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const levelDef = levels[level - 1] ?? levels[0];
    if (prevLevelRef.current !== level && (phase === "playing")) {
      engine.loadLevel(levelDef, level);
      prevLevelRef.current = level;
    }
  }, [level, phase]);

  // React to life-loss / restart-level transitions driven by store phase.
  const prevLivesRef = useRef<number>(3);
  const lives = useGameStore((s) => s.lives);
  const score = useGameStore((s) => s.score);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (lives < prevLivesRef.current && lives > 0) {
      engine.resetBallOnPaddle();
    }
    prevLivesRef.current = lives;

    saveSnapshotIfLive(engine);
  }, [lives, score]);

  // On restart (gameOver -> playing via retry) rebuild bricks; on entering
  // gameOver, play the paddle-flash/ball-fade effect.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (prevPhaseRef.current === "gameOver" && phase === "playing") {
      engine.resetLevel();
      prevLivesRef.current = 3;
    }
    if (prevPhaseRef.current !== "gameOver" && phase === "gameOver") {
      engine.playGameOverEffect();
    }
    if (phase === "gameOver" || phase === "win" || phase === "title") {
      clearResumeSnapshot();
    }
    if (phase === "playing") {
      engine.start();
    } else if (phase === "paused") {
      engine.stop();
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  // Input: pointer drag + keyboard, mapped to arena coordinates.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function arenaXFromClientX(clientX: number): number {
      const rect = wrapper!.getBoundingClientRect();
      const ratio = ARENA_WIDTH / rect.width;
      return (clientX - rect.left) * ratio;
    }

    function isPlaying() {
      return useGameStore.getState().phase === "playing";
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isPlaying()) return;
      engineRef.current?.setPaddleTargetX(arenaXFromClientX(e.clientX));
    }
    function handlePointerDown(e: PointerEvent) {
      if (!isPlaying()) return;
      wrapper!.setPointerCapture(e.pointerId);
      engineRef.current?.setPaddleTargetX(arenaXFromClientX(e.clientX));
      engineRef.current?.launch();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!isPlaying()) return;
      if (e.code === "ArrowLeft") engineRef.current?.setKey("left", true);
      if (e.code === "ArrowRight") engineRef.current?.setKey("right", true);
      if (e.code === "Space") {
        e.preventDefault();
        engineRef.current?.launch();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowLeft") engineRef.current?.setKey("left", false);
      if (e.code === "ArrowRight") engineRef.current?.setKey("right", false);
    }

    wrapper.addEventListener("pointermove", handlePointerMove);
    wrapper.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      wrapper.removeEventListener("pointermove", handlePointerMove);
      wrapper.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="arena-canvas-wrap"
      style={{
        maxWidth: ARENA_WIDTH,
        maxHeight: ARENA_HEIGHT,
        aspectRatio: `${ARENA_WIDTH} / ${ARENA_HEIGHT}`,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <TimerBar />
      {activePowerUp === "laser" && (
        <button
          className="fire-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            engineRef.current?.fireLaser();
          }}
          aria-label="Fire laser"
        >
          FIRE
        </button>
      )}
    </div>
  );
}
