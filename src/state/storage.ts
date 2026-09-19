const BEST_SCORE_KEY = "crystal-break:best-score";

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
