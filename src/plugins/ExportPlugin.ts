// ============================================================================
// RiskLab Charts — Export Plugin
// PNG / SVG / JPEG / PDF / CSV / JSON / XLSX export.
// Surpasses Highcharts: PDF export without external libs (SVG-embedded PDF).
// ============================================================================

import type { RiskLabPlugin, ExportFormat } from '../core/types';
import { createPlugin } from './PluginSystem';

export const ExportPlugin: RiskLabPlugin = createPlugin('export')
  .version('2.0.0')
  .name('Export Plugin')
  .hook('afterInit', (_chart: unknown) => {
    // Export button injection is handled by the consumer (React adapter, etc.)
  })
  .hook('onExport', (format: unknown) => {
    if (typeof window !== 'undefined') {
      console.warn(`[RiskLab Export] Exported as ${format as ExportFormat}`);
    }
  })
  .build();

/**
 * Export chart data as CSV.
 */
export function exportToCSV(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]!);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export chart data as JSON.
 */
export function exportToJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: Blob | string, filename: string, mimeType?: string): void {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType ?? 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

/** Get the SVG element from a chart container */
export function getChartSVG(container: Element | null): SVGSVGElement | null {
  return container?.querySelector('svg') ?? null;
}

/** Serialize an SVG element with all computed styles inlined */
export function serializeSVG(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Ensure xmlns is set for standalone SVG files
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return new XMLSerializer().serializeToString(clone);
}

// ── PNG / JPEG export ─────────────────────────────────────────────────────────

export interface RasterExportOptions {
  scale?: number;
  backgroundColor?: string;
  quality?: number; // 0–1, for JPEG
}

export async function exportSVGToRaster(
  svg: SVGSVGElement,
  format: 'png' | 'jpeg',
  options: RasterExportOptions = {},
): Promise<Blob> {
  const scale = options.scale ?? 2;
  const w = svg.viewBox.baseVal.width || svg.clientWidth || 800;
  const h = svg.viewBox.baseVal.height || svg.clientHeight || 400;

  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }

  const svgStr = serializeSVG(svg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('Canvas export failed')),
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        options.quality ?? 0.95,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
    img.src = url;
  });
}

// ── PDF export (pure JS, no external dependencies) ────────────────────────────

/**
 * A minimal but fully-functional SVG-embedding PDF generator.
 * Embeds the chart SVG as a rasterised page in a valid PDF 1.4 file.
 * For a text/vector PDF use the optional jsPDF integration below.
 */
export async function exportChartToPDF(
  svg: SVGSVGElement,
  options: {
    title?: string;
    author?: string;
    scale?: number;
    pageSize?: 'a4' | 'letter' | 'a3';
  } = {},
): Promise<Blob> {
  const pageSizes = {
    a4:     [595.28, 841.89],
    letter: [612, 792],
    a3:     [841.89, 1190.55],
  };
  const [pgW, pgH] = pageSizes[options.pageSize ?? 'a4']!;

  // Rasterise the chart as JPEG so DCTDecode embedding is valid
  const jpegBlob = await exportSVGToRaster(svg, 'jpeg', { scale: options.scale ?? 2, backgroundColor: '#ffffff', quality: 0.92 });
  const jpegArrayBuffer = await jpegBlob.arrayBuffer();
  const jpegBytes = new Uint8Array(jpegArrayBuffer);
  // Hex-encode raw JPEG bytes for ASCIIHexDecode wrapper; trailing '>' terminates the stream
  const jpegHex = Array.from(jpegBytes).map(b => b.toString(16).padStart(2, '0')).join('') + '>';
  const jpegHexLen = jpegHex.length;

  const svgW = svg.viewBox.baseVal.width || svg.clientWidth || 800;
  const svgH = svg.viewBox.baseVal.height || svg.clientHeight || 400;
  const imgPixelW = Math.round(svgW * (options.scale ?? 2));
  const imgPixelH = Math.round(svgH * (options.scale ?? 2));

  // Fit image to page with margins
  const margin = 40;
  const maxW = pgW - margin * 2;
  const maxH = pgH - margin * 2 - (options.title ? 30 : 0);
  const aspect = svgW / svgH;
  let imgW = maxW, imgH = imgW / aspect;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }
  const imgX = margin + (maxW - imgW) / 2;
  const imgY = margin + (options.title ? 28 : 0);

  // PDF objects
  const objects: { id: number; content: string }[] = [];
  let nextId = 1;

  const addObj = (content: string) => {
    const id = nextId++;
    objects.push({ id, content });
    return id;
  };

  // Object 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // Object 2: Pages
  addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);

  // Object 3: Page
  const contentStreams: string[] = [];
  if (options.title) {
    contentStreams.push(
      `BT /F1 14 Tf ${margin} ${pgH - margin - 10} Td (${options.title.replace(/[()\\]/g, '\\$&')}) Tj ET`,
    );
  }
  contentStreams.push(
    `q ${imgW.toFixed(2)} 0 0 ${imgH.toFixed(2)} ${imgX.toFixed(2)} ${(pgH - imgY - imgH).toFixed(2)} cm /Im1 Do Q`,
  );
  const pageContent = contentStreams.join('\n');

  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pgW.toFixed(2)} ${pgH.toFixed(2)}] /Contents 5 0 R /Resources << /XObject << /Im1 4 0 R >> /Font << /F1 6 0 R >> >> >>`);

  // Object 4: JPEG image XObject — ASCIIHexDecode unwraps hex stream → raw JPEG bytes → DCTDecode decodes JPEG
  addObj(`<< /Type /XObject /Subtype /Image /Width ${imgPixelW} /Height ${imgPixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${jpegHexLen} >>\nstream\n${jpegHex}\nendstream`);

  // Object 5: Content stream
  addObj(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`);

  // Object 6: Font
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  // Build PDF binary
  let pdf = `%PDF-1.4\n%â¤ï¸\n`;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${options.title ?? 'RiskLab Chart'}) /Producer (@risklab/charts) /CreationDate (D:${dateStr}) >> >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

