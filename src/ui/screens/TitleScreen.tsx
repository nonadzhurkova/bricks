"use client";

import { useGameStore } from "@/state/store";
import Overlay from "../Overlay";

export default function TitleScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const bestScore = useGameStore((s) => s.bestScore);

  return (
    <Overlay>
      <h1 style={{ fontSize: 40, margin: 0, letterSpacing: 1 }}>Crystal Break</h1>
      {bestScore > 0 && <p style={{ opacity: 0.7 }}>Best score: {bestScore}</p>}
      <button className="primary-btn" onClick={startGame}>
        Start
      </button>
    </Overlay>
  );
}
