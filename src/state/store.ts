import { create } from "zustand";
import { getBestScore, getResumeSnapshot, setBestScore } from "./storage";
import type { PowerUpType } from "@/game/powerups";

const initialResume = typeof window !== "undefined" ? getResumeSnapshot() : null;

export type GamePhase =
  | "title"
  | "playing"
  | "paused"
  | "levelClear"
  | "gameOver"
  | "win";

interface GameState {
  phase: GamePhase;
  level: number; // 1-indexed
  score: number;
  bestScore: number;
  lives: number;
  activePowerUp: PowerUpType | null;
  /** 0-1 remaining ratio for the active timed power-up; 1 = just activated */
  powerUpTimeRatio: number;

  startGame: () => void;
  restartLevel: () => void;
  goToTitle: () => void;
  pause: () => void;
  resume: () => void;
  addScore: (points: number) => void;
  loseLife: () => void;
  levelClear: () => void;
  nextLevel: () => void;
  gameOver: () => void;
  win: () => void;
  setActivePowerUp: (p: PowerUpType | null) => void;
  setPowerUpTimeRatio: (r: number) => void;
  addLife: () => void;
  hydrateBestScore: () => void;
}

export const LIVES_PER_LEVEL = 3;
export const TOTAL_LEVELS = 8;

export const useGameStore = create<GameState>((set, get) => ({
  phase: initialResume ? "playing" : "title",
  level: initialResume?.level ?? 1,
  score: initialResume?.score ?? 0,
  bestScore: 0,
  lives: initialResume?.lives ?? LIVES_PER_LEVEL,
  activePowerUp: null,
  powerUpTimeRatio: 0,

  startGame: () =>
    set({
      phase: "playing",
      level: 1,
      score: 0,
      lives: LIVES_PER_LEVEL,
      activePowerUp: null,
      powerUpTimeRatio: 0,
    }),

  restartLevel: () =>
    set({
      phase: "playing",
      score: 0,
      lives: LIVES_PER_LEVEL,
      activePowerUp: null,
      powerUpTimeRatio: 0,
    }),

  goToTitle: () => set({ phase: "title" }),

  pause: () => set((s) => (s.phase === "playing" ? { phase: "paused" } : {})),
  resume: () => set((s) => (s.phase === "paused" ? { phase: "playing" } : {})),

  addScore: (points: number) =>
    set((s) => {
      const score = s.score + points;
      if (score > s.bestScore) {
        setBestScore(score);
        return { score, bestScore: score };
      }
      return { score };
    }),

  loseLife: () => {
    const lives = get().lives - 1;
    if (lives <= 0) {
      set({ lives: 0, phase: "gameOver" });
    } else {
      set({ lives });
    }
  },

  levelClear: () => set({ phase: "levelClear" }),

  nextLevel: () =>
    set((s) => {
      const nextLevelNum = s.level + 1;
      if (nextLevelNum > TOTAL_LEVELS) {
        return { phase: "win" };
      }
      return {
        phase: "playing",
        level: nextLevelNum,
        score: 0,
        lives: LIVES_PER_LEVEL,
        activePowerUp: null,
        powerUpTimeRatio: 0,
      };
    }),

  gameOver: () => set({ phase: "gameOver" }),
  win: () => set({ phase: "win" }),

  setActivePowerUp: (p) => set({ activePowerUp: p, powerUpTimeRatio: p ? 1 : 0 }),
  setPowerUpTimeRatio: (r) => set({ powerUpTimeRatio: r }),
  addLife: () => set((s) => ({ lives: s.lives + 1 })),

  hydrateBestScore: () => set({ bestScore: getBestScore() }),
}));
