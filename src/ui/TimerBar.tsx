"use client";

import { useGameStore } from "@/state/store";
import { ARENA_HEIGHT, PADDLE_Y_OFFSET } from "@/game/constants";

/** Thin timer bar shown above the paddle for the active timed power-up. */
export default function TimerBar() {
  const activePowerUp = useGameStore((s) => s.activePowerUp);
  const ratio = useGameStore((s) => s.powerUpTimeRatio);

  if (!activePowerUp || activePowerUp === "extraLife") return null;

  const topPercent = ((ARENA_HEIGHT - PADDLE_Y_OFFSET - 14) / ARENA_HEIGHT) * 100;

  return (
    <div className="timer-bar-track" style={{ top: `${topPercent}%` }}>
      <div className="timer-bar-fill" style={{ width: `${Math.max(0, ratio) * 100}%` }} />
    </div>
  );
}
