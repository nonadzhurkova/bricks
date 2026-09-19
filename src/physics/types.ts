export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export type CollisionSide = "top" | "bottom" | "left" | "right";

export interface CircleRectCollision {
  side: CollisionSide;
  /** point on the rect edge closest to the circle center, i.e. the contact point */
  contact: Vec2;
  /** how far the circle overlaps the rect along the collision normal */
  penetration: number;
}
