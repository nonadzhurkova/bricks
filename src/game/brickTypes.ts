export type BrickType = "normal" | "reinforced" | "indestructible" | "explosive";

export const BRICK_HIT_POINTS: Record<BrickType, number> = {
  normal: 1,
  reinforced: 2,
  indestructible: Infinity,
  explosive: 1,
};

export const BRICK_SCORE: Record<BrickType, number> = {
  normal: 50,
  reinforced: 100,
  indestructible: 0,
  explosive: 75,
};

/** Level grid characters map to brick types. '.' = empty cell. */
export const BRICK_CHAR_MAP: Record<string, BrickType> = {
  N: "normal",
  R: "reinforced",
  I: "indestructible",
  E: "explosive",
};
