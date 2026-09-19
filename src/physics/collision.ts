import type { Circle, CircleRectCollision, Rect, Vec2 } from "./types";

/**
 * Detects collision between a circle (ball) and an axis-aligned rect
 * (brick/paddle/wall). Returns null when there is no overlap.
 *
 * Side is picked by which edge is penetrated least deeply, i.e. the edge the
 * circle center is closest to relative to the rect's extent on that axis.
 */
export function circleRectCollision(
  circle: Circle,
  rect: Rect,
): CircleRectCollision | null {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > circle.radius * circle.radius) {
    return null;
  }

  const dist = Math.sqrt(distSq);

  // Circle center is inside the rect (dist === 0 at a corner/edge overlap
  // fully) — resolve using the smallest axis penetration from center.
  if (dist === 0) {
    const rectCenterX = rect.x + rect.width / 2;
    const rectCenterY = rect.y + rect.height / 2;
    const overlapX = rect.width / 2 + circle.radius - Math.abs(circle.x - rectCenterX);
    const overlapY = rect.height / 2 + circle.radius - Math.abs(circle.y - rectCenterY);

    if (overlapX < overlapY) {
      const side: "left" | "right" = circle.x < rectCenterX ? "left" : "right";
      return {
        side,
        contact: { x: side === "left" ? rect.x : rect.x + rect.width, y: circle.y },
        penetration: overlapX,
      };
    }
    const side: "top" | "bottom" = circle.y < rectCenterY ? "top" : "bottom";
    return {
      side,
      contact: { x: circle.x, y: side === "top" ? rect.y : rect.y + rect.height },
      penetration: overlapY,
    };
  }

  const penetration = circle.radius - dist;
  const side = sideFromContact(closestX, closestY, rect);

  return {
    side,
    contact: { x: closestX, y: closestY },
    penetration,
  };
}

function sideFromContact(contactX: number, contactY: number, rect: Rect): "top" | "bottom" | "left" | "right" {
  const onLeftEdge = contactX === rect.x;
  const onRightEdge = contactX === rect.x + rect.width;
  const onTopEdge = contactY === rect.y;
  const onBottomEdge = contactY === rect.y + rect.height;

  const isCorner = (onLeftEdge || onRightEdge) && (onTopEdge || onBottomEdge);

  if (isCorner) {
    // Corner hit: prefer whichever axis has contact strictly inside the
    // opposite edge's span is not applicable here (closest point IS the
    // corner), so fall back to vertical sides for corners — reflection
    // consumers treat top/bottom and left/right symmetrically.
    return onTopEdge || onBottomEdge ? (onTopEdge ? "top" : "bottom") : onLeftEdge ? "left" : "right";
  }

  if (onLeftEdge) return "left";
  if (onRightEdge) return "right";
  if (onTopEdge) return "top";
  return "bottom";
}

/** Reflects a velocity vector off a collision side (axis-aligned surfaces only). */
export function reflectVelocity(velocity: Vec2, side: "top" | "bottom" | "left" | "right"): Vec2 {
  if (side === "top" || side === "bottom") {
    return { x: velocity.x, y: -velocity.y };
  }
  return { x: -velocity.x, y: velocity.y };
}

/** Pushes the circle out of the rect along the collision normal so it doesn't re-collide next frame. */
export function resolvePenetration(
  circle: Circle,
  collision: CircleRectCollision,
): Vec2 {
  const push = collision.penetration + 0.01;
  switch (collision.side) {
    case "top":
      return { x: circle.x, y: circle.y - push };
    case "bottom":
      return { x: circle.x, y: circle.y + push };
    case "left":
      return { x: circle.x - push, y: circle.y };
    case "right":
      return { x: circle.x + push, y: circle.y };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
