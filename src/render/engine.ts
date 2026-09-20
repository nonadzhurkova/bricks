import { Application, Container, Graphics } from "pixi.js";
import gsap from "gsap";
import { circleRectCollision, reflectVelocity, resolvePenetration } from "@/physics/collision";
import { paddleBounce } from "@/physics/paddle";
import { accelerateOnRally, rescaleVelocity, SPEED_CAP_MULTIPLIER } from "@/physics/speed";
import type { Vec2 } from "@/physics/types";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BALL_RADIUS,
  BASE_SPEED,
  ENLARGE_WIDTH_MULTIPLIER,
  LASER_COOLDOWN_MS,
  LASER_HEIGHT,
  LASER_SPEED,
  LASER_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_SPEED_KEYBOARD,
  PADDLE_WIDTH,
  PADDLE_Y_OFFSET,
  POWERUP_FALL_SPEED,
  REDUCE_WIDTH_MULTIPLIER,
  REGROW_ANIM_MS,
  REGROW_DELAY_MS,
  SLOW_SPEED_MULTIPLIER,
  SPEED_PER_LEVEL_INCREASE,
} from "@/game/constants";
import { BRICK_SCORE } from "@/game/brickTypes";
import { allBreakableBricksCleared, buildBricksFromLevel, type Brick } from "@/game/brickGrid";
import type { LevelDef } from "@/game/levels/types";
import { POWERUPS, type PowerUpType } from "@/game/powerups";
import { createBallSprite, setBallFireball, updateBallTrail, type BallSprite } from "./sprites/ball";
import { createPaddleSprite, drawPaddleBody, type PaddleSprite } from "./sprites/paddle";
import { BRICK_PALETTE, createBrickGraphics, createRegrowGhost } from "./sprites/brick";
import { startRegrowIdlePulse } from "./animations/regrowPulse";
import { playBrickRegrow } from "./animations/brickRegrow";
import { createCapsuleSprite } from "./sprites/capsule";
import { playNormalBreak } from "./animations/brickBreakNormal";
import { playReinforcedCrack } from "./animations/brickBreakReinforced";
import { playIndestructibleSpark } from "./animations/brickBreakIndestructible";
import { chainExplosiveHits, playShockwaveRing } from "./animations/brickBreakExplosive";
import { playPowerUpRevealBreak } from "./animations/powerupReveal";
import { playPaddleImpact } from "./animations/paddleImpact";
import { startSlowRipple } from "./animations/slowRipple";
import { startBottomWall } from "./animations/bottomWall";
import { playPowerUpToast, playLifeLostToast } from "./animations/powerupToast";
import { endlessBaseSpeed } from "@/game/generate";

export interface EngineCallbacks {
  onScore: (points: number) => void;
  onLifeLost: () => void;
  onLevelClear: () => void;
  onPowerUpCaught?: (type: PowerUpType) => void;
  onPowerUpChanged?: (type: PowerUpType | null) => void;
  onPowerUpTimeRatio?: (ratio: number) => void;
  onExtraLife?: () => void;
  /** Fired whenever brick state changes (hit, break, level load) so the host can persist a resume snapshot. */
  onBricksChanged?: (bricks: Brick[]) => void;
}

interface FallingCapsule {
  type: PowerUpType;
  x: number;
  y: number;
  sprite: Container;
}

interface LaserBolt {
  x: number;
  y: number;
  sprite: Graphics;
}

export class GameEngine {
  /** Chained explosive shockwaves can themselves trigger further explosions; cap the recursion so a dense cluster can't cascade forever. */
  private static readonly MAX_EXPLOSION_CHAIN_DEPTH = 2;

  private app: Application;
  private callbacks: EngineCallbacks;

  private world = new Container();
  private brickLayer = new Container();
  private effectsLayer = new Container();
  private capsuleLayer = new Container();

  private paddle: PaddleSprite;
  private ball: BallSprite;

  private bricks: Brick[] = [];
  private brickSprites = new Map<string, Container>();
  /** Idle ambient-pulse stop functions for currently-healthy regenerating brick sprites, keyed by brick id — killed whenever that sprite is replaced (hit, broken, regrown) or the level reloads. */
  private brickPulseStops = new Map<string, () => void>();
  /** Engine-owned clock (ms since loadLevel/resetLevel), used for regrowAt timestamps — advances only while running, so it naturally pauses with the rest of the game instead of drifting against a wall clock. */
  private elapsedMs = 0;

  private capsules: FallingCapsule[] = [];
  private laserLayer = new Container();
  private lasers: LaserBolt[] = [];

  private paddleX = ARENA_WIDTH / 2 - PADDLE_WIDTH / 2;
  private paddleWidth = PADDLE_WIDTH;
  private basePaddleWidth = PADDLE_WIDTH;

