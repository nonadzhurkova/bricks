import level1 from "./level1";
import level2 from "./level2";
import level3 from "./level3";
import level4 from "./level4";
import level5 from "./level5";
import level6 from "./level6";
import level7 from "./level7";
import level8 from "./level8";
import type { LevelDef } from "./types";
import { generateEndlessLevel } from "../generate";

export const levels: LevelDef[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
];

export const TOTAL_HAND_BUILT_LEVELS = levels.length;

/** Returns the hand-built level for 1-8, or a deterministically generated endless level for 9+. */
export function getLevelDef(levelNumber: number): LevelDef {
  if (levelNumber >= 1 && levelNumber <= TOTAL_HAND_BUILT_LEVELS) {
    return levels[levelNumber - 1];
  }
  return generateEndlessLevel(levelNumber);
}

export type { LevelDef };
