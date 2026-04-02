// ============================================================================
// RiskLab Charts — Navigator Chart
// Mini overview chart with draggable handles for range selection.
// Mirrors Highcharts Stock's navigator. Used with Engine's zoomToRange().
// ============================================================================

import type { BaseRenderer } from '../../renderers/BaseRenderer';
import type { ChartConfig, ChartState, ThemeConfig } from '../../core/types';
import type { ProcessedDataPoint, ProcessedSeries } from '../../core/DataPipeline';
import { createScale } from '../../scales';

export interface NavigatorConfig {
  /** Enable the navigator */
  enabled?: boolean;
  /** Height of the navigator panel in pixels */
  height?: number;
  /** Margin from the main chart area bottom */
  margin?: number;
  /** Fill color of the selected range */
  selectedFill?: string;
  /** Handle color */
  handleColor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Show navigator series (mini chart) */
  showSeries?: boolean;
}

export interface NavigatorState {
  /** Left handle position as fraction 0–1 */
  leftHandle: number;
  /** Right handle position as fraction 0–1 */
  rightHandle: number;
  dragging: 'left' | 'right' | 'range' | null;
  dragStartX: number;
  dragStartLeft: number;
  dragStartRight: number;
}

// Singleton navigator state per chart
const navigatorStates = new WeakMap<object, NavigatorState>();

/** Returns {navX, navY, navW, navH} bounding box of the navigator */
export function getNavigatorBounds(state: ChartState, navConfig: NavigatorConfig): {
  navX: number; navY: number; navW: number; navH: number;
} {
  const navH = navConfig.height ?? 60;
  const margin = navConfig.margin ?? 20;
  const navX = state.chartArea.x;
  const navY = state.chartArea.y + state.chartArea.height + margin;
  const navW = state.chartArea.width;
  return { navX, navY, navW, navH };
}

/** Render the navigator chrome (after chart series are drawn) */
export function renderNavigatorChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  config: ChartConfig,
  theme: ThemeConfig,
  navConfig: NavigatorConfig = {},
): void {
  if (navConfig.enabled === false) return;

  const { navX, navY, navW, navH } = getNavigatorBounds(state, navConfig);
  const bg = navConfig.backgroundColor ?? (theme.tooltip.backgroundColor as string ?? '#f9fafb');
  const selectedFill = navConfig.selectedFill ?? 'rgba(99,102,241,0.12)';
  const handleColor = navConfig.handleColor ?? '#6366f1';
  const _fontFamily = theme.fontFamily;

  // Get or init navigator state — keyed on ChartState which is stable across
  // engine.update() calls (config is replaced by update(), state is not).
  const stateKey = state as object;
  let navState = navigatorStates.get(stateKey);
  if (!navState) {
    navState = { leftHandle: 0, rightHandle: 1, dragging: null, dragStartX: 0, dragStartLeft: 0, dragStartRight: 0 };
    navigatorStates.set(stateKey, navState);
  }

  renderer.beginGroup('navigator', 'uc-navigator');

  // Background
  renderer.drawRect(navX, navY, navW, navH, {
    fill: bg,
    stroke: (theme.axis.gridColor as string) ?? '#e5e7eb',
    strokeWidth: 1,
  }, 3);

  // Mini series
  if (navConfig.showSeries !== false && series.length > 0) {
    const mainSeries = series.filter(s => s.visible !== false)[0];
    if (mainSeries) {
      const data = (mainSeries.processedData ?? mainSeries.data) as ProcessedDataPoint[];
      if (data.length > 1) {
        // Build a mini scale
        const xVals = data.map(d => Number(d.xNum ?? d.x));
        const yVals = data.map(d => Number(d.yNum ?? d.y));
        const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
        const yMin = Math.min(...yVals), yMax = Math.max(...yVals);

        const xScale = createScale('linear', [xMin, xMax], [navX, navX + navW]);
        const yScale = createScale('linear', [yMin, yMax], [navY + navH - 4, navY + 4]);

        // Fill area under mini series
        const color = (mainSeries.color as string) ?? theme.palette[0] ?? '#6366f1';
        const pts = data.map(d => ({
          x: xScale.convert(d.xNum ?? d.x),
          y: yScale.convert(d.yNum ?? d.y),
        }));

        if (pts.length > 0) {
          let areaPts = `M${pts[0]!.x},${navY + navH}`;
          for (const p of pts) areaPts += `L${p.x},${p.y}`;
          areaPts += `L${pts[pts.length - 1]!.x},${navY + navH}Z`;
          renderer.drawPath(areaPts, { fill: `${color}40`, stroke: 'none' });

          let linePts = `M${pts[0]!.x},${pts[0]!.y}`;
          for (let i = 1; i < pts.length; i++) linePts += `L${pts[i]!.x},${pts[i]!.y}`;
          renderer.drawPath(linePts, { stroke: color, strokeWidth: 1, fill: 'none' });
        }
      }
    }
  }

  // Selected mask (left and right dark regions)
  const lx = navX + navState.leftHandle * navW;
  const rx = navX + navState.rightHandle * navW;

  // Unselected left
  if (navState.leftHandle > 0) {
    renderer.drawRect(navX, navY, lx - navX, navH, {
      fill: 'rgba(0,0,0,0.08)',
      stroke: 'none',
    });
  }
  // Unselected right
  if (navState.rightHandle < 1) {
    renderer.drawRect(rx, navY, navX + navW - rx, navH, {
      fill: 'rgba(0,0,0,0.08)',
      stroke: 'none',
    });
  }
  // Selected range highlight border
  renderer.drawRect(lx, navY, rx - lx, navH, {
    fill: selectedFill,
    stroke: handleColor,
    strokeWidth: 1,
  });

  // Left handle
  drawHandle(renderer, lx, navY, navH, handleColor);
  // Right handle
  drawHandle(renderer, rx, navY, navH, handleColor);

  renderer.endGroup();
}

