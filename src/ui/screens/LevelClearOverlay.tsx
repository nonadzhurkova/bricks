"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { useGameStore } from "@/state/store";
import Overlay from "../Overlay";

export default function LevelClearOverlay() {
  const score = useGameStore((s) => s.score);
  const level = useGameStore((s) => s.level);
  const nextLevel = useGameStore((s) => s.nextLevel);

  const [displayScore, setDisplayScore] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const controls = animate(0, score, {
      duration: 0.8,
      delay: 0.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplayScore(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Overlay>
      <h2>Level {level} Clear!</h2>
      <p>Score: {displayScore}</p>
      <button className="primary-btn" onClick={nextLevel}>
        Continue
      </button>
    </Overlay>
  );
}
