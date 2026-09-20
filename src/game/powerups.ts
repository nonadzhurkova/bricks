export type PowerUpType =
  | "enlarge"
  | "reduce"
  | "laser"
  | "catch"
  | "slow"
  | "extraLife"
  | "wall"
  | "magnet"
  | "fireball";

export interface PowerUpDef {
  type: PowerUpType;
  label: string;
  color: number;
  /** ms; timed effects only (extraLife is instant, reduce lasts until reverted) */
  duration?: number;
}

export const POWERUPS: Record<PowerUpType, PowerUpDef> = {
  enlarge: { type: "enlarge", label: "E", color: 0x8b5cf6, duration: 12000 },
  reduce: { type: "reduce", label: "R", color: 0xef4444, duration: 10000 },
  laser: { type: "laser", label: "L", color: 0xf59e0b, duration: 10000 },
  catch: { type: "catch", label: "C", color: 0x2dd4bf, duration: 12000 },
  slow: { type: "slow", label: "S", color: 0xfbbf24, duration: 10000 },
  extraLife: { type: "extraLife", label: "+1", color: 0xf472b6 },
  wall: { type: "wall", label: "W", color: 0x22c55e, duration: 10000 },
  magnet: { type: "magnet", label: "M", color: 0xec4899, duration: 15000 },
  fireball: { type: "fireball", label: "F", color: 0xf97316, duration: 8000 },
};

export const POWERUP_DROP_TABLE: PowerUpType[] = [
  "enlarge",
  "reduce",
  "laser",
  "catch",
  "slow",
  "extraLife",
  "wall",
  "magnet",
  "fireball",
];
