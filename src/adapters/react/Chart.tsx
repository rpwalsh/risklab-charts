// ============================================================================
// RiskLab Charts — React: <Chart /> Component
// High-level declarative React component for rendering any chart type
// ============================================================================

import React, {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
  useState,
  memo,
  type CSSProperties,
} from 'react';
import { Engine } from '../../core/Engine';
import type { EngineChartConfig, EngineInternalAPI } from '../../core/Engine';
import type {
  ChartConfig,
  SeriesConfig,
  AxisConfig,
  LegendConfig,
  TooltipConfig,
  AnimationConfig,
  TimelineConfig,
  InteractionConfig,
  ThemeConfig,
  RiskLabPlugin,
  ExportConfig,
  AccessibilityConfig,
  AnnotationConfig,
  ResponsiveRule,
  ChartEventType,
  ChartEventHandler,
  DataPoint,
} from '../../core/types';
import { useRiskLabOptional } from './RiskLabProvider';
import { useResponsiveChart } from './useResponsiveChart';

// ─── Public API Handle ──────────────────────────────────────────────────────

export interface ChartHandle {
  /** Get the underlying Engine instance */
  getEngine(): Engine | null;
  /** Export chart as image or SVG */
  export(format?: 'png' | 'svg' | 'jpeg'): Promise<Blob | string>;
  /** Programmatically update config */
  update(config: Partial<ChartConfig>): void;
  /** Replace series data */
  setData(series: SeriesConfig[]): void;
  /** Add a series */
  addSeries(series: SeriesConfig): void;
  /** Remove a series by id */
  removeSeries(id: string): void;
  /** Toggle series visibility */
  toggleSeries(id: string): void;
  /** Force resize */
  resize(width?: number, height?: number): void;
  /** Append a single data point to a series (real-time streaming) */
  addPoint(
    seriesId: string,
    point: DataPoint,
    options?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ): void;
  /** Append multiple data points to a series in a single render */
  addPoints(
    seriesId: string,
    points: DataPoint[],
    options?: { shift?: boolean; redraw?: boolean; maxPoints?: number },
  ): void;
  /** Update a single data point in-place */
  updatePoint(
    seriesId: string,
    index: number,
    update: Partial<DataPoint>,
  ): void;
  /** Trigger print dialog (requires PrintPlugin to be active) */
  print(): void;
  /** Zoom to a specific x-range */
  zoomToRange?(xMin: number, xMax: number, axisId?: string): void;
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ChartProps {
  /** Array of data series */
  series: SeriesConfig[];
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Container width — number (px) or CSS string */
  width?: number | string;
  /** Container height — number (px) or CSS string */
  height?: number | string;
  /** Renderer type */
  renderer?: 'svg' | 'canvas';
  /** Theme name or config */
  theme?: string | ThemeConfig;
  /** X-axis configuration (partial — defaults filled by component) */
  xAxis?: Partial<AxisConfig>;
  /** Y-axis configuration (or array for multi-axis; partial — defaults filled) */
  yAxis?: Partial<AxisConfig> | Partial<AxisConfig>[];
  /** Legend configuration */
  legend?: LegendConfig;
  /** Tooltip configuration */
  tooltip?: TooltipConfig;
  /** Animation configuration */
  animation?: AnimationConfig;
  /** Timeline / playback configuration */
  timeline?: TimelineConfig;
  /** Interaction options (zoom, pan, selection) */
  interaction?: InteractionConfig;
  /** Annotations */
  annotations?: AnnotationConfig[];
  /** Export options */
  export?: ExportConfig;
  /** Accessibility */
  accessibility?: AccessibilityConfig;
  /** Responsive breakpoint rules */
  responsive?: ResponsiveRule[];
  /** Plugins */
  plugins?: RiskLabPlugin[];
  /** Additional CSS class */
  className?: string;
  /** Inline styles for the container div */
  style?: CSSProperties;
  /** Callback when chart is ready */
  onReady?: (engine: Engine) => void;
  /** Callback on click */
  onClick?: ChartEventHandler<'click'>;
  /** Callback on hover */
  onHover?: ChartEventHandler<'hover'>;
  /** Callback on series toggle */
  onSeriesToggle?: ChartEventHandler<'seriesShow'>;
  /** Callback on selection */
  onSelection?: ChartEventHandler<'select'>;
  /** Additional event listeners */
  events?: Partial<Record<ChartEventType, ChartEventHandler>>;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Declarative React component for RiskLab charts.
 *
 * ```tsx
 * <Chart
 *   ref={chartRef}
 *   series={[
 *     { id: 's1', name: 'Revenue', type: 'line', data: myData },
 *   ]}
 *   title="Monthly Revenue"
 *   theme="dark"
 *   height={400}
 *   legend={{ position: 'bottom' }}
 *   tooltip={{ shared: true }}
 *   animation={{ enabled: true, duration: 600 }}
 *   onClick={(e) => console.log('clicked', e)}
 * />
 * ```
 */
export const Chart = memo(
  forwardRef<ChartHandle, ChartProps>(function Chart(props, ref) {
    const {
      series,
      title,
      subtitle,
      width = '100%',
      height = 400,
      renderer = 'svg',
      theme,
      xAxis,
      yAxis,
      legend,
      tooltip,
      animation,
      timeline,
      interaction,
      annotations,
      export: exportConfig,
      accessibility,
      responsive,
      plugins = [],
      className,
      style,
      onReady,
      onClick,
      onHover,
      onSeriesToggle,
      onSelection,
      events,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<Engine | null>(null);
    const [ready, setReady] = useState(false);

    // Inherit from provider if available
    const provider = useRiskLabOptional();

    // Build merged config
    const buildConfig = (): Omit<ChartConfig, 'container'> => {
      const providerDefaults = provider?.defaults ?? {};
      const mergedTheme = theme ?? provider?.theme ?? 'default';
      const mergedPlugins = [
        ...(provider?.plugins ?? []),
        ...plugins,
      ];

      // Build axes array from xAxis/yAxis props  
      const axes: AxisConfig[] = [];
      if (xAxis) {
        const xDefaults: AxisConfig = { id: 'x0', position: 'bottom', type: 'linear' };
        axes.push({ ...xDefaults, ...xAxis });
      }
      if (yAxis) {
        const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis];
        yAxes.forEach((ya, i) => {
          const yDefaults: AxisConfig = { id: `y${i}`, position: 'left', type: 'linear' };
          axes.push({ ...yDefaults, ...ya });
        });
      }

      return {
        ...providerDefaults,
        series,
        title: title ? { text: title } : providerDefaults.title,
        subtitle: subtitle ? { text: subtitle } : providerDefaults.subtitle,
        renderer: { backend: renderer ?? 'svg' },
        theme: mergedTheme,
        axes: axes.length > 0 ? axes : providerDefaults.axes,
        legend: legend ?? providerDefaults.legend,
        tooltip: tooltip ?? providerDefaults.tooltip,
        animation: animation ?? providerDefaults.animation,
        timeline: timeline ?? providerDefaults.timeline,
        interaction: interaction ?? providerDefaults.interaction,
        annotations: annotations ?? providerDefaults.annotations,
        export: exportConfig ?? providerDefaults.export,
        accessibility: accessibility ?? providerDefaults.accessibility,
        responsive: responsive ?? providerDefaults.responsive,
        plugins: mergedPlugins,
      };
    };

    // Initialize engine on mount
    useEffect(() => {
      if (!containerRef.current) return;

      const config = buildConfig();
      const engine = new Engine({
        ...config,
        container: containerRef.current,
        // Disable Engine's built-in ResizeObserver — the React adapter's
        // useResponsiveChart hook handles resize with its own debounce.
        _disableResize: true,
      } as EngineChartConfig);

      engineRef.current = engine;
      setReady(true);
      onReady?.(engine);

      return () => {
        engine.destroy();
        engineRef.current = null;
        setReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync props → engine updates
    useEffect(() => {
      if (!engineRef.current || !ready) return;
      const config = buildConfig();
      // Strip undefined values so they don't erase previously-set config keys.
      // e.g. if `legend` prop is not passed, we should NOT overwrite
      // the engine's current legend config with `undefined`.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(config)) {
        if (v !== undefined) cleaned[k] = v;
      }
      engineRef.current.update(cleaned as Partial<ChartConfig>);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      series, title, subtitle, renderer, theme, xAxis, yAxis,
      legend, tooltip, animation, timeline, interaction,
      annotations, exportConfig, accessibility, responsive, plugins,
      provider, // include provider so theme/plugin context changes are reflected
      ready,
    ]);

    // Bind event listeners
    useEffect(() => {
      if (!engineRef.current || !ready) return;
      const unsubs: Array<() => void> = [];

      if (onClick) unsubs.push(engineRef.current.on('click', onClick));
      if (onHover) unsubs.push(engineRef.current.on('hover', onHover));
      if (onSeriesToggle) unsubs.push(engineRef.current.on('seriesShow', onSeriesToggle));
      if (onSelection) unsubs.push(engineRef.current.on('select', onSelection));

      if (events) {
        for (const [type, handler] of Object.entries(events)) {
          if (handler) {
            unsubs.push(engineRef.current.on(type as ChartEventType, handler));
          }
        }
      }

      return () => unsubs.forEach(u => u());
    }, [onClick, onHover, onSeriesToggle, onSelection, events, ready]);

    // Auto-responsive: watch container for size changes
    useResponsiveChart({
      engine: engineRef.current,
      containerRef: containerRef as React.RefObject<HTMLElement>,
      debounce: 80,
    });

    // Imperative handle
    useImperativeHandle(ref, () => ({
      getEngine: () => engineRef.current,
      export: async (format = 'png') => {
        if (!engineRef.current) throw new Error('Chart not mounted');
        return engineRef.current.export(format);
      },
      update:       (config) => engineRef.current?.update(config),
      setData:      (s)      => engineRef.current?.setData(s),
      addSeries:    (s)      => engineRef.current?.addSeries(s),
      removeSeries: (id)     => engineRef.current?.removeSeries(id),
      toggleSeries: (id)     => engineRef.current?.toggleSeries(id),
      resize:       (w, h)   => engineRef.current?.resize(w, h),
      addPoint:     (seriesId, point, opts) =>
        engineRef.current?.addPoint(seriesId, point, opts),
      addPoints:    (seriesId, points, opts) =>
        engineRef.current?.addPoints(seriesId, points, opts),
      updatePoint:  (seriesId, index, update) =>
        engineRef.current?.updatePoint(seriesId, index, update),
      print: () => {
        const eng = engineRef.current as unknown as EngineInternalAPI | null;
        if (eng?._printChart) eng._printChart();
      },
      zoomToRange: (xMin, xMax, axisId) =>
        engineRef.current?.zoomToRange(axisId ?? 'x0', xMin, xMax),
    }), []);

    // Container styles
    const containerStyle: CSSProperties = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      position: 'relative',
      ...style,
    };

    return React.createElement('div', {
      ref: containerRef,
      className: className ? `risklab-chart ${className}` : 'risklab-chart',
      style: containerStyle,
      role: 'img',
      'aria-label': title ?? 'Chart',
    });
  })
);

Chart.displayName = 'RiskLab.Chart';
