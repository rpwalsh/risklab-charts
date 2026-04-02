// ============================================================================
// RiskLab Charts — Chart Renderer Dispatcher
// Routes each series to its chart-type-specific renderer
// ============================================================================

import type { BaseRenderer } from '../renderers/BaseRenderer';
import type { ChartState, ThemeConfig, ChartConfig } from '../core/types';
import type { ProcessedSeries } from '../core/DataPipeline';
import { renderLineSeries } from './LineChart';
import { renderAreaSeries } from './AreaChart';
import { renderBarSeries } from './BarChart';
import { renderScatterSeries } from './ScatterChart';
import { renderPieSeries } from './PieChart';
import { renderRadarSeries } from './RadarChart';
import { renderSankeySeries } from './SankeyChart';
import { renderHeatmapSeries } from './HeatmapChart';
import { renderCandlestickSeries } from './CandlestickChart';
import { renderWaterfallSeries } from './WaterfallChart';
import { renderFunnelSeries } from './FunnelChart';
import { renderGaugeSeries } from './GaugeChart';
import { renderBoxPlotSeries } from './BoxPlotChart';
import { renderTreemapSeries } from './TreemapChart';
import { renderBubbleSeries } from './BubbleChart';
import { renderGanttChart } from './GanttChart';
import { renderHistogramChart } from './HistogramChart';
import { renderOHLCChart } from './OHLCChart';
import { renderParetoChart } from './ParetoChart';
import { renderLollipopChart } from './LollipopChart';
import { renderRangeAreaSeries } from './RangeAreaChart';
import { renderTimelineChart } from './TimelineChart';
import { renderMapChart } from './MapChart';
import { renderCalendarHeatmap } from './CalendarHeatmap';
import { renderWordCloud } from './WordCloudChart';
import { renderDependencyWheel } from './DependencyWheelChart';
import { renderOrgChart } from './OrgChart';
import { renderPackedBubble } from './PackedBubbleChart';
import { renderMarimekko } from './MarimekkoChart';
import { renderVennDiagram } from './VennDiagram';
import { renderItemChart } from './ItemChart';
import { renderStreamgraph } from './StreamgraphChart';
import { renderXRange } from './XRangeChart';
import { renderSolidGauge } from './SolidGaugeChart';
import { renderTilemap } from './TilemapChart';
import { renderTreeGraph } from './TreeGraph';
import { renderColumnRange, renderDumbbellChart } from './ColumnRangeChart';
import { renderBellCurve } from './BellCurveChart';

// Advanced / Specialized Charts
import { renderPolarChart } from './advanced/PolarChart';
import { renderSmithChart } from './advanced/SmithChart';
import { renderContourChart } from './advanced/ContourChart';
import { renderVectorFieldChart } from './advanced/VectorFieldChart';
import { renderAltimeterGauge } from './advanced/AltimeterGauge';
import { renderAttitudeIndicator } from './advanced/AttitudeIndicator';
import { renderCompassRose } from './advanced/CompassRose';
import { renderSpectrumAnalyzer } from './advanced/SpectrumAnalyzer';
import { renderOscilloscope } from './advanced/Oscilloscope';
import { renderNetworkTopology } from './advanced/NetworkTopology';
import { renderFlameChart } from './advanced/FlameChart';
import { renderWindRose } from './advanced/WindRose';
import { renderStripChart } from './advanced/StripChart';
import { renderErrorBand } from './advanced/ErrorBand';
import { renderHorizonChart } from './advanced/HorizonChart';
import { renderBulletChart } from './advanced/BulletChart';
import { renderSparklineChart } from './advanced/SparklineChart';
import { renderViolinChart } from './advanced/ViolinChart';
import { renderSunburstChart } from './advanced/SunburstChart';
import { renderChordDiagram } from './advanced/ChordDiagram';

/**
 * Master render function — dispatches to chart type renderers.
 */
