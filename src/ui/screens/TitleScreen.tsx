"use client";

import { useGameStore } from "@/state/store";
import Overlay from "../Overlay";

export default function TitleScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const restartFromLevelOne = useGameStore((s) => s.restartFromLevelOne);
  const bestScore = useGameStore((s) => s.bestScore);
  const highestLevelPassed = useGameStore((s) => s.highestLevelPassed);
  const bestLevelReached = useGameStore((s) => s.bestLevelReached);

  const hasProgress = highestLevelPassed > 0;

  return (
    <Overlay>
      <h1 style={{ fontSize: 40, margin: 0, letterSpacing: 1 }}>Crystal Break</h1>
      <p className="credit-line">by Nona Dzhurkova</p>
      {bestScore > 0 && <p style={{ opacity: 0.7 }}>Best score: {bestScore}</p>}
      {bestLevelReached > 0 && <p style={{ opacity: 0.7 }}>Best level reached: {bestLevelReached}</p>}
      <button className="primary-btn" onClick={startGame}>
        {hasProgress ? `Continue — Level ${highestLevelPassed + 1}` : "Start"}
      </button>
      {hasProgress && (
        <button className="secondary-btn" onClick={restartFromLevelOne}>
          Restart from level 1
        </button>
      )}
    </Overlay>
  );
}