  private ballPos: Vec2 = { x: 0, y: 0 };
  private ballVel: Vec2 = { x: 0, y: 0 };
  private ballAttached = true;
  private ballStuckToPaddle = false;
  private ballStickOffsetX = 0;
  /** True from the moment the ball drops out of bounds until resetBallOnPaddle/resetLevel/loadLevel reclaims it — suppresses repeat onLifeLost calls for the frames before React's phase-change effect runs (loseLife() decrements every call, so an un-suppressed repeat would burn multiple lives from a single drop). */
  private ballLost = false;

  private baseSpeed = BASE_SPEED;
  private currentSpeed = BASE_SPEED;
  private slowActive = false;

  private activePowerUp: PowerUpType | null = null;
  private powerUpElapsedMs = 0;
  private powerUpDurationMs = 0;
  private stopSlowRipple: (() => void) | null = null;
  private stopBottomWall: (() => void) | null = null;
  private laserCooldownMs = 0;

  private level: LevelDef | null = null;
  private running = false;
  private lastTime = 0;

  private keys = { left: false, right: false };
  private fireRequested = false;
  private levelClearTriggered = false;

  /** ms since the ball last broke/hit a breakable brick or bounced off the paddle — a sparse endless layout can leave the ball cycling between just a wall/paddle/one brick forever, so a long stretch of "progress" resets triggers a small angle nudge to break the loop. */
  private msSinceProgress = 0;
  private static readonly STALL_NUDGE_MS = 6000;

  constructor(app: Application, callbacks: EngineCallbacks) {
    this.app = app;
    this.callbacks = callbacks;

    this.app.stage.addChild(this.world);
    this.world.addChild(createArenaBorder());
    this.world.addChild(this.brickLayer);
    this.world.addChild(this.effectsLayer);
    this.world.addChild(this.capsuleLayer);
    this.world.addChild(this.laserLayer);

    this.paddle = createPaddleSprite(PADDLE_WIDTH, PADDLE_HEIGHT);
    this.paddle.container.y = ARENA_HEIGHT - PADDLE_Y_OFFSET;
    this.world.addChild(this.paddle.container);

    this.ball = createBallSprite(BALL_RADIUS);
    this.world.addChild(this.ball.container);

    this.app.ticker.add(this.tick);
  }

  /**
   * Loads a level's bricks. Pass `savedBricks` (e.g. from a localStorage
   * resume snapshot) to restore an exact in-progress brick state instead of
   * generating a fresh one; in that case entrance/stagger animation is
   * skipped since this isn't a "new level" moment.
   */
  loadLevel(level: LevelDef, levelNumber: number, savedBricks?: Brick[]): void {
    this.level = level;
    this.baseSpeed = endlessBaseSpeed(levelNumber, BASE_SPEED, SPEED_PER_LEVEL_INCREASE);
    this.currentSpeed = this.baseSpeed;

    this.brickLayer.removeChildren();
    this.brickSprites.clear();
    this.brickPulseStops.forEach((stop) => stop());
    this.brickPulseStops.clear();
    this.capsuleLayer.removeChildren();
    this.capsules = [];
    this.laserLayer.removeChildren();
    this.lasers = [];
    this.bricks = savedBricks ?? buildBricksFromLevel(level);
    this.clearPowerUp();
    this.levelClearTriggered = false;
    this.elapsedMs = 0;

    // A resumed dead regenerating brick's regrowAt was measured against the
    // previous session's elapsedMs clock, now reset to 0 — restart a fresh
    // regrow window for it instead of carrying over a stale/meaningless
    // timestamp.
    this.bricks.forEach((brick) => {
      if (brick.type === "regenerating" && !brick.alive) {
        brick.regrowAt = this.elapsedMs + REGROW_DELAY_MS;
      }
    });

    const animateEntrance = !savedBricks;

    this.bricks.forEach((brick, i) => {
      // A dead regenerating brick still gets a sprite (its ghost outline) —
      // every other dead brick has nothing left to show.
      if (!brick.alive && brick.type !== "regenerating") return;

      const sprite = this.createSpriteForBrick(brick);
      sprite.x = brick.x;
      sprite.y = brick.y;
      this.brickLayer.addChild(sprite);
      this.brickSprites.set(brick.id, sprite);

      if (brick.alive && brick.type === "regenerating") {
        this.brickPulseStops.set(brick.id, startRegrowIdlePulse(sprite));
      }

      if (animateEntrance && brick.alive) {
        sprite.alpha = 0;
        sprite.scale.set(0.6);
        gsap.to(sprite, {
          alpha: 1,
          duration: 0.22,
          delay: i * 0.015,
          ease: "back.out(1.6)",
        });
        gsap.to(sprite.scale, {
          x: 1,
          y: 1,
          duration: 0.22,
          delay: i * 0.015,
          ease: "back.out(1.6)",
        });
      }
    });

    this.callbacks.onBricksChanged?.(this.bricks);

    gsap.killTweensOf(this.ball.container);
    gsap.killTweensOf(this.world.scale);
    this.world.scale.set(1);
    this.world.pivot.set(0, 0);
    this.world.position.set(0, 0);
    this.ball.container.alpha = 1;
    this.running = true;
    this.lastTime = performance.now();

    this.resetBallOnPaddle();
  }

