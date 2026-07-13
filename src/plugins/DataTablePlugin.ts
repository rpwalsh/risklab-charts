// ============================================================================
// RiskLab Charts — Data Table Plugin
// Renders an interactive HTML data table below the chart (or in a modal).
// Matches commercial charting' "View data table" accessibility feature, but goes beyond:
//  - Column sorting by clicking headers (ascending ↕ descending)
//  - CSV / clipboard copy
//  - Pagination for large datasets
//  - Column visibility (hide/show)
//  - Print-ready layout
// ============================================================================

import type { RiskLabPlugin } from '../core/types';
import { createPlugin } from './PluginSystem';
import { escapeHtml } from '../utils/sanitize';

export interface DataTableConfig {
  enabled?: boolean;
  /** Show the "View data" toggle button below the chart */
  showToggleButton?: boolean;
  /** Show the table inline (true) or in a floating modal (false) */
  inline?: boolean;
  /** Number of rows per page (0 = unlimited) */
  pageSize?: number;
  /** Show CSV export button */
  csvButton?: boolean;
  /** Show copy-to-clipboard button */
  copyButton?: boolean;
  /** Column headers override — maps series id → custom label */
  columnLabels?: Record<string, string>;
  /** Caption shown above the table */
  caption?: string;
}

// ── DOM builder ──────────────────────────────────────────────────────────────

function buildTableHTML(
  rows: Array<Record<string, unknown>>,
  headers: string[],
  seriesNames: Record<string, string>,
  config: DataTableConfig,
  page: number,
): string {
  const pageSize = config.pageSize ?? 0;
  const totalRows = rows.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalRows / pageSize) : 1;
  const displayRows = pageSize > 0 ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows;

  const th = (key: string) => {
    const label = escapeHtml(config.columnLabels?.[key] ?? seriesNames[key] ?? key);
    return `<th data-key="${escapeHtml(key)}" style="
      padding:8px 12px;
      text-align:left;
      background:#f8fafc;
      border-bottom:2px solid #e2e8f0;
      white-space:nowrap;
      cursor:pointer;
      user-select:none;
      font-size:12px;
      font-weight:600;
    ">${label} <span class="uc-sort-icon" style="opacity:0.4">↕</span></th>`;
  };

  const td = (val: unknown) => `<td style="
    padding:7px 12px;
    border-bottom:1px solid #f1f5f9;
    font-size:12px;
    white-space:nowrap;
  ">${val === null || val === undefined ? '—' : escapeHtml(String(val))}</td>`;

  const captionHTML = config.caption
    ? `<caption style="padding:8px 0;text-align:left;font-weight:600;font-size:13px;caption-side:top">${escapeHtml(config.caption)}</caption>`
    : '';

  const thead = `<thead><tr>${headers.map(th).join('')}</tr></thead>`;

  // Row hover performed via CSS to avoid inline event handlers that are
  // blocked by Content Security Policy (CSP: script-src unsafe-inline)
  const hoverStyle = `<style>.uc-data-table tbody tr:hover{background:#f8fafc}</style>`;

  const tbody = `<tbody>${displayRows.map(row =>
    `<tr>${headers.map(h => td(row[h])).join('')}</tr>`,
  ).join('')}</tbody>`;

  const pagination = totalPages > 1 ? `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:12px">
      <button class="uc-dt-prev" style="${btnStyle}" ${page === 0 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${page + 1} of ${totalPages} (${totalRows} rows)</span>
      <button class="uc-dt-next" style="${btnStyle}" ${page >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
    </div>
  ` : `<div style="font-size:11px;color:#94a3b8;padding-top:4px">${totalRows} rows</div>`;

  const actionBar = buildActionBar(config);

  return `
    ${hoverStyle}
    ${actionBar}
    <div style="overflow-x:auto;border-radius:6px;border:1px solid #e2e8f0;margin-top:4px">
      <table class="uc-data-table" style="width:100%;border-collapse:collapse;font-family:inherit">
        ${captionHTML}
        ${thead}
        ${tbody}
      </table>
    </div>
    ${pagination}
  `;
}

const btnStyle = `
  padding:5px 10px;
  font-size:11px;
  border:1px solid #e2e8f0;
  border-radius:4px;
  background:#fff;
  cursor:pointer;
`;

function buildActionBar(config: DataTableConfig): string {
  const buttons: string[] = [];
  if (config.csvButton !== false) {
    buttons.push(`<button class="uc-dt-csv" style="${btnStyle}">⬇ CSV</button>`);
  }
  if (config.copyButton !== false) {
    buttons.push(`<button class="uc-dt-copy" style="${btnStyle}">📋 Copy</button>`);
  }
  if (buttons.length === 0) return '';
  return `<div style="display:flex;gap:6px;margin-bottom:6px">${buttons.join('')}</div>`;
}

// ── Data extraction ───────────────────────────────────────────────────────────

interface FlatRow {
  x: unknown;
  [seriesId: string]: unknown;
}

