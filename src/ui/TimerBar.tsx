"use client";

import { useGameStore } from "@/state/store";
import { ARENA_HEIGHT, PADDLE_Y_OFFSET } from "@/game/constants";
import { POWERUPS } from "@/game/powerups";

/** Stack of thin timer bars above the paddle, one per currently-active power-up — multiple can be active at once. untilLevelEnd effects (granted by Diamond) show a full, static bar since they have no countdown. */
export default function TimerBar() {
  const effects = useGameStore((s) => s.activeEffects);

  if (effects.length === 0) return null;

  const bottomPercent = ((ARENA_HEIGHT - PADDLE_Y_OFFSET - 14) / ARENA_HEIGHT) * 100;
  const barSpacing = 6; // px between stacked bars

  return (
    <>
      {effects.map((effect, i) => {
        const color = POWERUPS[effect.type].color;
        const hex = `#${color.toString(16).padStart(6, "0")}`;
        return (
          <div
            key={effect.type}
            className="timer-bar-track"
            style={{ top: `calc(${bottomPercent}% - ${i * barSpacing}px)` }}
          >
            <div
              className="timer-bar-fill"
              style={{
                width: `${Math.max(0, effect.ratio) * 100}%`,
                background: hex,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
