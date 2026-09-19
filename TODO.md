# Crystal Break — Build Plan

Next.js 15 (App Router, TS) brick breaker. PixiJS canvas, GSAP timelines for
break/impact/transition choreography, Motion for UI screen transitions,
Zustand for game state, sessionStorage for best score only.

## File structure

```
/src
  /physics
    types.ts            # Vec2, Rect, Circle, collision result types
    collision.ts         # circle-rect AABB collision + reflection
    paddle.ts             # position-based angling, ±60° clamp
    speed.ts               # base speed per level, rally accel, 1.6x cap
    physics.test.ts        # vitest unit tests
  /game
    constants.ts            # speeds, caps, timer durations, sizes
    levels/
      types.ts                 # LevelDef, BrickChar grid type
      level1.ts ... level8.ts
      index.ts                   # levels[] export
    brickTypes.ts               # brick type enum + hit rules
    powerups.ts                  # power-up defs + drop table + effect durations
  /render
    pixiApp.ts                   # Pixi Application bootstrap, resize handling
    sprites/
      brick.ts                    # brick sprite factory (facet highlight/shadow)
      ball.ts                       # glowing orb + trail
      paddle.ts                     # glass pill paddle, per-state visuals
      capsule.ts                    # power-up capsule sprite
    scene.ts                        # scene graph assembly or level
    loop.ts                          # requestAnimationFrame game loop, physics tick
    animations/
      brickBreakNormal.ts             # GSAP timeline: flash/crack/shatter
      brickBreakReinforced.ts
      brickBreakIndestructible.ts
      brickBreakExplosive.ts          # shockwave chain
      powerupReveal.ts
      paddleImpact.ts                  # squash/spring + ripple
      levelClear.ts
      gameOver.ts
  /ui
    screens/
      TitleScreen.tsx
      HUD.tsx
      PauseOverlay.tsx
      LevelClearOverlay.tsx
      GameOverOverlay.tsx
      WinScreen.tsx
    GameCanvas.tsx                       # mounts Pixi app in useEffect, bridges to store
    LivesDots.tsx
    TimerBar.tsx
  /state
    store.ts                              # Zustand: score, lives, level, powerup, paused, phase
    storage.ts                            # sessionStorage wrapper (best score)
/app
  layout.tsx
  page.tsx                                  # renders GameCanvas + UI overlays
  globals.css
vitest.config.ts
package.json
tsconfig.json
```

## Build order / phasing

- **Phase 1 — Physics module + tests.** Pure functions in `/src/physics`:
  circle-rect collision & reflection, paddle position-based angling (±60°
  clamp), speed/acceleration model (per-hit, cap 1.6x, reset on paddle hit).
  Vitest unit tests for each. No React, no Pixi yet.

- **Phase 2 — Core playable loop.** Next.js app scaffold, Zustand store
  skeleton, one hand-built level of normal bricks only, Pixi canvas with
  plain rectangles/circle, paddle drag+keyboard, ball launch, collision wired
  to physics module, win/lose detection, 3-lives-per-level rule, level reset
  on 3rd life lost. No animations, no power-ups, minimal styling.

- **Phase 3 — All 4 brick types + break animations.** Reinforced, indestructible,
  explosive brick logic and rendering (facet shading by shade only). GSAP
  timelines: normal shatter, reinforced crack/shatter, indestructible spark,
  explosive shockwave chain. Wire into collision resolution.

- **Phase 4 — All 6 power-ups + paddle states.** Drop table on brick break,
  falling capsule, paddle catch detection, effect application/timers
  (Enlarge, Reduce, Laser incl. firing, Catch/sticky, Slow, Extra life).
  Paddle visual states (width/color per state) + timer bar.

- **Phase 5 — All screens with Motion transitions.** Title, HUD (score/level/
  lives dots), Pause (button + Escape), Level Clear (shatter remaining bricks,
  score tally, staggered brick entrance for next level), Game Over (vignette
  pulse, red paddle flash, ball fade, retry button), Win screen (level 8
  clear, restart-from-1).