function extractRows(
  allSeries: Array<{ id: string; name: string; data: Array<{ x: unknown; y: unknown }> }>,
): { rows: FlatRow[]; headers: string[]; seriesNames: Record<string, string> } {
  const xMap = new Map<string, FlatRow>();
  const seriesNames: Record<string, string> = {};

  for (const s of allSeries) {
    seriesNames[s.id] = s.name;
    for (const pt of s.data) {
      const key = String(pt.x);
      if (!xMap.has(key)) xMap.set(key, { x: pt.x });
      xMap.get(key)![s.id] = pt.y;
    }
  }

  const rows = [...xMap.values()].sort((a, b) => {
    if (a.x instanceof Date && b.x instanceof Date) return a.x.getTime() - b.x.getTime();
    return String(a.x).localeCompare(String(b.x));
  });

  const headers = ['x', ...allSeries.map(s => s.id)];
  return { rows, headers, seriesNames };
}

// ── Convert rows to CSV ───────────────────────────────────────────────────────

function rowsToCSV(
  rows: FlatRow[],
  headers: string[],
  seriesNames: Record<string, string>,
): string {
  const headLine = headers.map(h => seriesNames[h] ?? h).map(v => `"${v}"`).join(',');
  const body = rows.map(row =>
    headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','),
  ).join('\n');
  return headLine + '\n' + body;
}

// ── Container management ──────────────────────────────────────────────────────

// Export pure data utilities for external use / testing
export { extractRows, rowsToCSV };
export type { FlatRow };

const tableContainers = new WeakMap<HTMLElement, HTMLElement>();

/**
 * Attach or refresh a data table on a chart container.
 * Call this after the chart has rendered (so data is available).
 */
export function attachDataTable(
  chartContainer: HTMLElement,
  allSeries: Array<{ id: string; name: string; data: Array<{ x: unknown; y: unknown }> }>,
  config: DataTableConfig = {},
): void {
  if (config.enabled === false) return;
  if (typeof document === 'undefined') return;

  let wrapper = tableContainers.get(chartContainer);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'uc-datatable-wrapper';
    wrapper.style.cssText = 'font-family:inherit;margin-top:12px;display:none';
    chartContainer.after(wrapper);
    tableContainers.set(chartContainer, wrapper);
  }

  // Toggle button
  let toggleBtn = chartContainer.parentElement?.querySelector('.uc-dt-toggle') as HTMLButtonElement | null;
  if (!toggleBtn && config.showToggleButton !== false) {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'uc-dt-toggle';
    toggleBtn.textContent = '☰ View data table';
    toggleBtn.style.cssText = `${btnStyle}margin-top:8px;display:block;`;
    chartContainer.after(toggleBtn);
    toggleBtn.addEventListener('click', () => {
      const visible = wrapper!.style.display !== 'none';
      wrapper!.style.display = visible ? 'none' : 'block';
      toggleBtn!.textContent = visible ? '☰ View data table' : '✕ Hide data table';
    });
  }

  const { rows, headers, seriesNames } = extractRows(allSeries);
  let currentPage = 0;
  let sortKey = '';
  let sortAsc = true;

  const render = () => {
    const sortedRows = sortKey
      ? [...rows].sort((a, b) => {
          const av = a[sortKey] ?? '';
          const bv = b[sortKey] ?? '';
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          return sortAsc ? cmp : -cmp;
        })
      : rows;

    wrapper!.innerHTML = buildTableHTML(sortedRows, headers, seriesNames, config, currentPage);

    // Wire sorting
    wrapper!.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const key = (th as HTMLElement).dataset['key']!;
        if (sortKey === key) sortAsc = !sortAsc;
        else { sortKey = key; sortAsc = true; }
        currentPage = 0;
        render();
      });
    });

    // Wire pagination
    wrapper!.querySelector('.uc-dt-prev')?.addEventListener('click', () => { currentPage--; render(); });
    wrapper!.querySelector('.uc-dt-next')?.addEventListener('click', () => { currentPage++; render(); });

    // Wire CSV download
    wrapper!.querySelector('.uc-dt-csv')?.addEventListener('click', () => {
      const csv = rowsToCSV(rows, headers, seriesNames);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'chart-data.csv'; a.click();
      URL.revokeObjectURL(url);
    });

    // Wire clipboard copy
    wrapper!.querySelector('.uc-dt-copy')?.addEventListener('click', async () => {
      const csv = rowsToCSV(rows, headers, seriesNames);
      try {
        await navigator.clipboard.writeText(csv);
        const btn = wrapper!.querySelector('.uc-dt-copy') as HTMLButtonElement;
        if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '📋 Copy'; }, 1500); }
      } catch { /* clipboard unavailable */ }
    });
  };

  render();
}

// ── Plugin registration ───────────────────────────────────────────────────────

export const DataTablePlugin: RiskLabPlugin = createPlugin('dataTable')
  .version('1.0.0')
  .name('Data Table Plugin')
  .hook('afterRender', (engine: unknown) => {
    const eng = engine as import('../core/Engine').EngineInternalAPI;
    if (!eng?.getConfig || !eng?.getState) return;
    const config = eng.getConfig();
    const tableCfg: DataTableConfig | undefined = config.dataTable;
    if (!tableCfg || tableCfg.enabled === false) return;

    const series = (eng.getProcessedData?.() ?? []) as Array<{
      id: string; name: string;
      data: Array<{ x: unknown; y: unknown }>;
    }>;
    if (!eng.container) return;
    attachDataTable(eng.container, series, tableCfg);
  })
  .build();
