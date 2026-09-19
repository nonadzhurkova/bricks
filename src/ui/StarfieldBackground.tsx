"use client";

import { useMemo } from "react";

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

/** Animated starfield + nebula glow, used as a backdrop behind the title screen. */
export default function StarfieldBackground() {
  const stars = useMemo(() => makeStars(70, 42), []);

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
    </div>
  );
}