- **Phase 6 — Remaining 7 levels designed and wired in.** Levels 1-2 pure
  normal, 3-4 introduce reinforced, 5-6 indestructible mazes, 7-8 combine all
  types incl. explosive + gap-threading puzzle.

- **Phase 7 — Feel polish.** Paddle squash+spring+ripple on contact, ball
  trail length/brightness scaling with speed, keyboard support pass (arrow
  keys always active, space/enter to launch, Esc to pause), mobile touch
  tuning (drag responsiveness, laser fire button, tap targets).

## Process notes

- After each phase: run `npm run dev` and `npm test`, fix errors, update this
  file with what's done before moving on.
- Keep the game playable at the end of every phase — no broken intermediate
  states.

## Status

- [x] Phase 1 — physics module + tests (`src/physics`: collision, paddle
      angling, speed model; 20 vitest cases passing)
- [x] Phase 2 — core playable loop (Next.js scaffold w/o Tailwind, Zustand
      store, Pixi app bootstrap, GameEngine class driving physics + render,
      1 normal-brick level, drag/keyboard paddle control, launch, win/lose,
      3-lives-per-level reset behavior, minimal title/HUD/pause/level-clear/
      game-over/win screens). `npm run dev` and `npm test` both verified
      clean.
- [x] Phase 3 — brick types + break animations. All 4 types wired
      (`src/game/brickTypes.ts`, `src/game/brickGrid.ts`); GSAP timelines in
      `src/render/animations/` for normal shatter (flash/crack/shards/glow),
      reinforced crack-then-shatter, indestructible spark burst, explosive
      shockwave chain (staggered `chainExplosiveHits`), power-up-carrying
      shard convergence, and paddle squash+ripple on contact. Engine now
      dispatches per brick type on collision (`handleBrickHit` in
      `src/render/engine.ts`) instead of instant removal. Fixed an
      SSR/hydration bug found along the way: `bestScore` read
      `sessionStorage` directly in the Zustand store's initial state, which
      differed between server and client renders — now defaults to 0 and
      hydrates client-side after mount. Test level (`level1.ts`) temporarily
      includes all 4 brick types to exercise animations visually; will be
      replaced with the real progressive 8-level set in Phase 6.