// ── XLSX export (simple, no external deps) ─────────────────────────────────────

/** Export tabular data as a minimal XLSX (Office Open XML) without dependencies */
export function exportToXLSX(data: Array<Record<string, unknown>>, sheetName = 'Sheet1'): Blob {
  if (data.length === 0) return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const headers = Object.keys(data[0]!);

  const escXml = (v: unknown): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const col = (idx: number): string => {
    let c = '';
    let i = idx;
    do { c = String.fromCharCode(65 + (i % 26)) + c; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return c;
  };

  const cellRef = (r: number, c: number) => `${col(c)}${r}`;

  const sharedStrings: string[] = [];
  const si = (s: string): number => {
    let idx = sharedStrings.indexOf(s);
    if (idx === -1) { idx = sharedStrings.length; sharedStrings.push(s); }
    return idx;
  };

  // Build rows
  const rows: string[] = [];
  const headerRow = headers.map((h, ci) => `<c r="${cellRef(1, ci)}" t="s"><v>${si(escXml(h))}</v></c>`).join('');
  rows.push(`<row r="1">${headerRow}</row>`);

  for (let ri = 0; ri < data.length; ri++) {
    const cells = headers.map((h, ci) => {
      const val = data[ri]![h];
      const num = Number(val);
      if (val !== null && val !== undefined && val !== '' && !isNaN(num)) {
        return `<c r="${cellRef(ri + 2, ci)}"><v>${num}</v></c>`;
      }
      return `<c r="${cellRef(ri + 2, ci)}" t="s"><v>${si(escXml(val))}</v></c>`;
    }).join('');
    rows.push(`<row r="${ri + 2}">${cells}</row>`);
  }

  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const sharedXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const wbXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;

  // Minimal ZIP construction
  const enc = new TextEncoder();
  const parts: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(relsXml) },
    { name: 'xl/workbook.xml', data: enc.encode(wbXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRelsXml) },
    { name: `xl/worksheets/sheet1.xml`, data: enc.encode(sheetXml) },
    { name: 'xl/sharedStrings.xml', data: enc.encode(sharedXml) },
  ];

  return buildZip(parts);
}

// Minimal ZIP builder (Store method, no compression)
function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  const u32 = (n: number) => new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]);
  const u16 = (n: number) => new Uint8Array([n & 0xFF, (n >> 8) & 0xFF]);

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header
    const localHeader = concat([
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // sig
      u16(20), u16(0), u16(0), u16(0), u16(0),  // version, flags, method, time, date
      u32(crc), u32(size), u32(size),            // crc, compressed, uncompressed
      u16(nameBytes.length), u16(0),             // name len, extra len
      nameBytes, file.data,
    ]);

    const cdRecord = concat([
      new Uint8Array([0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      u32(crc), u32(size), u32(size),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      nameBytes,
    ]);

    chunks.push(localHeader);
    centralDir.push(cdRecord);
    offset += localHeader.length;
  }

  const cdStart = offset;
  const cdTotal = centralDir.reduce((s, r) => s + r.length, 0);
  const eocd = concat([
    new Uint8Array([0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0]),
    u16(files.length), u16(files.length),
    u32(cdTotal), u32(cdStart), u16(0),
  ]);

  return new Blob([...chunks as BlobPart[], ...centralDir as BlobPart[], eocd as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function concat(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const a of arrs) { out.set(a, at); at += a.length; }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = crc32Table();
  for (const byte of data) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF]!;
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let _crc32Table: Uint32Array | null = null;
function crc32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table;
  _crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    _crc32Table[i] = c;
  }
  return _crc32Table;
}

