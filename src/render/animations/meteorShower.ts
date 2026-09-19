import gsap from "gsap";
import { Container, FillGradient, Graphics } from "pixi.js";

const ICE_COLORS = [0xeaf6ff, 0x7fd9ff];
const AMBER_COLOR = 0xfac775;

export interface MeteorShowerOptions {
  /** parent container to add transient effect sprites to (world-space) */
  layer: Container;
  /** brick center, in the same space as `layer` */
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  onComplete?: () => void;
}

/**
 * Light-based brick-break effect built from three layered pieces:
 * 1. Impact bloom — a soft white radial glow that expands slightly and
 *    fades over ~2s.
 * 2. Spark burst — 12-14 tiny bright dots bursting outward, decelerating,
 *    fading over ~1.5-2s.
 * 3. Comet streaks — 6-8 elongated gradient trails (bright head, fading
 *    tail) drifting downward under mild gravity, redrawn every frame so
 *    each trail's angle always matches its current velocity vector. Mostly
 *    white/ice-blue, ~30% warm amber.
 * No solid shard/debris shapes — everything here is glow, dots, and
 * gradient lines.
 */
export function playMeteorShower(opts: MeteorShowerOptions): gsap.core.Timeline {
  const { layer, centerX, centerY, width, height, onComplete } = opts;

  const group = new Container();
  group.x = centerX;
  group.y = centerY;
  layer.addChild(group);

  const gradientsToDestroy: FillGradient[] = [];

  const tl = gsap.timeline({
    onComplete: () => {
      // destroy the Graphics (and their GPU-bound render state) first,
      // then the gradient textures they referenced — destroying a
      // gradient's texture while a still-live Graphics/shader binding
      // points at it is what triggers Pixi's "destroyed while still
      // bound to a shader" warning
      group.destroy({ children: true });
      gradientsToDestroy.forEach((g) => g.destroy());
      onComplete?.();
    },
  });

  const size = Math.max(width, height);

  addImpactBloom(group, tl, size, gradientsToDestroy);
  addSparkBurst(group, tl, size);
  addCometStreaks(group, tl, size, gradientsToDestroy);

  return tl;
}

// ---- 1. Impact bloom -------------------------------------------------------

function addImpactBloom(
  group: Container,
  tl: gsap.core.Timeline,
  size: number,
  gradientsToDestroy: FillGradient[],
): void {
  const maxRadius = size * 1.1;
  const bloom = new Graphics();
  group.addChild(bloom);

  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: "rgba(255,255,255,0.9)" },
      { offset: 0.4, color: "rgba(234,246,255,0.45)" },
      { offset: 1, color: "rgba(234,246,255,0)" },
    ],
  });
  gradientsToDestroy.push(gradient);

  const state = { radius: size * 0.5 };
  const redraw = () => {
    bloom.clear();
    bloom.circle(0, 0, state.radius).fill(gradient);
  };
  redraw();

  // long, lingering fade — ~2s, not a quick flash
  tl.to(
    state,
    {
      radius: maxRadius,
      duration: 2,
      ease: "power1.out",
      onUpdate: redraw,
    },
    0,
  ).to(bloom, { alpha: 0, duration: 2, ease: "power1.in" }, 0);
}

// ---- 2. Spark burst ---------------------------------------------------------

function addSparkBurst(group: Container, tl: gsap.core.Timeline, size: number): void {
  const count = 12 + Math.floor(Math.random() * 3); // 12-14

  for (let i = 0; i < count; i++) {
    const spark = new Graphics();
    const radius = 1 + Math.random(); // 1-2px
    spark.circle(0, 0, radius).fill({ color: 0xfff4e0 });

    const startOffset = size * 0.15;
    const angle = Math.random() * Math.PI * 2;
    spark.x = Math.cos(angle) * startOffset * Math.random();
    spark.y = Math.sin(angle) * startOffset * Math.random();
    spark.alpha = 0;
    group.addChild(spark);

    const speed = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const duration = 1.5 + Math.random() * 0.5;

    tl.to(spark, { alpha: 1, duration: 0.05, ease: "none" }, 0)
      .to(
        spark,
        {
          x: `+=${dx}`,
          y: `+=${dy}`,
          duration,
          ease: "power2.out", // decelerating burst
        },
        0,
      )
      .to(spark, { alpha: 0, duration, ease: "power1.in" }, 0.1);
  }
}

