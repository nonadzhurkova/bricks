"use client";

import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import GameCanvas from "@/ui/GameCanvas";
import TitleScreen from "@/ui/screens/TitleScreen";
import HUD from "@/ui/screens/HUD";
import PauseOverlay from "@/ui/screens/PauseOverlay";
import LevelClearOverlay from "@/ui/screens/LevelClearOverlay";
import GameOverOverlay from "@/ui/screens/GameOverOverlay";
import { useGameStore } from "@/state/store";
import StarfieldBackground from "@/ui/StarfieldBackground";

export default function Home() {
  const phase = useGameStore((s) => s.phase);
  const pause = useGameStore((s) => s.pause);

  useEffect(() => {
    useGameStore.getState().hydrateFromStorage();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === "Escape" && useGameStore.getState().phase === "playing") {
        pause();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pause]);

  return (
    <div className="game-root">
      <StarfieldBackground />
      <div className="arena-wrap">
        <GameCanvas />
        {phase === "playing" && <HUD />}
      </div>

      <AnimatePresence mode="wait">
        {phase === "title" && <TitleScreen key="title" />}
        {phase === "paused" && <PauseOverlay key="paused" />}
        {phase === "levelClear" && <LevelClearOverlay key="levelClear" />}
        {phase === "gameOver" && <GameOverOverlay key="gameOver" />}
      </AnimatePresence>
    </div>
  );
}