  getBricks(): Brick[] {
    return this.bricks;
  }

  /** Resets ball to attached-on-paddle state, keeping current brick state (life lost mid-level). */
  resetBallOnPaddle(): void {
    this.clearPowerUp();
    this.ballLost = false;
    this.msSinceProgress = 0;
    this.ballAttached = true;
    this.ballStuckToPaddle = false;
    this.currentSpeed = this.baseSpeed;
    this.ballVel = { x: 0, y: 0 };
    this.syncAttachedBallPosition();
  }

  /** Rebuilds bricks from the current level (3rd life lost -> restart level). */
  resetLevel(): void {
    if (this.level) {
      const levelNum = this.level.id;
      this.loadLevel(this.level, levelNum);
    }
  }

  /** 3rd life lost: paddle flashes red once, ball fades out (no shatter — nothing to celebrate). */
  playGameOverEffect(): void {
    this.running = false;

    const flash = new Graphics().rect(0, 0, this.paddleWidth, PADDLE_HEIGHT).fill({ color: 0xef4444 });
    this.paddle.container.addChild(flash);
    gsap.fromTo(
      flash,
      { alpha: 0.9 },
      {
        alpha: 0,
        duration: 0.4,
        ease: "power1.out",
        onComplete: () => flash.destroy(),
      },
    );

    gsap.to(this.ball.container, { alpha: 0, duration: 0.4, ease: "power1.out" });
  }

  private syncAttachedBallPosition(): void {
    this.ballPos = {
      x: this.paddleX + this.paddleWidth / 2,
      y: this.paddle.container.y - BALL_RADIUS - 1,
    };
  }

  setPaddleTargetX(centerX: number): void {
    const half = this.paddleWidth / 2;
    this.paddleX = clamp(centerX - half, 0, ARENA_WIDTH - this.paddleWidth);
  }

  setKey(key: "left" | "right", pressed: boolean): void {
    this.keys[key] = pressed;
  }

  /** Space/tap: launches an attached ball, releases a stuck (Catch) ball, or fires the laser. */
  launch(): void {
    if (this.ballAttached) {
      this.ballAttached = false;
      this.ballVel = { x: 0, y: -this.effectiveSpeed() };
      return;
    }
    if (this.ballStuckToPaddle) {
      this.releaseStuckBall();
      return;
    }
    if (this.activePowerUp === "laser") {
      this.fireRequested = true;
    }
  }

  /** Dedicated laser fire trigger (mobile fire button / desktop click), separate from launch/release. */
  fireLaser(): void {
    if (this.activePowerUp === "laser") {
      this.fireRequested = true;
    }
  }

  private releaseStuckBall(): void {
    this.ballStuckToPaddle = false;
    this.ballVel = paddleBounce(this.ballPos.x, this.paddleRect(), this.effectiveSpeed());
  }

  private paddleRect() {
    return {
      x: this.paddleX,
      y: this.paddle.container.y,
      width: this.paddleWidth,
      height: PADDLE_HEIGHT,
    };
  }

  /** currentSpeed scaled down while Slow is active; used for all outgoing velocity magnitudes. */
  private effectiveSpeed(): number {
    return this.slowActive ? this.currentSpeed * SLOW_SPEED_MULTIPLIER : this.currentSpeed;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    gsap.globalTimeline.resume();
  }

  stop(): void {
    this.running = false;
    gsap.globalTimeline.pause();
  }

  destroy(): void {
    this.app.ticker.remove(this.tick);
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    this.elapsedMs += dt * 1000;

    this.updatePaddle(dt);
    this.updateBall(dt);
    this.updateCapsules(dt);
    this.updateLasers(dt);
    this.updatePowerUpTimer(dt);
    this.updateStallCheck(dt);
    this.updateRegrowth();
    this.render();
  };

  /**
   * A sparse layout (mostly cleared endless levels especially) can leave
   * the ball settle into a stable bounce cycle — e.g. paddle <-> one brick
   * <-> wall — that never reaches the remaining bricks. If too long passes
   * without breaking/hitting a brick or bouncing off the paddle, nudge the
   * ball's velocity angle slightly to break the cycle without it feeling
   * like a scripted rescue.
   */
  private updateStallCheck(dt: number): void {
    if (!this.level || this.levelClearTriggered || this.ballAttached || this.ballLost) return;
    if (allBreakableBricksCleared(this.bricks)) return;

    this.msSinceProgress += dt * 1000;
    if (this.msSinceProgress < GameEngine.STALL_NUDGE_MS) return;

    this.msSinceProgress = 0;
    const speed = Math.hypot(this.ballVel.x, this.ballVel.y);
    if (speed <= 0) return;

    const angle = Math.atan2(this.ballVel.y, this.ballVel.x);
    const nudge = (Math.PI / 10) * (Math.random() < 0.5 ? -1 : 1);
    const newAngle = angle + nudge;
    this.ballVel = { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed };
  }