// ---- 3. Comet streaks -------------------------------------------------------

function addCometStreaks(
  group: Container,
  tl: gsap.core.Timeline,
  size: number,
  gradientsToDestroy: FillGradient[],
): void {
  const count = 6 + Math.floor(Math.random() * 3); // 6-8
  const gravity = 90; // px/s^2, enough to produce real, visible downward drift
  const duration = 1.7 + Math.random() * 0.3; // close to 2s total

  for (let i = 0; i < count; i++) {
    const isAmber = Math.random() < 0.3;
    const color = isAmber ? AMBER_COLOR : ICE_COLORS[Math.floor(Math.random() * ICE_COLORS.length)];

    const gfx = new Graphics();
    group.addChild(gfx);

    const spreadX = (i / count - 0.5) * size * 1.4;
    // scatter mostly sideways/downward from the start — an upward launch
    // would need to be cancelled by gravity before any net fall is
    // visible, which read as the comets hovering in place instead of
    // falling
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const initialSpeed = 40 + Math.random() * 50;

    // position/velocity are plain mutable numbers driven by our own
    // onUpdate integration — GSAP just supplies the ticking + easing of
    // the overall alpha fade, not the physics
    const pos = {
      x: spreadX + (Math.random() - 0.5) * size * 0.3,
      y: (Math.random() - 0.5) * size * 0.3,
    };
    const vel = {
      x: Math.cos(angle) * initialSpeed * 0.5,
      y: Math.sin(angle) * initialSpeed * 0.5,
    };

    const headRadius = 2 + Math.random() * 1.2;
    const trailLength = size * (0.35 + Math.random() * 0.25);

    // one reusable gradient object, mutated in place each frame rather
    // than reallocated (per FillGradient's own performance guidance)
    const gradient = new FillGradient({
      type: "linear",
      start: { x: pos.x, y: pos.y },
      end: { x: pos.x, y: pos.y },
      textureSpace: "local",
      colorStops: [
        { offset: 0, color: "rgba(255,255,255,0.95)" },
        { offset: 0.25, color: colorToRgba(color, 0.6) },
        { offset: 1, color: colorToRgba(color, 0) },
      ],
    });
    gradientsToDestroy.push(gradient);

    const fade = { alpha: 1 };
    let lastElapsed = 0;

    const redraw = () => {
      const mag = Math.hypot(vel.x, vel.y) || 1;
      const dirX = vel.x / mag;
      const dirY = vel.y / mag;
      const tailX = pos.x - dirX * trailLength;
      const tailY = pos.y - dirY * trailLength;

      gradient.start = { x: pos.x, y: pos.y };
      gradient.end = { x: tailX, y: tailY };
      gradient.colorStops = [
        { offset: 0, color: colorToRgba(0xffffff, fade.alpha * 0.9) },
        { offset: 0.4, color: colorToRgba(color, fade.alpha * 0.45) },
        { offset: 1, color: colorToRgba(color, 0) },
      ];

      gfx.clear();
      // soft wide glow stroke behind the trail, then a thin bright core —
      // two layered strokes read as a glowing tail, not a flat stick
      gfx.moveTo(pos.x, pos.y).lineTo(tailX, tailY).stroke({
        width: headRadius * 3.2,
        fill: gradient,
        cap: "round",
        alpha: 0.5,
      });
      gfx.moveTo(pos.x, pos.y).lineTo(tailX, tailY).stroke({
        width: headRadius * 1.1,
        fill: gradient,
        cap: "round",
      });
      // soft halo behind the head
      gfx.circle(pos.x, pos.y, headRadius * 2.2).fill({ color, alpha: fade.alpha * 0.25 });
      // bright solid head at the leading point
      gfx.circle(pos.x, pos.y, headRadius).fill({ color: 0xffffff, alpha: fade.alpha });
    };

    redraw();

    tl.to(
      fade,
      {
        alpha: 0,
        duration,
        ease: "power1.in",
        onUpdate: function onUpdate() {
          const elapsed = typeof this.time === "function" ? this.time() : 0;
          const dt = Math.max(elapsed - lastElapsed, 0);
          lastElapsed = elapsed;

          vel.y += gravity * dt;
          pos.x += vel.x * dt;
          pos.y += vel.y * dt;

          redraw();
        },
      },
      0,
    );
  }
}

function colorToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
