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
  SLOW_SPEED_MULTIPLIER,
  SPEED_PER_LEVEL_INCREASE,
} from "@/game/constants";
import { BRICK_SCORE } from "@/game/brickTypes";
import { allBreakableBricksCleared, buildBricksFromLevel, type Brick } from "@/game/brickGrid";
import type { LevelDef } from "@/game/levels/types";
import { POWERUPS, type PowerUpType } from "@/game/powerups";
import { createBallSprite, updateBallTrail, type BallSprite } from "./sprites/ball";
import { createPaddleSprite, drawPaddleBody, type PaddleSprite } from "./sprites/paddle";
import { createBrickGraphics } from "./sprites/brick";
import { createCapsuleSprite } from "./sprites/capsule";
import { playNormalBreak } from "./animations/brickBreakNormal";
import { playReinforcedCrack } from "./animations/brickBreakReinforced";
import { playIndestructibleSpark } from "./animations/brickBreakIndestructible";
import { chainExplosiveHits, playShockwaveRing } from "./animations/brickBreakExplosive";
import { playPowerUpRevealBreak } from "./animations/powerupReveal";
import { playPaddleImpact } from "./animations/paddleImpact";
import { startSlowRipple } from "./animations/slowRipple";
import { playPowerUpToast } from "./animations/powerupToast";
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

  private baseSpeed = BASE_SPEED;
  private currentSpeed = BASE_SPEED;
  private slowActive = false;

  private activePowerUp: PowerUpType | null = null;
  private powerUpElapsedMs = 0;
  private powerUpDurationMs = 0;
  private stopSlowRipple: (() => void) | null = null;
  private laserCooldownMs = 0;

  private level: LevelDef | null = null;
  private running = false;
  private lastTime = 0;

  private keys = { left: false, right: false };
  private fireRequested = false;
  private levelClearTriggered = false;

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
    this.capsuleLayer.removeChildren();
    this.capsules = [];
    this.laserLayer.removeChildren();
    this.lasers = [];
    this.bricks = savedBricks ?? buildBricksFromLevel(level);
    this.clearPowerUp();
    this.levelClearTriggered = false;

    const animateEntrance = !savedBricks;

    this.bricks.forEach((brick, i) => {
      if (!brick.alive) return;
      const sprite = createBrickGraphics(
        brick.type,
        brick.width,
        brick.height,
        brick.type === "reinforced" && brick.hitsRemaining < brick.maxHits,
      );
      sprite.x = brick.x;
      sprite.y = brick.y;
      this.brickLayer.addChild(sprite);
      this.brickSprites.set(brick.id, sprite);

      if (animateEntrance) {
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

    this.updatePaddle(dt);
    this.updateBall(dt);
    this.updateCapsules(dt);
    this.updateLasers(dt);
    this.updatePowerUpTimer(dt);
    this.render();
  };

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
      this.stepBall(step);
      remaining -= step;
    }
  }

  private stepBall(dt: number): void {
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

    // ball lost
    if (this.ballPos.y - BALL_RADIUS > ARENA_HEIGHT) {
      this.callbacks.onLifeLost();
      return;
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
        return;
      }

      this.currentSpeed = this.baseSpeed;
      this.ballVel = paddleBounce(this.ballPos.x, paddleRect, this.effectiveSpeed());
      this.ballPos.y = paddleRect.y - BALL_RADIUS - 1;
      return;
    }

    // brick collisions
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      const rect = { x: brick.x, y: brick.y, width: brick.width, height: brick.height };
      const hit = circleRectCollision({ ...this.ballPos, radius: BALL_RADIUS }, rect);
      if (!hit) continue;

      this.ballVel = reflectVelocity(this.ballVel, hit.side);
      const pushed = resolvePenetration({ ...this.ballPos, radius: BALL_RADIUS }, hit);
      this.ballPos = pushed;

      this.handleBrickHit(brick, hit.contact.x - brick.x, hit.contact.y - brick.y);
      break;
    }
  }

  private handleBrickHit(
    brick: Brick,
    localContactX: number,
    localContactY: number,
    explosionDepth = 0,
  ): void {
    if (brick.type === "indestructible") {
      playIndestructibleSpark(this.effectsLayer, brick.x + localContactX, brick.y + localContactY);
      return;
    }

    // A chain-reaction hit forces a full break (matches an explosion's real
    // blast) instead of going through the ball's incremental hit-point
    // model; direct hits still decrement normally.
    const isChainHit = explosionDepth > 0;
    if (isChainHit) {
      brick.hitsRemaining = 0;
    } else {
      this.currentSpeed = accelerateOnRally(this.currentSpeed, this.baseSpeed);
      this.ballVel = rescaleVelocity(this.ballVel, this.effectiveSpeed());
      brick.hitsRemaining -= 1;
    }

    this.callbacks.onScore(BRICK_SCORE[brick.type]);

    if (brick.type === "reinforced" && brick.hitsRemaining > 0) {
      playReinforcedCrack(this.effectsLayer, brick.x, brick.y, brick.width, brick.height);
      const sprite = this.brickSprites.get(brick.id);
      if (sprite) {
        sprite.destroy();
        const dimmed = createBrickGraphics(brick.type, brick.width, brick.height, true);
        dimmed.x = brick.x;
        dimmed.y = brick.y;
        this.brickLayer.addChild(dimmed);
        this.brickSprites.set(brick.id, dimmed);
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
    const sprite = this.brickSprites.get(brick.id);
    sprite?.destroy();
    this.brickSprites.delete(brick.id);

    if (brick.powerUp) {
      playPowerUpRevealBreak(
        this.effectsLayer,
        brick.x,
        brick.y,
        brick.width,
        brick.height,
        () => this.spawnCapsule(brick, brick.powerUp!),
      );
    } else {
      playNormalBreak({
        layer: this.effectsLayer,
        x: brick.x,
        y: brick.y,
        width: brick.width,
        height: brick.height,
      });
    }
  }

  /**
   * Expanding shockwave from an exploding brick: any non-indestructible
   * brick within radius is chained via `handleBrickHit` (so it gets a full
   * break — including its own break animation, and its own shockwave if
   * it's also explosive) after a delay proportional to its distance from
   * the blast center. Indestructible bricks in range spark instead of
   * breaking. `depth` caps chained explosions from re-triggering forever.
   */
  private triggerExplosion(sourceBrick: Brick, depth = 1): void {
    const centerX = sourceBrick.x + sourceBrick.width / 2;
    const centerY = sourceBrick.y + sourceBrick.height / 2;
    const shockwaveRadius = sourceBrick.width * 3;

    playShockwaveRing(this.effectsLayer, centerX, centerY, shockwaveRadius);

    const touching = this.bricks.filter(
      (b) =>
        b.alive &&
        b.id !== sourceBrick.id &&
        Math.hypot(b.x + b.width / 2 - centerX, b.y + b.height / 2 - centerY) <= shockwaveRadius,
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

    gsap.to(this.world.scale, {
      x: 0.97,
      y: 0.97,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: "power1.inOut",
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
      case "catch":
      case "laser":
        break;
    }
  }

  /** Reverts to the normal paddle state — called on power-up expiry or when a new one is caught. */
  private clearPowerUp(): void {
    if (this.activePowerUp === null) return;

    this.stopSlowRipple?.();
    this.stopSlowRipple = null;
    this.slowActive = false;
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