  private updatePaddle(dt: number): void {
    if (this.keys.left) {
      this.paddleX -= PADDLE_SPEED_KEYBOARD * dt;
    }
    if (this.keys.right) {
      this.paddleX += PADDLE_SPEED_KEYBOARD * dt;
    }
    this.paddleX = clamp(this.paddleX, 0, ARENA_WIDTH - this.paddleWidth);
  }

  private updateBall(dt: number): void {
    // Level already cleared (win sweep in progress) — freeze the ball so it
    // can't fall past the paddle and trigger a life-lost / game-over in the
    // brief window before onLevelClear fires.
    if (this.levelClearTriggered || this.ballLost) return;

    if (this.ballAttached) {
      this.syncAttachedBallPosition();
      return;
    }

    if (this.ballStuckToPaddle) {
      this.ballPos = {
        x: this.paddleX + this.ballStickOffsetX,
        y: this.paddle.container.y - BALL_RADIUS - 1,
      };
      return;
    }

    let remaining = dt;
    // simple sub-stepping to avoid tunneling at high speed
    const maxStep = BALL_RADIUS / this.currentSpeed;
    while (remaining > 0) {
      const step = Math.min(remaining, maxStep);
      const lost = this.stepBall(step);
      // ball fell out of bounds — onLifeLost already fired; stop stepping
      // this frame so we don't call it again for every remaining substep
      // (loseLife() decrements every call, so this could burn multiple
      // lives from a single drop before the phase change takes effect)
      if (lost) return;
      remaining -= step;
    }
  }

  /** Advances the ball by dt; returns true if the ball was lost this step. */
  private stepBall(dt: number): boolean {
    if (this.activePowerUp === "magnet") {
      this.applyMagnetPull(dt);
    }

    this.ballPos.x += this.ballVel.x * dt;
    this.ballPos.y += this.ballVel.y * dt;

    // walls
    if (this.ballPos.x - BALL_RADIUS < 0) {
      this.ballPos.x = BALL_RADIUS;
      this.ballVel.x = Math.abs(this.ballVel.x);
    } else if (this.ballPos.x + BALL_RADIUS > ARENA_WIDTH) {
      this.ballPos.x = ARENA_WIDTH - BALL_RADIUS;
      this.ballVel.x = -Math.abs(this.ballVel.x);
    }
    if (this.ballPos.y - BALL_RADIUS < 0) {
      this.ballPos.y = BALL_RADIUS;
      this.ballVel.y = Math.abs(this.ballVel.y);
    }

    // ball lost — unless Wall is active, in which case the bottom bounces like a wall
    if (this.ballPos.y + BALL_RADIUS > ARENA_HEIGHT) {
      if (this.activePowerUp === "wall") {
        this.ballPos.y = ARENA_HEIGHT - BALL_RADIUS;
        this.ballVel.y = -Math.abs(this.ballVel.y);
      } else {
        this.ballLost = true;
        playLifeLostToast(this.effectsLayer, this.paddleX + this.paddleWidth / 2, this.paddle.container.y - 20);
        this.callbacks.onLifeLost();
        return true;
      }
    }

    // paddle collision
    const paddleRect = this.paddleRect();
    const paddleHit = circleRectCollision({ ...this.ballPos, radius: BALL_RADIUS }, paddleRect);
    if (paddleHit && this.ballVel.y > 0) {
      const contactRatio = clamp((this.ballPos.x - paddleRect.x) / paddleRect.width, 0, 1);
      playPaddleImpact(this.paddle.container, this.paddleWidth, PADDLE_HEIGHT, contactRatio);

      if (this.activePowerUp === "catch") {
        this.ballStuckToPaddle = true;
        this.ballStickOffsetX = this.ballPos.x - this.paddleX;
        this.ballVel = { x: 0, y: 0 };
        this.ballPos.y = paddleRect.y - BALL_RADIUS - 1;
        return false;
      }

      this.currentSpeed = this.baseSpeed;
      this.ballVel = paddleBounce(this.ballPos.x, paddleRect, this.effectiveSpeed());
      this.ballPos.y = paddleRect.y - BALL_RADIUS - 1;
      return false;
    }

    // brick collisions
    if (this.activePowerUp === "fireball") {
      // Passes straight through every brick in its path — no bounce, no
      // penetration push-back, no speed rescale. Indestructible bricks are
      // ignored entirely (can't be burned, so no spark/effect either).
      // Doesn't `break` after one hit: at high speed a single substep can
      // overlap more than one brick, and fireball should burn all of them,
      // not just the first found.
      for (const brick of this.bricks) {
        if (!brick.alive || brick.type === "indestructible") continue;
        const rect = { x: brick.x, y: brick.y, width: brick.width, height: brick.height };
        const hit = circleRectCollision({ ...this.ballPos, radius: BALL_RADIUS }, rect);
        if (!hit) continue;

        this.msSinceProgress = 0;
        this.handleBrickHit(brick, hit.contact.x - brick.x, hit.contact.y - brick.y, 0, true);
      }
      return false;
    }

    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const rect = { x: brick.x, y: brick.y, width: brick.width, height: brick.height };
      const hit = circleRectCollision({ ...this.ballPos, radius: BALL_RADIUS }, rect);
      if (!hit) continue;

      this.ballVel = reflectVelocity(this.ballVel, hit.side);
      const pushed = resolvePenetration({ ...this.ballPos, radius: BALL_RADIUS }, hit);
      this.ballPos = pushed;

      this.msSinceProgress = 0;
      this.handleBrickHit(brick, hit.contact.x - brick.x, hit.contact.y - brick.y);
      break;
    }