- [x] Phase 4 — power-ups + paddle states. All 6 wired end-to-end: catch
      triggers `applyPowerUp` in `src/render/engine.ts`, which sets paddle
      width (Enlarge/Reduce), sticky-ball catch/release (Catch), laser
      firing with cannon-tip bolts that collide with bricks (Laser + fire
      button for mobile, tap/click for desktop), ball speed multiplier +
      ripple rings (Slow), and an instant life gain (Extra life, routed
      straight to the store, bypassing the timer system). Timed effects
      count down via `updatePowerUpTimer` and revert on expiry; catching any
      new power-up also reverts the previous one (covers Reduce's "until
      next power-up" rule). Added `TimerBar` (positioned above the paddle)
      and a mobile-only FIRE button that appears while Laser is active. Also
      added a visible arena border (was invisible before, so side-wall
      bounces looked like they were happening in empty space — user caught
      this). `npm test`, `tsc --noEmit`, and `eslint` all clean.
- [x] Phase 5 — screens + transitions. Shared `Overlay` motion wrapper
      (fade + spring-in scale/translate) used by Title/Pause/LevelClear;
      GameOver and Win get bespoke treatments (cool-toned vignette pulse +
      red paddle flash for game over, a small scale pop on the win headline).
      Level-clear score now counts up via `motion/react`'s `animate()`.
      Engine additions: staggered brick entrance on level load (back-out
      ease, ~15ms/brick), `playLevelClearSweep()` (remaining indestructible
      bricks fade together + a brief world pull-back before reporting
      clear), `playGameOverEffect()` (red paddle flash + ball fade, no
      shatter). `AnimatePresence` in `page.tsx` handles overlay mount/unmount
      transitions. Tests, `tsc --noEmit`, and `eslint` all clean.
- [x] Phase 6 — remaining levels. All 8 hand-built grids in
      `src/game/levels/level{1..8}.ts`, wired into `levels/index.ts`.
      Progression: 1-2 pure normal, 3-4 introduce reinforced (checkerboard
      density in 4), 5-6 introduce indestructible mazes (pillars, then a
      zigzag labyrinth), 7-8 combine all 4 types with explosive bricks and a
      genuine single-column gap-threading puzzle (7: threaded corridor
      flanked by explosive/reinforced pairs; 8: sealed indestructible box
      with one entrance column leading to an explosive-cored interior).
      Added `levels.test.ts` validating grid dimensions, valid brick chars,
      levels 1-2 normal-only, and levels 7-8 contain explosive bricks (25
      tests total now passing). `tsc --noEmit` and `eslint` clean, dev
      server compiles without errors.
- [x] Phase 7 — feel polish. Replaced a hardcoded keyboard-paddle-speed
      literal with `PADDLE_SPEED_KEYBOARD`; ball trail brightness floor
      raised so it stays visible at low rally speed, not just near the 1.6x
      cap. Input hardening: pointer drag now uses `setPointerCapture` so
      fast/edge drags on mobile don't drop tracking, and pointer/keyboard
      paddle input is gated to the "playing" phase (previously space could
      fire/launch from the pause or title screen). User-requested fixes
      folded in here: gave Reduce a fixed 10s duration so it now shows a
      timer bar like the other timed power-ups (previously excluded since
      it had no duration), and added a floating "Paddle Enlarged" / "Laser
      Ready" / etc. toast that rises and fades above the paddle when a
      power-up is caught (`src/render/animations/powerupToast.ts`). All 25
      tests, `tsc --noEmit`, and `eslint` clean; dev server compiles with no
      new errors.

## Project status: all 7 phases complete

Repo initialized and pushed to https://github.com/nonadzhurkova/bricks.git
(branch `main`).

## Post-launch: endless mode

Rebalanced levels 6-7 (were far too indestructible-heavy — 3 and 2 full
walls respectively — now light pillar/accent use like levels 5/8's actual
maze intent). Added `src/game/generate.ts`: a seeded procedural level
generator for levels 9+ (`generateEndlessLevel(level)`), hooked into the
same `getLevelDef()` lookup and level-clear flow the 8 hand-built levels use
— no special-casing needed elsewhere.

- Density, brick-type mix (shifting toward reinforced/explosive with an
  indestructible ratio hard-capped at 22%), and ball speed (capped at 2.2x
  base via `cappedBaseSpeedForLevel`) all scale with level number.
- Solvability validation: flood-fills from the grid boundary through empty
  *and breakable* cells (breakable bricks don't block a path — they can be
  destroyed to open one), blocked only by indestructible cells. Rejects and
  regenerates (bumped seed, up to 25 attempts, then a guaranteed-solvable
  indestructible-free fallback) only the real failure case — a breakable
  brick fully walled in by indestructible bricks with no gap. Caught and
  fixed two real bugs here: an early version flagged any breakable brick
  without an *empty* neighbor as unsolvable (rejected normal dense brick
  packing, which is fine — bricks aren't walls), and a weighted-pick helper
  was returning brick-type names (`"reinforced"`) instead of grid chars
  (`"R"`), corrupting every generated grid.
- Deterministic per level number (mulberry32 PRNG, integer-hashed seed) —
  same level always generates identically, verified in
  `generate.test.ts` (11 tests: dimensions/valid chars, determinism,
  solvability incl. adversarial walled-in cases, indestructible ratio cap,
  speed cap).
- Store: `nextLevel` no longer caps at level 8 / sets a `win` phase — it's
  now the same flow for every level number. Removed the win screen and
  `win` phase entirely (level 8 clear flows straight into level 9). Added
  `highestLevelPassed` (drives "Continue — Level N" on the title screen;
  wiped by "Restart from level 1") and `bestLevelReached` (an all-time
  record like best score, never wiped) — both sessionStorage-backed.
- Fixed a latent SSR/hydration bug while touching this: the store was
  reading sessionStorage at module scope (`typeof window !== "undefined"`
  guards), which differs between server and client renders — same class of
  bug fixed for best score back in Phase 3, just not yet applied to the
  resume-snapshot/level-progress state added afterward. Consolidated all of
  it into one `hydrateFromStorage()` called after mount.
