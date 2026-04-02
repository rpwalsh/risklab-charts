// ============================================================================
// RiskLab Charts — Timeline Playback UI Controls
// Renders play/pause, scrubber, speed selector, and frame counter
// as a DOM overlay beneath the chart
// ============================================================================

import type { TimelinePlayback, TimelineState } from './TimelinePlayback';

const CONTROL_HEIGHT = 36;

export interface TimelineControlsConfig {
  /** Show speed selector */
  showSpeed?: boolean;
  /** Show frame counter */
  showFrameCounter?: boolean;
  /** Available speed presets */
  speeds?: number[];
  /** Format the current time label */
  timeFormat?: (time: unknown) => string;
}

/**
 * DOM-based playback controls that attach below the chart container.
 * Wire up with `TimelinePlayback` for full play/pause/scrub/speed control.
 */
export class TimelineControls {
  private container: HTMLElement;
  private root: HTMLElement;
  private playback: TimelinePlayback;
  private config: TimelineControlsConfig;
  private unsubscribe: (() => void) | null = null;

  // DOM elements
  private playBtn!: HTMLButtonElement;
  private scrubber!: HTMLInputElement;
  private timeLabel!: HTMLSpanElement;
  private speedSelect!: HTMLSelectElement;
  private frameLabel!: HTMLSpanElement;

  constructor(
    container: HTMLElement,
    playback: TimelinePlayback,
    config: TimelineControlsConfig = {},
  ) {
    this.container = container;
    this.playback = playback;
    this.config = {
      showSpeed: true,
      showFrameCounter: true,
      speeds: [0.25, 0.5, 1, 1.5, 2, 4],
      ...config,
    };

    this.root = document.createElement('div');
    this.root.className = 'uc-timeline-controls';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Timeline playback controls');
    this.applyRootStyles();
    this.buildDOM();
    this.attachListeners();
    this.container.appendChild(this.root);

    // Subscribe to playback state changes
    this.unsubscribe = this.playback.onChange((state) => this.updateUI(state));

    // Initial UI sync
    this.updateUI(this.playback.getState());
  }

  /** Height in pixels consumed by the controls bar */
  static get height(): number {
    return CONTROL_HEIGHT;
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.root.remove();
  }

  // ─── DOM Construction ───────────────────────────────────────────────

  private applyRootStyles(): void {
    Object.assign(this.root.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: `${CONTROL_HEIGHT}px`,
      padding: '0 12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '12px',
      color: '#6b7280',
      borderTop: '1px solid #e5e7eb',
      background: '#fafafa',
      userSelect: 'none',
      boxSizing: 'border-box',
    });
  }

  private buildDOM(): void {
    // ── Play / Pause Button ──
    this.playBtn = document.createElement('button');
    this.playBtn.type = 'button';
    this.playBtn.className = 'uc-timeline-play';
    this.playBtn.setAttribute('aria-label', 'Play');
    this.playBtn.title = 'Play / Pause';
    this.playBtn.innerHTML = PLAY_ICON;
    Object.assign(this.playBtn.style, {
      width: '28px',
      height: '28px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      flexShrink: '0',
    });
    this.root.appendChild(this.playBtn);

    // ── Time label ──
    this.timeLabel = document.createElement('span');
    this.timeLabel.className = 'uc-timeline-time';
    Object.assign(this.timeLabel.style, {
      minWidth: '70px',
      textAlign: 'center',
      fontVariantNumeric: 'tabular-nums',
      flexShrink: '0',
    });
    this.root.appendChild(this.timeLabel);

    // ── Scrubber / Range Input ──
    this.scrubber = document.createElement('input');
    this.scrubber.type = 'range';
    this.scrubber.className = 'uc-timeline-scrubber';
    this.scrubber.min = '0';
    this.scrubber.max = '1000';
    this.scrubber.value = '0';
    this.scrubber.step = '1';
    this.scrubber.setAttribute('aria-label', 'Timeline position');
    Object.assign(this.scrubber.style, {
      flex: '1',
      height: '4px',
      cursor: 'pointer',
      accentColor: '#4F46E5',
    });
    this.root.appendChild(this.scrubber);

    // ── Frame Counter ──
    if (this.config.showFrameCounter) {
      this.frameLabel = document.createElement('span');
      this.frameLabel.className = 'uc-timeline-frame';
      Object.assign(this.frameLabel.style, {
        minWidth: '60px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: '0',
        color: '#9ca3af',
        fontSize: '11px',
      });
      this.root.appendChild(this.frameLabel);
    }

    // ── Speed Selector ──
    if (this.config.showSpeed) {
      this.speedSelect = document.createElement('select');
      this.speedSelect.className = 'uc-timeline-speed';
      this.speedSelect.setAttribute('aria-label', 'Playback speed');
      for (const speed of this.config.speeds!) {
        const opt = document.createElement('option');
        opt.value = String(speed);
        opt.textContent = `${speed}×`;
        if (speed === 1) opt.selected = true;
        this.speedSelect.appendChild(opt);
      }
      Object.assign(this.speedSelect.style, {
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        padding: '2px 4px',
        fontSize: '11px',
        background: '#fff',
        cursor: 'pointer',
        flexShrink: '0',
      });
      this.root.appendChild(this.speedSelect);
    }
  }

  // ─── Event Listeners ────────────────────────────────────────────────

  private attachListeners(): void {
    this.playBtn.addEventListener('click', () => {
      const state = this.playback.getState();
      if (state.playing) {
        this.playback.pause();
      } else {
        this.playback.play();
      }
      this.updateUI(this.playback.getState());
    });

    this.scrubber.addEventListener('input', () => {
      const progress = Number(this.scrubber.value) / 1000;
      this.playback.seekProgress(progress);
    });

    if (this.config.showSpeed && this.speedSelect) {
      this.speedSelect.addEventListener('change', () => {
        this.playback.setSpeed(Number(this.speedSelect.value));
      });
    }
  }

  // ─── UI Update ──────────────────────────────────────────────────────

  private updateUI(state: TimelineState): void {
    // Play/Pause icon
    this.playBtn.innerHTML = state.playing ? PAUSE_ICON : PLAY_ICON;
    this.playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');

    // Scrubber position
    this.scrubber.value = String(Math.round(state.progress * 1000));

    // Time label
    this.timeLabel.textContent = this.formatTime(state.currentTime);

    // Frame counter
    if (this.config.showFrameCounter && this.frameLabel) {
      this.frameLabel.textContent = `${state.currentFrame + 1} / ${state.totalFrames}`;
    }
  }

  private formatTime(time: unknown): string {
    if (this.config.timeFormat) {
      return this.config.timeFormat(time);
    }
    if (typeof time === 'number') {
      // If it looks like a Unix timestamp in ms (> year 2000), format as date
      if (time > 946684800000) {
        const d = new Date(time);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return String(time);
    }
    return String(time ?? '');
  }
}

// ─── SVG Icons (inline, no external deps) ─────────────────────────────────

const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;

const PAUSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
