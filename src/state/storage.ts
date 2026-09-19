import type { SavedBrick } from "@/game/brickGrid";

const BEST_SCORE_KEY = "crystal-break:best-score";
const RESUME_KEY = "crystal-break:resume";
const HIGHEST_LEVEL_KEY = "crystal-break:highest-level-passed";
const BEST_LEVEL_KEY = "crystal-break:best-level-reached";

export interface ResumeSnapshot {
  level: number;
  score: number;
  lives: number;
  bricks: SavedBrick[];
}

export function getResumeSnapshot(): ResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeSnapshot;
    if (
      typeof parsed.level !== "number" ||
      typeof parsed.score !== "number" ||
      typeof parsed.lives !== "number" ||
      !Array.isArray(parsed.bricks)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveResumeSnapshot(snapshot: ResumeSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // sessionStorage unavailable — resume just won't persist
  }
}

export function clearResumeSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}

export function getBestScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(BEST_SCORE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setBestScore(score: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBestScore();
    if (score > current) {
      window.sessionStorage.setItem(BEST_SCORE_KEY, String(score));
    }
  } catch {
    // sessionStorage unavailable (private mode, etc.) — best score just won't persist
  }
}

/** Highest level number the player has fully cleared this session (0 = none yet). */
export function getHighestLevelPassed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(HIGHEST_LEVEL_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setHighestLevelPassed(level: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getHighestLevelPassed();
    if (level > current) {
      window.sessionStorage.setItem(HIGHEST_LEVEL_KEY, String(level));
    }
  } catch {
    // sessionStorage unavailable — progress just won't persist
  }
}

export function resetHighestLevelPassed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(HIGHEST_LEVEL_KEY);
  } catch {
    // ignore
  }
}

/**
 * All-time best level reached this session (a record, like best score —
 * unlike highestLevelPassed, this is never reset by "Restart from level 1").
 */
export function getBestLevelReached(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(BEST_LEVEL_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setBestLevelReached(level: number): void {
  if (typeof window === "undefined") return;
  try {
    const current = getBestLevelReached();
    if (level > current) {
      window.sessionStorage.setItem(BEST_LEVEL_KEY, String(level));
    }
  } catch {
    // sessionStorage unavailable — record just won't persist
  }
}
