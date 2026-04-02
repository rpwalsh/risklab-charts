// ============================================================================
// RiskLab Charts — Timeline Playback Controller
// Manages playback-over-time: play, pause, scrub, speed, loop
// ============================================================================

import type { TimelineConfig, DataValue, SeriesConfig } from '../core/types';
import { EventBus } from '../core/EventBus';

export interface TimelineState {
  currentFrame: number;
  totalFrames: number;
  currentTime: DataValue;
  playing: boolean;
  speed: number;
  progress: number; // 0–1
}

export type TimelineChangeHandler = (state: TimelineState) => void;

export class TimelinePlayback {
  private config: TimelineConfig;
  private bus: EventBus;
  private rafId: number | null = null;
  private frames: DataValue[] = [];
  private currentFrame = 0;
  private playing = false;
  private speed = 1;
  private lastTimestamp = 0;
  private accumulated = 0;
  private onChangeHandlers: TimelineChangeHandler[] = [];

  constructor(config: TimelineConfig, bus: EventBus) {
    this.config = config;
    this.bus = bus;
    this.speed = config.speed ?? 1;
  }

  /**
   * Initialize with sorted unique time values extracted from series data.
   */
  initialize(series: SeriesConfig[]): void {
    const timeKey = this.config.timeKey ?? 'time';
    const timeSet = new Set<number>();

    for (const s of series) {
      for (const d of s.data) {
        const t = d.meta?.[timeKey] ?? d.x;
        let num: number;
        if (t instanceof Date) {
          num = t.getTime();
        } else {
          num = Number(t);
          // Fall back to date-string parsing so ISO-8601 time keys work
          if (!isFinite(num) && typeof t === 'string') {
            num = Date.parse(t);
          }
        }
        if (isFinite(num)) timeSet.add(num);
      }
    }

    this.frames = Array.from(timeSet).sort((a, b) => a - b);
    this.currentFrame = 0;

    if (this.config.autoPlay) {
      this.play();
    }
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTimestamp = performance.now();
    this.tick();
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  stop(): void {
    this.pause();
    this.currentFrame = 0;
    this.emitChange();
  }

  /** Jump to a specific frame index */
  seekFrame(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.frames.length - 1));
    this.emitChange();
  }

  /** Jump to a progress value 0–1 */
  seekProgress(progress: number): void {
    this.seekFrame(Math.round(progress * (this.frames.length - 1)));
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getState(): TimelineState {
    return {
      currentFrame: this.currentFrame,
      totalFrames: this.frames.length,
      currentTime: this.frames[this.currentFrame] ?? 0,
      playing: this.playing,
      speed: this.speed,
      progress: this.frames.length > 1 ? this.currentFrame / (this.frames.length - 1) : 0,
    };
  }

  onChange(handler: TimelineChangeHandler): () => void {
    this.onChangeHandlers.push(handler);
    return () => {
      this.onChangeHandlers = this.onChangeHandlers.filter((h) => h !== handler);
    };
  }

  destroy(): void {
    this.pause();
    this.onChangeHandlers = [];
    this.frames = [];
  }

  // ---- Internal ----

  private tick = (): void => {
    if (!this.playing) return;

    const now = performance.now();
    const delta = now - this.lastTimestamp;
    this.lastTimestamp = now;

    const fps = this.config.fps ?? 30;
    const frameInterval = 1000 / (fps * this.speed);

    this.accumulated += delta;

    if (this.accumulated >= frameInterval) {
      this.accumulated = this.accumulated % frameInterval; // consume all accumulated time
      this.advance();
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private advance(): void {
    if (this.currentFrame >= this.frames.length - 1) {
      if (this.config.loop) {
        this.currentFrame = 0;
      } else {
        this.pause();
        return;
      }
    } else {
      this.currentFrame++;
    }
    this.emitChange();
  }

  private emitChange(): void {
    const state = this.getState();
    this.bus.emit('timelineChange', { payload: state as unknown as Record<string, unknown> });
    for (const handler of this.onChangeHandlers) {
      handler(state);
    }
  }
}
