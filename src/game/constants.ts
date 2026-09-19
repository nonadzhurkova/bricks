export const ARENA_WIDTH = 400;
export const ARENA_HEIGHT = 700;

export const PADDLE_WIDTH = 80;
export const PADDLE_HEIGHT = 14;
export const PADDLE_Y_OFFSET = 40; // distance from bottom of arena
export const PADDLE_SPEED_KEYBOARD = 480; // px/sec

export const BALL_RADIUS = 7;

export const BRICK_COLS = 8;
export const BRICK_ROWS = 8;
export const BRICK_GAP = 4;
export const BRICK_TOP_MARGIN = 60;
export const BRICK_SIDE_MARGIN = 12;
export const BRICK_WIDTH =
  (ARENA_WIDTH - BRICK_SIDE_MARGIN * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
export const BRICK_HEIGHT = 22;

export const LIVES_PER_LEVEL = 3;

export const BASE_SPEED = 260; // px/sec at level 1
export const SPEED_PER_LEVEL_INCREASE = 14; // px/sec added per level

export const POWERUP_DROP_CHANCE = 0.18; // 15-20%
export const POWERUP_FALL_SPEED = 160; // px/sec

export const ENLARGE_WIDTH_MULTIPLIER = 1.5;
export const REDUCE_WIDTH_MULTIPLIER = 0.5;
export const SLOW_SPEED_MULTIPLIER = 0.6;

export const LASER_WIDTH = 3;
export const LASER_HEIGHT = 14;
export const LASER_SPEED = 480; // px/sec
export const LASER_COOLDOWN_MS = 280;