export function renderChart(
  renderer: BaseRenderer,
  series: ProcessedSeries[],
  state: ChartState,
  theme: ThemeConfig,
  config: ChartConfig,
): void {
  // Clip chart area
  renderer.defineClipRect(
    'chart-clip',
    state.chartArea.x,
    state.chartArea.y,
    state.chartArea.width,
    state.chartArea.height,
  );

  // Sort series by zIndex
  const sorted = [...series].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!;
    const seriesIndex = series.indexOf(s);
    const color = (s.color as string) ?? theme.palette[seriesIndex % theme.palette.length] ?? '#4F46E5';

    renderer.beginGroup(`series-${s.id}`, `uc-series uc-series-${s.type}`, undefined);

    switch (s.type) {
      // ─── Standard Chart Types ─────────────────────────────────────────
      case 'line':
      case 'spline':
      case 'stepLine':
      case 'connectedScatter':
        renderLineSeries(renderer, s, state, theme, color);
        break;
      case 'area':
      case 'stackedArea':
        renderAreaSeries(renderer, s, state, theme, color);
        break;
      case 'rangeArea':
      case 'arearange':
        renderRangeAreaSeries(renderer, s, state, theme, color, config);
        break;
      case 'bar':
      case 'column':
      case 'stackedBar':
      case 'stackedColumn': {
        // Count only bar/column series — mixing chart types (e.g. bars + line overlay)
        // must not shrink bar widths to accommodate the non-bar series.
        const barLikeSeries = sorted.filter(
          (ss) => ss.type === 'bar' || ss.type === 'column' ||
                  ss.type === 'stackedBar' || ss.type === 'stackedColumn',
        );
        const barSeriesIndex = barLikeSeries.indexOf(s);
        renderBarSeries(renderer, s, state, theme, color, barSeriesIndex, barLikeSeries.length);
        break;
      }
      case 'scatter':
        renderScatterSeries(renderer, s, state, theme, color);
        break;
      case 'bubble':
        renderBubbleSeries(renderer, s, state, theme, color);
        break;
      case 'pie':
      case 'donut':
        renderPieSeries(renderer, s, state, theme, s.type === 'donut');
        break;
      case 'radar':
        renderRadarSeries(renderer, s, state, theme, color, seriesIndex);
        break;
      case 'sankey':
        renderSankeySeries(renderer, s, state, theme, config);
        break;
      case 'heatmap':
        renderHeatmapSeries(renderer, s, state, theme, config);
        break;
      case 'candlestick':
        renderCandlestickSeries(renderer, s, state, theme, false);
        break;
      case 'ohlc':
        renderOHLCChart(renderer, [s], state, config, theme);
        break;
      case 'waterfall':
        renderWaterfallSeries(renderer, s, state, theme, color);
        break;
      case 'funnel':
        renderFunnelSeries(renderer, s, state, theme);
        break;
      case 'gauge':
        renderGaugeSeries(renderer, s, state, theme, config);
        break;
      case 'boxPlot':
        renderBoxPlotSeries(renderer, s, state, theme, color);
        break;
      case 'histogram':
        renderHistogramChart(renderer, [s], state, config, theme);
        break;
      case 'treemap':
        renderTreemapSeries(renderer, s, state, theme);
        break;
      case 'gantt':
        renderGanttChart(renderer, [s], state, config, theme);
        break;
      case 'timeline':
      case 'swimlane':
        renderTimelineChart(renderer, [s], state, config, theme);
        break;
      case 'pareto':
        renderParetoChart(renderer, [s], state, config, theme);
        break;
      case 'lollipop':
        renderLollipopChart(renderer, [s], state, config, theme);
        break;
      case 'dumbbell': {
        const dbs = sorted.filter(ss => ss.type === 'dumbbell');
        if (s === dbs[0]) renderDumbbellChart(renderer, dbs, state, theme, config);
        break;
      }
      case 'map':
        renderMapChart(renderer, [s], state, theme, config);
        break;
      case 'calendarHeatmap': {
        // Render all calendar series together on the first encounter
        const calSeries = sorted.filter((ss) => ss.type === 'calendarHeatmap');
        if (s === calSeries[0]) {
          renderCalendarHeatmap(renderer, calSeries, state, theme, config);
        }
        break;
      }

      // ─── Advanced / Specialized Chart Types ───────────────────────────
      case 'polar':
      case 'polarArea':
        renderPolarChart(renderer, s, state, theme, color, seriesIndex);
        break;
      case 'smith':
        renderSmithChart(renderer, s, state, theme, color);
        break;
      case 'contour':
        renderContourChart(renderer, s, state, theme, color);
        break;
      case 'vectorField':
        renderVectorFieldChart(renderer, s, state, theme, color);
        break;
      case 'altimeter':
        renderAltimeterGauge(renderer, s, state, theme, color);
        break;
      case 'attitudeIndicator':
        renderAttitudeIndicator(renderer, s, state, theme);
        break;
      case 'compassRose':
        renderCompassRose(renderer, s, state, theme, color);
        break;
      case 'spectrumAnalyzer':
        renderSpectrumAnalyzer(renderer, s, state, theme, color);
        break;
      case 'oscilloscope':
        renderOscilloscope(renderer, s, state, theme, color, seriesIndex);
        break;
      case 'networkTopology':
      case 'networkGraph':
        renderNetworkTopology(renderer, s, state, theme, color);
        break;
      case 'flameChart':
        renderFlameChart(renderer, s, state, theme);
        break;
      case 'windRose':
        renderWindRose(renderer, s, state, theme, color);
        break;
      case 'stripChart':
        renderStripChart(renderer, s, state, theme, color, seriesIndex);
        break;
      case 'errorBand':
        renderErrorBand(renderer, s, state, theme, color);
        break;
      case 'horizonChart':
        renderHorizonChart(renderer, s, state, theme, color, seriesIndex, series.length);
        break;
      case 'bullet':
      case 'bulletChart':
        renderBulletChart(renderer, s, state, theme, color);
        break;
      case 'sparkline':
      case 'sparklineChart':
        renderSparklineChart(renderer, s, state, theme, color);
        break;
      case 'violin':
        renderViolinChart(renderer, s, state, theme, color, seriesIndex, series.length);
        break;
      case 'sunburst':
      case 'sunburstChart':
        renderSunburstChart(renderer, s, state, theme);
        break;
      case 'chord':
      case 'chordDiagram':
        renderChordDiagram(renderer, s, state, theme);
        break;
      case 'wordCloud':
      case 'wordcloud': {
        const wcs = sorted.filter(ss => ss.type === 'wordCloud' || ss.type === 'wordcloud');
        if (s === wcs[0]) renderWordCloud(renderer, wcs, state, theme, config.wordCloud ?? {});
        break;
      }

      case 'dependencyWheel':
      case 'dependency-wheel': {
        const dws = sorted.filter(ss => ss.type === 'dependencyWheel' || ss.type === 'dependency-wheel');
        if (s === dws[0]) renderDependencyWheel(renderer, dws, state, theme, config);
        break;
      }

      case 'organization':
      case 'orgChart': {
        const ocs = sorted.filter(ss => ss.type === 'organization' || ss.type === 'orgChart');
        if (s === ocs[0]) renderOrgChart(renderer, ocs, state, theme, config);
        break;
      }

      case 'packedBubble':
      case 'packed-bubble': {
        const pbs = sorted.filter(ss => ss.type === 'packedBubble' || ss.type === 'packed-bubble');
        if (s === pbs[0]) renderPackedBubble(renderer, pbs, state, theme, config);
        break;
      }

      case 'marimekko':
      case 'variwide': {
        const mms = sorted.filter(ss => ss.type === 'marimekko' || ss.type === 'variwide');
        if (s === mms[0]) renderMarimekko(renderer, mms, state, theme, config);
        break;
      }

      case 'venn': {
        const vs = sorted.filter(ss => ss.type === 'venn');
        if (s === vs[0]) renderVennDiagram(renderer, vs, state, theme, config);
        break;
      }

      case 'item': {
        const its = sorted.filter(ss => ss.type === 'item');
        if (s === its[0]) renderItemChart(renderer, its, state, theme, config);
        break;
      }

      case 'streamgraph':
      case 'stream': {
        const sgs = sorted.filter(ss => ss.type === 'streamgraph' || ss.type === 'stream');
        if (s === sgs[0]) renderStreamgraph(renderer, sgs, state, theme, config);
        break;
      }

      case 'xrange':
      case 'x-range': {
        const xrs = sorted.filter(ss => ss.type === 'xrange' || ss.type === 'x-range');
        if (s === xrs[0]) renderXRange(renderer, xrs, state, theme, config);
        break;
      }

      case 'progressRing':
      case 'radialBar':
      case 'solidGauge':
      case 'solidgauge': {
        const sgs2 = sorted.filter(
          (ss) =>
            ss.type === 'progressRing' ||
            ss.type === 'radialBar' ||
            ss.type === 'solidGauge' ||
            ss.type === 'solidgauge',
        );
        if (s === sgs2[0]) renderSolidGauge(renderer, sgs2, state, theme, config);
        break;
      }

      case 'tilemap': {
        const tms = sorted.filter(ss => ss.type === 'tilemap');
        if (s === tms[0]) renderTilemap(renderer, tms, state, theme, config);
        break;
      }

      case 'treegraph':
      case 'tree': {
        const tgs = sorted.filter(ss => ss.type === 'treegraph' || ss.type === 'tree');
        if (s === tgs[0]) renderTreeGraph(renderer, tgs, state, theme, config);
        break;
      }

      case 'columnrange':
      case 'columnRange': {
        const crs = sorted.filter(ss => ss.type === 'columnrange' || ss.type === 'columnRange');
        if (s === crs[0]) renderColumnRange(renderer, crs, state, theme, config);
        break;
      }

      case 'bellcurve':
      case 'bellCurve':
      case 'normalDistribution': {
        const bcs = sorted.filter(ss => ss.type === 'bellcurve' || ss.type === 'bellCurve' || ss.type === 'normalDistribution');
        if (s === bcs[0]) renderBellCurve(renderer, bcs, state, theme, config);
        break;
      }

      default:
        // Unknown series type — fall back to line renderer so the chart still
        // renders. A warning is emitted so integration mistakes surface early.
        console.warn(
          `[RiskLab] Unknown series type "${String(s.type)}" on series "${s.id}". ` +
          `Falling back to "line". Check the type spelling or register a custom renderer.`,
        );
        renderLineSeries(renderer, s, state, theme, color);
        break;
    }

    renderer.endGroup();
  }

  // Restore clip so subsequent drawing (legend, plugins) isn't clipped
  renderer.removeClipRect();
}
