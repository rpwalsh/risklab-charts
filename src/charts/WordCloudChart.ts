// ============================================================================
// RiskLab Charts — Word Cloud Chart
// Spiral-placement word cloud. Words sized by value, colored by palette.
// No external dependencies — pure SVG/Canvas.
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig } from '../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../core/DataPipeline';

export interface WordCloudConfig {
  /** Spiral type: 'archimedean' | 'rectangular' (default: 'archimedean') */
  spiral?: 'archimedean' | 'rectangular';
  /** Min font size in px (default: 10) */
  minFontSize?: number;
  /** Max font size in px (default: 60) */
  maxFontSize?: number;
  /** Font family (default: theme font) */
  fontFamily?: string;
  /** Font weight (default: 'bold') */
  fontWeight?: string | number;
  /** Rotation range in degrees [min, max] (default: [-60, 60]) */
  rotationRange?: [number, number];
  /** Allowed rotation angles — overrides rotationRange */
  rotations?: number[];
  /** Padding between words in px (default: 4) */
  padding?: number;
  /** Allow rotation: false to keep all words horizontal */
  allowRotation?: boolean;
}

interface PlacedWord {
  text: string;
  value: number;
  fontSize: number;
  rotation: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/**
 * Estimate rendered text width (approximate; avoids canvas measurement on SSR)
 */
function estimateTextWidth(text: string, fontSize: number, fontWeight: string | number): number {
  // Bold text ≈ fontSize * 0.65 per char; regular ≈ 0.55
  const charWidth = fontWeight === 'bold' || fontWeight === 700 ? 0.62 : 0.55;
  return text.length * fontSize * charWidth;
}

/**
 * Check if two bounding boxes overlap (with padding)
 */
function overlaps(a: PlacedWord, b: PlacedWord, pad: number): boolean {
  return !(
    a.x + a.width / 2 + pad < b.x - b.width / 2 ||
    a.x - a.width / 2 - pad > b.x + b.width / 2 ||
    a.y + a.height / 2 + pad < b.y - b.height / 2 ||
    a.y - a.height / 2 - pad > b.y + b.height / 2
  );
}

/**
 * Seeded PRNG (mulberry32) — deterministic, SSR-safe, no Math.random().
 * Returns a function that produces values in [0, 1).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Place words using an Archimedean spiral
 */
function placeWords(
  words: Array<{ text: string; value: number; fontSize: number; rotation: number; color: string }>,
  cx: number,
  cy: number,
  boundW: number,
  boundH: number,
  padding: number,
  rand: () => number,
): PlacedWord[] {
  const placed: PlacedWord[] = [];

  for (const word of words) {
    const ww = estimateTextWidth(word.text, word.fontSize, 'bold');
    const wh = word.fontSize * 1.2;

    // Try to place on Archimedean spiral
    let found = false;
    const maxSteps = 800;
    for (let step = 0; step < maxSteps; step++) {
      const angle = step * 0.25;
      const r = step * 0.4;
      const wx = Math.cos(angle) * r;
      const wy = Math.sin(angle) * r * (boundH / boundW); // aspect-ratio adjusted

      const candidate: PlacedWord = {
        ...word,
        x: cx + wx,
        y: cy + wy,
        width: ww,
        height: wh,
      };

      // Bounds check
      if (
        candidate.x - ww / 2 < cx - boundW / 2 ||
        candidate.x + ww / 2 > cx + boundW / 2 ||
        candidate.y - wh / 2 < cy - boundH / 2 ||
        candidate.y + wh / 2 > cy + boundH / 2
      ) continue;

      // Collision check
      let clash = false;
      for (const p of placed) {
        if (overlaps(candidate, p, padding)) { clash = true; break; }
      }

      if (!clash) {
        placed.push(candidate);
        found = true;
        break;
      }
    }

    // If couldn't place, try with smaller font
    if (!found) {
      const shrunk: PlacedWord = {
        ...word,
        x: cx + (rand() - 0.5) * boundW * 0.5,
        y: cy + (rand() - 0.5) * boundH * 0.5,
        width: ww * 0.7,
        height: wh * 0.7,
        fontSize: word.fontSize * 0.7,
      };
      if (
        shrunk.x - shrunk.width / 2 > cx - boundW / 2 &&
        shrunk.x + shrunk.width / 2 < cx + boundW / 2 &&
        shrunk.y - shrunk.height / 2 > cy - boundH / 2 &&
        shrunk.y + shrunk.height / 2 < cy + boundH / 2 &&
        !placed.some(p => overlaps(shrunk, p, padding))
      ) {
        placed.push(shrunk);
      }
    }
  }

  return placed;
}

/**
 * Render a word cloud chart.
 * `series.data` format: `[{ x: 'word', y: weight }, ...]`
 * or shorthand `[['word', weight], ...]`
 */
export function renderWordCloud(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config: WordCloudConfig = {},
): void {
  const {
    minFontSize = 10,
    maxFontSize = 60,
    fontFamily = theme.fontFamily,
    fontWeight = 'bold',
    rotationRange = [-45, 45],
    rotations,
    padding = 4,
    allowRotation = true,
  } = config;

  const { chartArea: ca } = state;
  const cx = ca.x + ca.width / 2;
  const cy = ca.y + ca.height / 2;

  // Deterministic seeded PRNG — consistent across renders & SSR-safe
  const rand = seededRandom(42);

  for (const s of series) {
    const data = (s.processedData ?? s.data) as ProcessedDataPoint[];
    if (data.length === 0) continue;

    // Normalize values
    const words = data.map(d => ({
      text: String(d.label ?? d.x ?? d.word ?? ''),
      value: Number(d.yNum ?? d.y ?? 0),
    }));

    let maxVal = -Infinity, minVal = Infinity;
    for (const w of words) {
      if (w.value > maxVal) maxVal = w.value;
      if (w.value < minVal) minVal = w.value;
    }
    const valRange = maxVal - minVal || 1;

    // Sort by value desc so large words are placed first
    words.sort((a, b) => b.value - a.value);

    // Assign sizes and colors
    const prepared = words.map((w, i) => {
      const t = (w.value - minVal) / valRange;
      const fontSize = minFontSize + t * (maxFontSize - minFontSize);
      const color = (s.color as string) ?? theme.palette[i % theme.palette.length] ?? '#6366f1';

      let rotation = 0;
      if (allowRotation) {
        if (rotations && rotations.length > 0) {
          rotation = rotations[i % rotations.length]!;
        } else {
          rotation = rotationRange[0] + rand() * (rotationRange[1] - rotationRange[0]);
          // Snap to -90, 0, or 90 for readability
          if (Math.abs(rotation) < 15) rotation = 0;
          else if (rotation > 0) rotation = 45;
          else rotation = -45;
        }
      }

      return { text: w.text, value: w.value, fontSize, rotation, color };
    });

    // Place all words
    const placed = placeWords(prepared, cx, cy, ca.width, ca.height, padding, rand);

    renderer.beginGroup(`wordcloud-${s.id}`, `uc-wordcloud`);

    for (const pw of placed) {
      const _isRotated = pw.rotation !== 0;

      // Use the group transform for rotation — works for both SVG and Canvas
      const gid = `word-${s.id}-${pw.text.replace(/\W/g, '_').slice(0, 12)}`;
      renderer.beginGroup(gid, undefined, `translate(${pw.x},${pw.y}) rotate(${pw.rotation})`);
      renderer.drawText(0, pw.fontSize * 0.35, pw.text, {
        fill: pw.color,
        fontSize: Math.round(pw.fontSize),
        fontFamily,
        fontWeight: String(fontWeight),
        textAnchor: 'middle',
      });
      renderer.endGroup();
    }

    renderer.endGroup();
  }
}