function drawHandle(
  renderer: BaseRenderer,
  x: number,
  y: number,
  h: number,
  color: string,
): void {
  const HW = 6;
  const HH = Math.min(24, h * 0.5);
  const hy = y + h / 2 - HH / 2;

  renderer.drawRect(x - HW / 2, hy, HW, HH, {
    fill: color,
    stroke: '#fff',
    strokeWidth: 1,
  }, 3);

  // Grip lines
  const gx = x;
  for (const dy of [-4, 0, 4]) {
    renderer.drawLine(gx - 1.5, hy + HH / 2 + dy, gx + 1.5, hy + HH / 2 + dy, {
      stroke: '#fff',
      strokeWidth: 1,
      opacity: 0.7,
    });
  }
}

/**
 * Call from Engine's mouseup handler to end a navigator drag session.
 */
export function stopNavigatorDrag(config: ChartConfig, state: ChartState): void {
  const navState = navigatorStates.get(state as object);
  if (navState) navState.dragging = null;
}

/**
 * Call from Engine's mousedown handler to start a navigator drag session.
 * Must be called before updateNavigatorDrag.
 */
export function startNavigatorDrag(
  px: number,
  dragType: 'left' | 'right' | 'range',
  config: ChartConfig,
  state: ChartState,
  navConfig: NavigatorConfig,
): void {
  const { navX: _navX, navW: _navW } = getNavigatorBounds(state, navConfig);
  let navState = navigatorStates.get(state as object);
  if (!navState) {
    navState = { leftHandle: 0, rightHandle: 1, dragging: null, dragStartX: 0, dragStartLeft: 0, dragStartRight: 0 };
    navigatorStates.set(state as object, navState);
  }
  navState.dragging = dragType;
  navState.dragStartX = px;
  navState.dragStartLeft = navState.leftHandle;
  navState.dragStartRight = navState.rightHandle;
}

/**
 * Call from Engine's mouse handlers to check if navigator handles are being dragged.
 * Returns updated left/right fractions, or null if the event was not in the navigator.
 */
export function hitTestNavigator(
  px: number,
  py: number,
  state: ChartState,
  config: ChartConfig,
  navConfig: NavigatorConfig,
): 'left' | 'right' | 'range' | null {
  const { navX, navY, navW, navH } = getNavigatorBounds(state, navConfig);
  if (px < navX || px > navX + navW || py < navY || py > navY + navH) return null;

  const navState = navigatorStates.get(state as object);
  if (!navState) return null;

  const lx = navX + navState.leftHandle * navW;
  const rx = navX + navState.rightHandle * navW;
  const HW = 12; // hit area

  if (Math.abs(px - lx) <= HW) return 'left';
  if (Math.abs(px - rx) <= HW) return 'right';
  if (px > lx && px < rx) return 'range';
  return null;
}

/** Update navigator handles on drag. Returns { min, max } as fractions. */
export function updateNavigatorDrag(
  px: number,
  config: ChartConfig,
  state: ChartState,
  navConfig: NavigatorConfig,
): { left: number; right: number } | null {
  const { navX, navW } = getNavigatorBounds(state, navConfig);
  const navState = navigatorStates.get(state as object);
  if (!navState || !navState.dragging) return null;

  const frac = Math.max(0, Math.min(1, (px - navX) / navW));
  const dragDelta = frac - (navState.dragStartX - navX) / navW;

  if (navState.dragging === 'left') {
    navState.leftHandle = Math.max(0, Math.min(
      navState.dragStartLeft + dragDelta,
      navState.rightHandle - 0.02,
    ));
  } else if (navState.dragging === 'right') {
    navState.rightHandle = Math.min(1, Math.max(
      navState.dragStartRight + dragDelta,
      navState.leftHandle + 0.02,
    ));
  } else if (navState.dragging === 'range') {
    const span = navState.dragStartRight - navState.dragStartLeft;
    let newLeft = navState.dragStartLeft + dragDelta;
    let newRight = navState.dragStartRight + dragDelta;
    if (newLeft < 0) { newLeft = 0; newRight = span; }
    if (newRight > 1) { newRight = 1; newLeft = 1 - span; }
    navState.leftHandle = newLeft;
    navState.rightHandle = newRight;
  }

  return { left: navState.leftHandle, right: navState.rightHandle };
}