    return false;
  }

  /**
   * Magnet: while the ball is moving downward (toward the paddle), bend its
   * horizontal velocity toward the paddle's current center each step — a
   * gentle continuous pull, not a snap — so it's much more likely to reach
   * the paddle. Speed magnitude is preserved (only the direction is
   * steered) so this doesn't interact with the rally-speed/Slow systems.
   * Has no effect while the ball is moving upward, away from the paddle.
   */
  private applyMagnetPull(dt: number): void {
    if (this.ballVel.y <= 0) return;

    const paddleCenterX = this.paddleX + this.paddleWidth / 2;
    const toPaddleX = paddleCenterX - this.ballPos.x;
    if (Math.abs(toPaddleX) < 1) return;

    const speed = Math.hypot(this.ballVel.x, this.ballVel.y);
    if (speed <= 0) return;

    const pullStrength = 2.2; // radians/sec turn rate toward the paddle, tuned to feel like a steady pull rather than an instant snap
    const currentAngle = Math.atan2(this.ballVel.y, this.ballVel.x);
    const targetAngle = Math.atan2(ARENA_HEIGHT - this.ballPos.y, toPaddleX);

    let delta = targetAngle - currentAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = pullStrength * dt;
    const turn = clamp(delta, -maxTurn, maxTurn);
    const newAngle = currentAngle + turn;

    this.ballVel = { x: Math.cos(newAngle) * speed, y: Math.sin(newAngle) * speed };
  }

  private handleBrickHit(
    brick: Brick,
    localContactX: number,
    localContactY: number,
    explosionDepth = 0,
    isFireballHit = false,
  ): void {
    if (brick.type === "indestructible") {
      playIndestructibleSpark(this.effectsLayer, brick.x + localContactX, brick.y + localContactY);
      return;
    }

    // A chain-reaction hit (explosion) or a fireball pass both force a full
    // break in one hit, matching "burns/blasts through everything" instead
    // of the ball's incremental hit-point model; direct hits still
    // decrement normally. Fireball additionally skips the rally-speed bump
    // and velocity rescale — it flies straight through at a constant speed,
    // not accelerating brick by brick like a normal rally.
    const isChainHit = explosionDepth > 0;
    if (isChainHit || isFireballHit) {
      brick.hitsRemaining = 0;
    } else {
      this.currentSpeed = accelerateOnRally(this.currentSpeed, this.baseSpeed);
      this.ballVel = rescaleVelocity(this.ballVel, this.effectiveSpeed());
      brick.hitsRemaining -= 1;
    }

    this.callbacks.onScore(BRICK_SCORE[brick.type]);

    // Reinforced and regenerating both take 2 hits: crack on the first,
    // full break on the second. Reinforced dims toward grey ("damaged,
    // weakening"); regenerating stays full teal while cracked ("damaged but
    // still alive" — dimming would read as "dying", which is wrong for a
    // brick that's about to come back anyway).
    if ((brick.type === "reinforced" || brick.type === "regenerating") && brick.hitsRemaining > 0) {
      playReinforcedCrack(this.effectsLayer, brick.x, brick.y, brick.width, brick.height);
      this.stopPulse(brick.id);
      const sprite = this.brickSprites.get(brick.id);
      if (sprite) {
        sprite.destroy();
        const cracked = createBrickGraphics(brick.type, brick.width, brick.height, {
          cracked: true,
          dimmed: brick.type === "reinforced",
        });
        cracked.x = brick.x;
        cracked.y = brick.y;
        this.brickLayer.addChild(cracked);
        this.brickSprites.set(brick.id, cracked);
      }
      this.callbacks.onBricksChanged?.(this.bricks);
      return;
    }

    // brick breaks fully
    this.breakBrick(brick);

    if (brick.type === "explosive" && explosionDepth < GameEngine.MAX_EXPLOSION_CHAIN_DEPTH) {
      this.triggerExplosion(brick, explosionDepth + 1);
    }

    if (allBreakableBricksCleared(this.bricks)) {
      this.playLevelClearSweep();
    }

    this.callbacks.onBricksChanged?.(this.bricks);
  }

  private breakBrick(brick: Brick): void {
    brick.alive = false;
    this.stopPulse(brick.id);
    const sprite = this.brickSprites.get(brick.id);
    sprite?.destroy();
    this.brickSprites.delete(brick.id);

    const color = BRICK_PALETTE[brick.type].base;

    if (brick.powerUp) {
      playPowerUpRevealBreak(
        this.effectsLayer,
        brick.x,
        brick.y,
        brick.width,
        brick.height,
        color,
        () => this.spawnCapsule(brick, brick.powerUp!),
      );
    } else {
      playNormalBreak({
        layer: this.effectsLayer,
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
        color,
      });
    }

    if (brick.type === "regenerating") {
      brick.regrowAt = this.elapsedMs + REGROW_DELAY_MS;
      const ghost = createRegrowGhost(brick.width, brick.height);
      ghost.x = brick.x;
      ghost.y = brick.y;
      this.brickLayer.addChild(ghost);
      this.brickSprites.set(brick.id, ghost);
    }
  }

  /** Stops and forgets a brick's idle-pulse loop, if it has one — safe to call on any brick id. */
  private stopPulse(brickId: string): void {
    this.brickPulseStops.get(brickId)?.();
    this.brickPulseStops.delete(brickId);
  }

  /** Builds the correct sprite for a brick's *current* state: healthy (with idle pulse if regenerating), cracked, or — for a dead regenerating brick — its ghost outline. */
  private createSpriteForBrick(brick: Brick): Container {
    if (!brick.alive && brick.type === "regenerating") {
      return createRegrowGhost(brick.width, brick.height);
    }
    return createBrickGraphics(brick.type, brick.width, brick.height, {
      cracked: (brick.type === "reinforced" || brick.type === "regenerating") && brick.hitsRemaining < brick.maxHits,
      dimmed: brick.type === "reinforced" && brick.hitsRemaining < brick.maxHits,
    });
  }

  /**
   * Regrow cycle for regenerating bricks: any dead one whose regrowAt has
   * elapsed on the engine's own clock comes back — hitsRemaining resets to
   * full, its ghost sprite is swapped for a fresh healthy sprite, and that
   * sprite plays a slow (REGROW_ANIM_MS) fade/scale-in rather than popping
   * in instantly, plus resumes its idle ambient pulse once fully healthy.
   */
  private updateRegrowth(): void {
    if (this.bricks.length === 0 || this.levelClearTriggered) return;

    for (const brick of this.bricks) {
      if (brick.type !== "regenerating" || brick.alive || brick.regrowAt === null) continue;
      if (this.elapsedMs < brick.regrowAt) continue;

      brick.alive = true;
      brick.hitsRemaining = brick.maxHits;
      brick.regrowAt = null;

      const ghost = this.brickSprites.get(brick.id);
      ghost?.destroy();

      const sprite = this.createSpriteForBrick(brick);
      sprite.x = brick.x;
      sprite.y = brick.y;
      this.brickLayer.addChild(sprite);
      this.brickSprites.set(brick.id, sprite);

      playBrickRegrow(sprite, REGROW_ANIM_MS).eventCallback("onComplete", () => {
        if (brick.alive) {
          this.brickPulseStops.set(brick.id, startRegrowIdlePulse(sprite));
        }
      });

      this.callbacks.onBricksChanged?.(this.bricks);
    }
  }

  /**
   * Shockwave from an exploding brick: only its immediate 3x3 grid
   * neighbors (up/down/left/right/diagonal — at most 8 bricks) are chained
   * via `handleBrickHit` (so each gets a full break — including its own
   * break animation, and its own shockwave if it's also explosive) after a
   * delay proportional to its distance from the blast center. Indestructible
   * neighbors spark instead of breaking. `depth` caps chained explosions
   * from re-triggering forever. The visual ring is still sized off the
   * brick's own dimensions purely for the animation, not the hit-test.
   */
  private triggerExplosion(sourceBrick: Brick, depth = 1): void {
    const centerX = sourceBrick.x + sourceBrick.width / 2;
    const centerY = sourceBrick.y + sourceBrick.height / 2;

    playShockwaveRing(this.effectsLayer, centerX, centerY, sourceBrick.width * 1.5);

    const touching = this.bricks.filter(
      (b) =>
        b.alive &&
        b.id !== sourceBrick.id &&
        Math.abs(b.col - sourceBrick.col) <= 1 &&
        Math.abs(b.row - sourceBrick.row) <= 1,
    );

    chainExplosiveHits(centerX, centerY, touching, (brick) => {
      if (!brick.alive) return;

      if (brick.type === "indestructible") {
        playIndestructibleSpark(this.effectsLayer, brick.x + brick.width / 2, brick.y + brick.height / 2);
        return;
      }

      this.handleBrickHit(brick, brick.width / 2, brick.height / 2, depth);
    });
  }

  /** Flashes + shatters any remaining (indestructible) bricks together, brief pull-back, then reports clear. */
  private playLevelClearSweep(): void {
    if (this.levelClearTriggered) return;
    this.levelClearTriggered = true;

    const remaining = this.bricks.filter((b) => b.alive);
    remaining.forEach((brick, i) => {
      const sprite = this.brickSprites.get(brick.id);
      if (!sprite) return;
      gsap.to(sprite, {
        alpha: 0,
        duration: 0.18,
        delay: i * 0.02,
        ease: "power1.in",
        onComplete: () => sprite.destroy(),
      });
    });

    // Pivot the pull-back around the arena's center instead of its
    // top-left origin — scaling `world` directly shifted the whole canvas
    // up-and-left toward (0,0), reading as a jarring jump right before the
    // level-cleared message.
    this.world.pivot.set(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    this.world.position.set(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    gsap.to(this.world.scale, {
      x: 0.97,
      y: 0.97,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: "power1.inOut",
      onComplete: () => {
        this.world.pivot.set(0, 0);
        this.world.position.set(0, 0);
      },
    });

    gsap.delayedCall(0.35, () => {
      this.callbacks.onLevelClear();
    });
  }

  private spawnCapsule(brick: Brick, type: PowerUpType): void {
    const sprite = createCapsuleSprite(type);
    sprite.container.x = brick.x + brick.width / 2;
    sprite.container.y = brick.y + brick.height / 2;
    this.capsuleLayer.addChild(sprite.container);
    this.capsules.push({
      type,
      x: sprite.container.x,
      y: sprite.container.y,
      sprite: sprite.container,
    });
  }

  private updateCapsules(dt: number): void {
    const paddleRect = this.paddleRect();

    this.capsules = this.capsules.filter((capsule) => {
      capsule.y += POWERUP_FALL_SPEED * dt;
      capsule.sprite.y = capsule.y;

      if (capsule.y > ARENA_HEIGHT + 20) {
        capsule.sprite.destroy();
        return false;
      }

      const withinX = capsule.x > paddleRect.x - 10 && capsule.x < paddleRect.x + paddleRect.width + 10;
      const withinY = capsule.y > paddleRect.y - 6 && capsule.y < paddleRect.y + paddleRect.height + 6;
      if (withinX && withinY) {
        this.callbacks.onPowerUpCaught?.(capsule.type);
        this.applyPowerUp(capsule.type);
        playPowerUpToast(this.effectsLayer, capsule.x, capsule.y, capsule.type);
        capsule.sprite.destroy();
        return false;
      }

      return true;
    });
  }

  private applyPowerUp(type: PowerUpType): void {
    if (type === "extraLife") {
      this.callbacks.onExtraLife?.();
      return;
    }

    // Catching the same power-up that's already active just refreshes its
    // timer back to full duration, instead of tearing down and rebuilding
    // the same visual state (ripple/wall restart) for no reason. Scoped to
    // Slow and Wall only — Enlarge/Reduce/Catch/Laser keep the original
    // full replace-on-catch behavior even for a same-type recatch.
    const REFRESHABLE_TYPES: PowerUpType[] = ["slow", "wall"];
    if (this.activePowerUp === type && REFRESHABLE_TYPES.includes(type)) {
      this.powerUpElapsedMs = 0;
      this.callbacks.onPowerUpTimeRatio?.(1);
      return;
    }

    // catching any new power-up reverts a previous Reduce (or any other active state)
    this.clearPowerUp();

    this.activePowerUp = type;
    this.powerUpElapsedMs = 0;
    const def = POWERUPS[type];
    this.powerUpDurationMs = def.duration ?? 0;
    this.callbacks.onPowerUpChanged?.(type);
    this.callbacks.onPowerUpTimeRatio?.(1);

    drawPaddleBody(this.paddle.body, this.paddleWidth, PADDLE_HEIGHT, type);

    switch (type) {
      case "enlarge":
        this.setPaddleWidth(this.basePaddleWidth * ENLARGE_WIDTH_MULTIPLIER);
        break;
      case "reduce":
        this.setPaddleWidth(this.basePaddleWidth * REDUCE_WIDTH_MULTIPLIER);
        break;
      case "slow":
        this.slowActive = true;
        this.stopSlowRipple = startSlowRipple(this.paddle.container, this.paddleWidth, PADDLE_HEIGHT);
        break;
      case "wall":
        this.stopBottomWall = startBottomWall(this.world, ARENA_WIDTH, ARENA_HEIGHT);
        break;
      case "fireball":
        setBallFireball(this.ball, BALL_RADIUS, true);
        break;
      case "catch":
      case "laser":
      case "magnet":
        break;
    }
  }

  /** Reverts to the normal paddle state — called on power-up expiry or when a new one is caught. */
  private clearPowerUp(): void {
    if (this.activePowerUp === null) return;

    this.stopSlowRipple?.();
    this.stopSlowRipple = null;
    this.slowActive = false;
    this.stopBottomWall?.();
    this.stopBottomWall = null;
    if (this.activePowerUp === "fireball") {
      setBallFireball(this.ball, BALL_RADIUS, false);
    }
    if (this.ballStuckToPaddle) {
      this.releaseStuckBall();
    }
    this.setPaddleWidth(this.basePaddleWidth);
    drawPaddleBody(this.paddle.body, this.paddleWidth, PADDLE_HEIGHT, "normal");

    this.activePowerUp = null;
    this.powerUpElapsedMs = 0;
    this.powerUpDurationMs = 0;
    this.callbacks.onPowerUpChanged?.(null);
    this.callbacks.onPowerUpTimeRatio?.(0);
  }

  private setPaddleWidth(width: number): void {
    const centerX = this.paddleX + this.paddleWidth / 2;
    this.paddleWidth = width;
    this.paddleX = clamp(centerX - width / 2, 0, ARENA_WIDTH - width);
    drawPaddleBody(this.paddle.body, this.paddleWidth, PADDLE_HEIGHT, this.activePowerUp ?? "normal");
  }

  private updatePowerUpTimer(dt: number): void {
    if (!this.activePowerUp || this.powerUpDurationMs <= 0) return;
    this.powerUpElapsedMs += dt * 1000;
    const ratio = Math.max(0, 1 - this.powerUpElapsedMs / this.powerUpDurationMs);
    this.callbacks.onPowerUpTimeRatio?.(ratio);
    if (ratio <= 0) {
      this.clearPowerUp();
    }
  }

  private updateLasers(dt: number): void {
    if (this.laserCooldownMs > 0) {
      this.laserCooldownMs -= dt * 1000;
    }

    if (this.fireRequested) {
      this.fireRequested = false;
      if (this.activePowerUp === "laser" && this.laserCooldownMs <= 0) {
        this.spawnLaserBolts();
        this.laserCooldownMs = LASER_COOLDOWN_MS;
      }
    }

    this.lasers = this.lasers.filter((bolt) => {
      bolt.y -= LASER_SPEED * dt;
      bolt.sprite.y = bolt.y;

      if (bolt.y < -LASER_HEIGHT) {
        bolt.sprite.destroy();
        return false;
      }

      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const rect = { x: brick.x, y: brick.y, width: brick.width, height: brick.height };
        const hit = circleRectCollision({ x: bolt.x, y: bolt.y, radius: LASER_WIDTH }, rect);
        if (!hit) continue;

        bolt.sprite.destroy();
        this.handleBrickHit(brick, hit.contact.x - brick.x, hit.contact.y - brick.y);
        return false;
      }

      return true;
    });
  }

  private spawnLaserBolts(): void {
    const rect = this.paddleRect();
    const offsets = [rect.width * 0.12, rect.width * 0.88];
    for (const offset of offsets) {
      const sprite = new Graphics();
      sprite.rect(-LASER_WIDTH / 2, -LASER_HEIGHT / 2, LASER_WIDTH, LASER_HEIGHT).fill({ color: 0xfde68a });
      sprite.x = rect.x + offset;
      sprite.y = rect.y;
      this.laserLayer.addChild(sprite);
      this.lasers.push({ x: sprite.x, y: sprite.y, sprite });
    }
  }

  private render(): void {
    this.paddle.container.x = this.paddleX;
    this.ball.container.x = this.ballPos.x;
    this.ball.container.y = this.ballPos.y;
    const speedRatio = Math.min(this.currentSpeed / (this.baseSpeed * SPEED_CAP_MULTIPLIER), 1);
    updateBallTrail(this.ball, this.ballPos.x, this.ballPos.y, speedRatio);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Visible glass frame around the play field — left/right/top walls the ball bounces off of. */
function createArenaBorder(): Container {
  const container = new Container();

  const glow = new Graphics();
  glow
    .rect(-2, -2, ARENA_WIDTH + 4, ARENA_HEIGHT + 4)
    .stroke({ color: 0x67e8f9, width: 4, alpha: 0.18 });
  container.addChild(glow);

  const line = new Graphics();
  line.moveTo(0, ARENA_HEIGHT).lineTo(0, 0).lineTo(ARENA_WIDTH, 0).lineTo(ARENA_WIDTH, ARENA_HEIGHT);
  line.stroke({ color: 0x9ae8f5, width: 2, alpha: 0.6 });
  container.addChild(line);

  return container;
}
