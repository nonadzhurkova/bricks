"use client";

import { motion } from "motion/react";
import { useGameStore } from "@/state/store";

export default function GameOverOverlay() {
  const level = useGameStore((s) => s.level);
  const restartLevel = useGameStore((s) => s.restartLevel);
  const goToTitle = useGameStore((s) => s.goToTitle);

  return (
    <motion.div
      className="overlay game-over-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="vignette-pulse"
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <motion.div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <h2>Game Over</h2>
        <p>Level {level} — out of lives</p>
        <button className="primary-btn" onClick={restartLevel}>
          Retry level
        </button>
        <button className="secondary-btn" onClick={goToTitle}>
          Quit to title
        </button>
      </motion.div>
    </motion.div>
  );
}
