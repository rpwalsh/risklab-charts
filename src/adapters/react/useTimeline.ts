// ============================================================================
// RiskLab Charts — React: useTimeline Hook
// Declarative hook for controlling chart timeline playback
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { TimelinePlayback } from '../../animations/TimelinePlayback';
import type { Engine } from '../../core/Engine';

export interface UseTimelineOptions {
  /** The engine instance to control */
  engine: Engine | null;
  /** Auto-play when engine is ready */
  autoPlay?: boolean;
  /** Playback speed multiplier */
  speed?: number;
  /** Loop playback */
  loop?: boolean;
  /** Frames per second */
  fps?: number;
}

export interface UseTimelineReturn {
  /** Is currently playing? */
  isPlaying: boolean;
  /** Current frame index */
  currentFrame: number;
  /** Total frame count */
  totalFrames: number;
  /** Progress 0..1 */
  progress: number;
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Stop and reset */
  stop: () => void;
  /** Seek to a specific frame */
  seekFrame: (frame: number) => void;
  /** Seek to a progress 0..1 */
  seekProgress: (progress: number) => void;
  /** Set playback speed */
  setSpeed: (speed: number) => void;
}

export function useTimeline(options: UseTimelineOptions): UseTimelineReturn {
  const { engine, autoPlay = false, speed = 1, loop = false, fps = 30 } = options;
  const playbackRef = useRef<TimelinePlayback | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!engine) return;

    const config = engine.getConfig();
    const bus = engine.getEventBus();
    const timelineConfig = config.timeline ?? {
      enabled: true,
      speed: speed,
      loop: loop,
      fps: fps,
      autoPlay: autoPlay,
    };

    const playback = new TimelinePlayback(timelineConfig, bus);
    playback.setSpeed(speed);
    playback.initialize(config.series);

    const unsub = playback.onChange((state) => {
      setCurrentFrame(state.currentFrame);
      setTotalFrames(state.totalFrames);
      setProgress(state.progress);
      setIsPlaying(state.playing);
    });

    playbackRef.current = playback;
    setTotalFrames(playback.getState().totalFrames);

    if (autoPlay) {
      playback.play();
      setIsPlaying(true);
    }

    return () => {
      unsub();
      playback.destroy();
      playbackRef.current = null;
    };
  }, [engine, autoPlay, speed, loop, fps]);

  const play = useCallback(() => {
    playbackRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    playbackRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    playbackRef.current?.stop();
    setIsPlaying(false);
    setCurrentFrame(0);
    setProgress(0);
  }, []);

  const seekFrame = useCallback((frame: number) => {
    playbackRef.current?.seekFrame(frame);
    setCurrentFrame(frame);
  }, []);

  const seekProgress = useCallback((p: number) => {
    playbackRef.current?.seekProgress(p);
    setProgress(p);
  }, []);

  const setSpeed = useCallback((s: number) => {
    playbackRef.current?.setSpeed(s);
  }, []);

  return {
    isPlaying,
    currentFrame,
    totalFrames,
    progress,
    play,
    pause,
    stop,
    seekFrame,
    seekProgress,
    setSpeed,
  };
}
