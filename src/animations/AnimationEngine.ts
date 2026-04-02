// ============================================================================
// RiskLab Charts — Animation Engine
// Handles all chart animations: enter, update, exit, and timeline playback
// ============================================================================

import type { AnimationConfig, EasingFunction } from '../core/types';

interface ActiveAnimation {
  id: string;
  startTime: number;
  duration: number;
  delay: number;
  easing: EasingFunction;
  cubicBezierPoints?: [number, number, number, number];
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
  cancelled: boolean;
}

/** Easing function implementations */
const easingFunctions: Record<EasingFunction, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  bounceOut: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  cubicBezier: (t) => t, // Overridden per-animation
  spring: (t) => {
    const w = 7, d = 0.7;
    return 1 - Math.exp(-d * w * t) * Math.cos(w * Math.sqrt(1 - d * d) * t);
  },
};

export class AnimationEngine {
  private animations = new Map<string, ActiveAnimation>();
  private idCounter = 0;
  /** Single shared RAF handle — null when the loop is not running */
  private rafId: number | null = null;

  /** The shared tick drives ALL animations in a single RAF callback per frame. */
  private readonly tick = (timestamp: number): void => {
    this.rafId = null;

    for (const [id, anim] of this.animations) {
      if (anim.cancelled) {
        this.animations.delete(id);
        continue;
      }

      if (anim.startTime < 0) {
        anim.startTime = timestamp + anim.delay;
      }

      const elapsed = timestamp - anim.startTime;
      if (elapsed < 0) {
        // Still in delay period — keep alive, loop must reschedule
        continue;
      }

      const rawProgress = Math.min(elapsed / Math.max(anim.duration, 1), 1);
      const easedProgress = this.applyEasing(rawProgress, anim.easing, anim.cubicBezierPoints);

      anim.onUpdate(easedProgress);

      if (rawProgress >= 1) {
        this.animations.delete(id);
        anim.onComplete?.();
      }
    }

    // Reschedule only if there are still live animations
    if (this.animations.size > 0) {
      this.scheduleFrame();
    }
  };

  /** Schedule a frame only if one is not already pending. */
  private scheduleFrame(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  /**
   * Start a new animation.
   * Returns an id that can be passed to `cancel()`.
   */
  animate(
    onUpdate: (progress: number) => void,
    config?: Partial<AnimationConfig>,
    onComplete?: () => void,
  ): string {
    const id = `anim-${++this.idCounter}`;
    const duration = config?.duration ?? 600;
    const delay = config?.delay ?? 0;
    const easing = config?.easing ?? 'easeOut';

    const anim: ActiveAnimation = {
      id,
      startTime: -1,
      duration,
      delay,
      easing,
      cubicBezierPoints: config?.cubicBezier,
      onUpdate,
      onComplete,
      cancelled: false,
    };

    this.animations.set(id, anim);
    this.scheduleFrame();
    return id;
  }

  /**
   * Animate a value from `from` to `to`.
   */
  animateValue(
    from: number,
    to: number,
    onUpdate: (value: number) => void,
    config?: Partial<AnimationConfig>,
    onComplete?: () => void,
  ): string {
    return this.animate(
      (progress) => onUpdate(from + (to - from) * progress),
      config,
      onComplete,
    );
  }

  /**
   * Animate multiple values simultaneously.
   */
  animateValues(
    entries: Array<{ from: number; to: number; key: string }>,
    onUpdate: (values: Record<string, number>) => void,
    config?: Partial<AnimationConfig>,
    onComplete?: () => void,
  ): string {
    return this.animate(
      (progress) => {
        const values: Record<string, number> = {};
        for (const entry of entries) {
          values[entry.key] = entry.from + (entry.to - entry.from) * progress;
        }
        onUpdate(values);
      },
      config,
      onComplete,
    );
  }

  /**
   * Cancel a specific animation.
   */
  cancel(id: string): void {
    const anim = this.animations.get(id);
    if (anim) {
      anim.cancelled = true;
      this.animations.delete(id);
      // Cancel the shared loop only when no animations remain
      if (this.animations.size === 0 && this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  /**
   * Cancel all running animations.
   */
  cancelAll(): void {
    for (const [, anim] of this.animations) {
      anim.cancelled = true;
    }
    this.animations.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Number of currently running animations.
   */
  get activeCount(): number {
    return this.animations.size;
  }

  private applyEasing(
    t: number,
    easing: EasingFunction,
    bezierPoints?: [number, number, number, number],
  ): number {
    if (easing === 'cubicBezier' && bezierPoints) {
      return cubicBezier(bezierPoints[0], bezierPoints[1], bezierPoints[2], bezierPoints[3], t);
    }
    return easingFunctions[easing](t);
  }
}

/**
 * Attempt cubic bezier evaluation.
 * Using Newton-Raphson method for the parametric t.
 */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
  // Simplified — sample the bezier curve
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  // Solve for parametric t given x
  let param = t;
  for (let i = 0; i < 8; i++) {
    const x = ((ax * param + bx) * param + cx) * param - t;
    if (Math.abs(x) < 1e-6) break;
    const dx = (3 * ax * param + 2 * bx) * param + cx;
    if (Math.abs(dx) < 1e-6) break;
    param -= x / dx;
  }

  return ((ay * param + by) * param + cy) * param;
}

export { easingFunctions, cubicBezier };
