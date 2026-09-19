import { create } from "zustand";
import {
  getBestLevelReached,
  getBestScore,
  getHighestLevelPassed,
  getResumeSnapshot,
  resetHighestLevelPassed,
  setBestLevelReached,
  setBestScore,
  setHighestLevelPassed,
} from "./storage";
import type { PowerUpType } from "@/game/powerups";

export type GamePhase =
  | "title"
  | "playing"
  | "paused"
  | "levelClear"
  | "gameOver";

interface GameState {
  phase: GamePhase;
  level: number; // 1-indexed
  score: number;
  bestScore: number;
  lives: number;
  activePowerUp: PowerUpType | null;
  /** 0-1 remaining ratio for the active timed power-up; 1 = just activated */
  powerUpTimeRatio: number;
  /** Highest level number fully cleared this session; "Start" resumes at highestLevelPassed + 1. Reset by restartFromLevelOne. */
  highestLevelPassed: number;
  /** All-time record level reached this session; never reset, shown alongside best score. */
  bestLevelReached: number;

  startGame: () => void;
  restartFromLevelOne: () => void;
  restartLevel: () => void;
  goToTitle: () => void;
  pause: () => void;
  resume: () => void;
  addScore: (points: number) => void;
  loseLife: () => void;
  levelClear: () => void;
  nextLevel: () => void;
  gameOver: () => void;
  setActivePowerUp: (p: PowerUpType | null) => void;
  setPowerUpTimeRatio: (r: number) => void;
  addLife: () => void;
  /** Reads all sessionStorage-backed state (best score, level progress, in-progress resume) after mount, avoiding an SSR/client hydration mismatch. */
  hydrateFromStorage: () => void;
}

export const LIVES_PER_LEVEL = 3;
export const TOTAL_LEVELS = 8;

export const useGameStore = create<GameState>((set, get) => ({
  // Always starts from safe, SSR-identical defaults — anything read from
  // sessionStorage (best score, level progress, an in-progress resume) is
  // applied once via hydrateFromStorage() after mount, never at module
  // scope, so the server-rendered HTML and the client's first render match.
  phase: "title",
  level: 1,
  score: 0,
  bestScore: 0,
  lives: LIVES_PER_LEVEL,
  activePowerUp: null,
  powerUpTimeRatio: 0,
  highestLevelPassed: 0,
  bestLevelReached: 0,

  startGame: () =>
    set((s) => ({
      phase: "playing",
      level: s.highestLevelPassed + 1,
      score: 0,
      lives: LIVES_PER_LEVEL,
      activePowerUp: null,
      powerUpTimeRatio: 0,
    })),

  /** Full reset: forgets saved progress and begins again at level 1 (win screen's "restart from level 1"). */
  restartFromLevelOne: () => {
    resetHighestLevelPassed();
    set({
      phase: "playing",
      level: 1,
      score: 0,
      lives: LIVES_PER_LEVEL,
      activePowerUp: null,
      powerUpTimeRatio: 0,
      highestLevelPassed: 0,
    });
  },

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
      setHighestLevelPassed(s.level);
      setBestLevelReached(s.level);
      const highestLevelPassed = Math.max(s.highestLevelPassed, s.level);
      const bestLevelReached = Math.max(s.bestLevelReached, s.level);

      // Endless mode: levels continue indefinitely past the 8 hand-built
      // ones (generateEndlessLevel covers 9+), no win-screen cutoff.
      return {
        phase: "playing",
        level: s.level + 1,
        score: 0,
        lives: LIVES_PER_LEVEL,
        activePowerUp: null,
        powerUpTimeRatio: 0,
        highestLevelPassed,
        bestLevelReached,
      };
    }),

  gameOver: () => set({ phase: "gameOver" }),

  setActivePowerUp: (p) => set({ activePowerUp: p, powerUpTimeRatio: p ? 1 : 0 }),
  setPowerUpTimeRatio: (r) => set({ powerUpTimeRatio: r }),
  addLife: () => set((s) => ({ lives: s.lives + 1 })),

  hydrateFromStorage: () => {
    const resume = getResumeSnapshot();
    set({
      bestScore: getBestScore(),
      highestLevelPassed: getHighestLevelPassed(),
      bestLevelReached: getBestLevelReached(),
      ...(resume
        ? { phase: "playing", level: resume.level, score: resume.score, lives: resume.lives }
        : {}),
    });
  },
}));
