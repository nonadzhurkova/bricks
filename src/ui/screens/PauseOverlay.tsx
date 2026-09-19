"use client";

import { useEffect } from "react";
import { useGameStore } from "@/state/store";
import Overlay from "../Overlay";

export default function PauseOverlay() {
  const resume = useGameStore((s) => s.resume);
  const goToTitle = useGameStore((s) => s.goToTitle);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === "Escape") resume();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resume]);

  return (
    <Overlay>
      <h2>Paused</h2>
      <button className="primary-btn" onClick={resume}>
        Resume
      </button>
      <button className="secondary-btn" onClick={goToTitle}>
        Quit to title
      </button>
    </Overlay>
  );
}
