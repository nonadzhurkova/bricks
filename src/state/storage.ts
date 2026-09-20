import type { SavedBrick } from "@/game/brickGrid";

const BEST_SCORE_KEY = "crystal-break:best-score";
const RESUME_KEY = "crystal-break:resume";
const HIGHEST_LEVEL_KEY = "crystal-break:highest-level-passed";
const BEST_LEVEL_KEY = "crystal-break:best-level-reached";
const LEVEL_FAILS_KEY = "crystal-break:level-fails";

export interface ResumeSnapshot {
  level: number;
  score: number;
  lives: number;
  bricks: SavedBrick[];
}

export function getResumeSnapshot(): ResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
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
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage unavailable — resume just won't persist
  }
}

export function clearResumeSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RESUME_KEY);
  } catch {
    // ignore
  }
}

export function getBestScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
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
      window.localStorage.setItem(BEST_SCORE_KEY, String(score));
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — best score just won't persist
  }
}

/** Highest level number the player has fully cleared (0 = none yet). */
export function getHighestLevelPassed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(HIGHEST_LEVEL_KEY);
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
      window.localStorage.setItem(HIGHEST_LEVEL_KEY, String(level));
    }
  } catch {
    // localStorage unavailable — progress just won't persist
  }
}

export function resetHighestLevelPassed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HIGHEST_LEVEL_KEY);
  } catch {
    // ignore
  }
}

/**
 * All-time best level reached (a record, like best score — unlike
 * highestLevelPassed, this is never reset by "Restart from level 1").
 */
export function getBestLevelReached(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BEST_LEVEL_KEY);
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
      window.localStorage.setItem(BEST_LEVEL_KEY, String(level));
    }
  } catch {
    // localStorage unavailable — record just won't persist
  }
}

/**
 * Full game-over count for a specific level number (the speed-assist fail
 * counter). Stored as {level, count} rather than just a bare number so a
 * reload doesn't mistakenly carry a stale count over to a *different*
 * level — getLevelFails only returns non-zero when the stored level
 * matches the one asked about.
 */
export function getLevelFails(level: number): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LEVEL_FAILS_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { level: number; count: number };
    if (parsed.level !== level || typeof parsed.count !== "number") return 0;
    return parsed.count;
  } catch {
    return 0;
  }
}

export function setLevelFails(level: number, count: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEVEL_FAILS_KEY, JSON.stringify({ level, count }));
  } catch {
    // localStorage unavailable — the speed-assist just won't survive a reload
  }
}
