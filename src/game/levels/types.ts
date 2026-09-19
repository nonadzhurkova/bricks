/**
 * Level grid: array of rows, each row a string of brick chars (see
 * BRICK_CHAR_MAP) or '.' for an empty cell. All rows must be the same
 * length as BRICK_COLS.
 */
export interface LevelDef {
  id: number;
  name: string;
  grid: string[];
}
