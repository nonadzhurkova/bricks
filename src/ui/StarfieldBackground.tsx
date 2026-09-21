"use client";

import { useMemo } from "react";
import { useGameStore } from "@/state/store";
import { POWERUPS } from "@/game/powerups";

interface Star {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

function makeStars(count: number, seed: number): Star[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 10000) / 10000;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 1 + rand() * 2,
    duration: 2.5 + rand() * 3.5,
    delay: rand() * 4,
    opacity: 0.4 + rand() * 0.6,
  }));
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Animated starfield + nebula glow, used as a backdrop behind the title screen and gameplay. */
export default function StarfieldBackground() {
  const stars = useMemo(() => makeStars(70, 42), []);

  // Map order reflects catch order (Map.set doesn't reorder on update), so
  // the last entry is the most-recently-caught active power-up — used to
  // tint the background toward that power-up's own color while it's active.
  const activeEffects = useGameStore((s) => s.activeEffects);
  const tintColor = activeEffects.length > 0
    ? colorToCss(POWERUPS[activeEffects[activeEffects.length - 1].type].color)
    : null;

  return (
    <div className="starfield" aria-hidden="true">
      <div className="starfield-nebula starfield-nebula-a" />
      <div className="starfield-nebula starfield-nebula-b" />
      {stars.map((star, i) => (
        <div
          key={i}
          className="starfield-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            opacity: star.opacity,
          }}
        />
      ))}
      <div className="starfield-grid" />
      <div
        className="starfield-powerup-tint"
        style={{
          background: tintColor ? `radial-gradient(circle, ${tintColor}, transparent 70%)` : "transparent",
          opacity: tintColor ? 0.35 : 0,
        }}
      />
    </div>
  );
}
