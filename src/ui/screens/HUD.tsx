"use client";

import { useGameStore } from "@/state/store";
import LivesDots from "../LivesDots";

export default function HUD() {
  const score = useGameStore((s) => s.score);
  const level = useGameStore((s) => s.level);
  const lives = useGameStore((s) => s.lives);
  const pause = useGameStore((s) => s.pause);

  return (
    <div className="hud">
      <div>Score: {score}</div>
      <div>Level {level}</div>
      <LivesDots lives={lives} total={3} />
      <button className="icon-btn" onClick={pause} aria-label="Pause">
        ❚❚
      </button>
    </div>
  );
}
