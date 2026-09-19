"use client";

import { motion } from "motion/react";
import { useGameStore } from "@/state/store";
import Overlay from "../Overlay";

export default function WinScreen() {
  const score = useGameStore((s) => s.score);
  const startGame = useGameStore((s) => s.startGame);

  return (
    <Overlay>
      <motion.h1
        initial={{ scale: 0.9 }}
        animate={{ scale: [0.9, 1.05, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        You cleared Crystal Break!
      </motion.h1>
      <p>Final score: {score}</p>
      <button className="primary-btn" onClick={startGame}>
        Restart from level 1
      </button>
    </Overlay>
  );
}
