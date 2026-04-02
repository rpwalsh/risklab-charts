// ============================================================================
// RiskLab Charts — Print Plugin
// Generates a print-optimised window containing the chart SVG/canvas snapshot.
// Supports: page title, subtitle, custom CSS, data-table inclusion,
// auto-print-and-close, and a plugin-system entry point.
// ============================================================================

import type { RiskLabPlugin } from '../core/types';
import { createPlugin } from './PluginSystem';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PrintConfig {
  /** Text shown as the <title> and optional <h1> in the print window */
  pageTitle?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Extra CSS injected into the print window */
  css?: string;
  /** Include the data table (if rendered in the DOM) beside the chart */
  includeDataTable?: boolean;
  /** Automatically call window.print() after load (default: true) */
  autoPrint?: boolean;
  /** Close the print window after the print dialog is dismissed (default: true) */
  autoClose?: boolean;
  /** Paper size hint added to @page CSS (e.g. 'A4 landscape', 'letter') */
  paperSize?: string;
  /** Chart background override for printing (default: '#ffffff') */
  backgroundColor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the chart SVG element from the container, or serialise canvas → PNG */
function extractChartImage(container: HTMLElement): { type: 'svg'; markup: string } | { type: 'img'; src: string } | null {
  // Prefer SVG renderer — query any SVG child (SVGRenderer does not add a
  // specific class or data attribute, so a plain 'svg' selector is correct)
  const svgEl = container.querySelector<SVGSVGElement>('svg');
  if (svgEl) {
    // Inline any <style> blocks and serialise
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    // Force explicit width/height attributes for print
    const w = svgEl.clientWidth || svgEl.viewBox?.baseVal?.width || 800;
    const h = svgEl.clientHeight || svgEl.viewBox?.baseVal?.height || 500;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const serialiser = new XMLSerializer();
    return { type: 'svg', markup: serialiser.serializeToString(clone) };
  }

  // Fall back to canvas → PNG
  const canvas = container.querySelector<HTMLCanvasElement>('canvas');
  if (canvas) {
    try {
      return { type: 'img', src: canvas.toDataURL('image/png') };
    } catch {
      // tainted canvas — can't export
      return null;
    }
  }

  return null;
}

/** Extract data-table HTML from the container (if DataTablePlugin was used) */
function extractDataTable(container: HTMLElement): string {
  const tableWrapper = container.querySelector<HTMLElement>('.uc-data-table-wrapper');
  if (!tableWrapper) return '';
  const clone = tableWrapper.cloneNode(true) as HTMLElement;
  // Remove toggle controls and pagination for print
  clone.querySelectorAll('.uc-dt-toggle, .uc-dt-pagination, .uc-dt-actions').forEach((el) => el.remove());
  return clone.outerHTML;
}

// ---------------------------------------------------------------------------
// printChart — standalone utility
// ---------------------------------------------------------------------------

/**
 * Opens a dedicated print window for the chart contained in `container`.
 *
 * @param container  The root DOM element wrapping the chart (same element
 *                   passed to `new Engine(container, config)`)
 * @param options    Optional `PrintConfig`
 */
export function printChart(container: HTMLElement, options: PrintConfig = {}): void {
  const {
    pageTitle       = 'Chart',
    subtitle        = '',
    css             = '',
    includeDataTable = false,
    autoPrint       = true,
    autoClose       = true,
    paperSize       = 'A4 landscape',
    backgroundColor = '#ffffff',
  } = options;

  const chartImage = extractChartImage(container);
  if (!chartImage) {
    console.warn('[RiskLab PrintPlugin] No renderable chart found in container.');
    return;
  }

  const chartHtml = chartImage.type === 'svg'
    ? chartImage.markup
    : `<img src="${chartImage.src}" style="max-width:100%;display:block;" alt="chart" />`;

  const dataTableHtml = includeDataTable ? extractDataTable(container) : '';

  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    @page { size: ${paperSize}; margin: 1.5cm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${backgroundColor};
      color: #111;
      margin: 0;
      padding: 0;
    }
    .uc-print-header { margin-bottom: 12px; }
    .uc-print-title  { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; }
    .uc-print-sub    { font-size: 13px; color: #555; margin: 0; }
    .uc-print-chart  { width: 100%; }
    .uc-print-chart svg,
    .uc-print-chart img { max-width: 100%; height: auto; display: block; }
    .uc-print-table  { margin-top: 16px; width: 100%; border-collapse: collapse; font-size: 11px; }
    .uc-print-table th,
    .uc-print-table td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
    .uc-print-table th { background: #f5f5f5; font-weight: 600; }
    @media print {
      .uc-no-print { display: none !important; }
      .uc-print-chart { page-break-inside: avoid; }
      .uc-print-table { page-break-before: auto; }
    }
    ${css}
  </style>
</head>
<body>
  ${pageTitle ? `<div class="uc-print-header">
    <h1 class="uc-print-title">${escapeHtml(pageTitle)}</h1>
    ${subtitle ? `<p class="uc-print-sub">${escapeHtml(subtitle)}</p>` : ''}
  </div>` : ''}
  <div class="uc-print-chart">${chartHtml}</div>
  ${dataTableHtml ? `<div class="uc-print-table-wrapper">${dataTableHtml}</div>` : ''}
  ${autoPrint ? `<script>
    window.addEventListener('load', function () {
      window.print();
      ${autoClose ? "window.addEventListener('afterprint', function () { window.close(); });" : ''}
    });
  </script>` : ''}
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=1000,height=700');
  if (!printWin) {
    console.warn('[RiskLab PrintPlugin] Popup blocked — ensure pop-ups are allowed.');
    return;
  }
  printWin.document.write(printHtml);
  printWin.document.close();
}

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// PrintPlugin — integrates with RiskLab plugin system
// ---------------------------------------------------------------------------

/**
 * Creates an `RiskLabPlugin` that adds a "Print" button to the chart
 * and exposes `engine.print()` via the plugin hooks.
 *
 * Usage:
 * ```ts
 * const engine = new Engine(container, config);
 * engine.use(PrintPlugin({ pageTitle: 'Sales Dashboard' }));
 * ```
 */
export function PrintPlugin(options: PrintConfig = {}): RiskLabPlugin {
  let _printBtn: HTMLButtonElement | null = null;

  return createPlugin('print')
    .version('1.0.0')
    .name('Print Plugin')
    .hook('afterRender', (engineUnknown: unknown) => {
      const eng = engineUnknown as import('../core/Engine').EngineInternalAPI | undefined;
      if (!eng?.container) return;

      const container: HTMLElement = eng.container;
      const config = eng.getConfig ? eng.getConfig() : {} as Record<string, unknown>;
      const printCfg: PrintConfig = config.print ?? {};
      const merged: PrintConfig = { ...options, ...printCfg };

      // Expose imperative API
      if (!eng._printChart) {
        eng._printChart = () => printChart(container, merged);
      }

      // Inject print button (idempotent)
      if (!_printBtn) {
        _printBtn = document.createElement('button');
        _printBtn.className = 'uc-print-btn';
        _printBtn.title = 'Print chart';
        _printBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
        Object.assign(_printBtn.style, {
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: '20',
          background: 'transparent',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '4px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        });
        _printBtn.addEventListener('click', () => printChart(container, merged));
        if (getComputedStyle(container).position === 'static') {
          container.style.position = 'relative';
        }
        container.appendChild(_printBtn);
      }
    })
    .hook('onDestroy', () => {
      _printBtn?.remove();
      _printBtn = null;
    })
    .build();
}
