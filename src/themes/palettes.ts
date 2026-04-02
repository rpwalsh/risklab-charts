// ============================================================================
// RiskLab Charts — 54 Color Palettes (Light & Dark Mode)
// Accessible, beautiful, production-grade. Each has 12 series colors.
// ============================================================================

import type { ThemeConfig } from '../core/types';

export interface PalettePair {
  id: string;
  name: string;
  category: 'corporate' | 'nature' | 'science' | 'engineering' | 'aviation'
    | 'creative' | 'retro' | 'neon' | 'monochrome' | 'warm' | 'cool' | 'pastel' | 'earth';
  light: PaletteDef;
  dark: PaletteDef;
}

export interface PaletteDef {
  palette: string[];
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
}

// ── Helper to build ThemeConfig from PaletteDef ─────────────────────────
export function paletteToTheme(pair: PalettePair, mode: 'light' | 'dark'): ThemeConfig {
  const p = mode === 'light' ? pair.light : pair.dark;
  return {
    id: `${pair.id}-${mode}`,
    name: `${pair.name} (${mode === 'light' ? 'Light' : 'Dark'})`,
    palette: p.palette,
    backgroundColor: p.background,
    textColor: p.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 12,
    axis: { lineColor: p.axis, gridColor: p.grid, labelColor: p.textSecondary, titleColor: p.text },
    tooltip: {
      backgroundColor: p.tooltipBg,
      borderColor: p.tooltipBorder,
      textColor: p.tooltipText,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.12)', offsetX: 0, offsetY: 4, blur: 12 },
    },
    legend: { textColor: p.text, hoverColor: p.text, inactiveColor: p.textSecondary },
  };
}

// ── The 50 Palettes ─────────────────────────────────────────────────────

export const palettes: PalettePair[] = [
  // ──────────────────────── CORPORATE ────────────────────────
  { id: 'midnight-pro', name: 'Midnight Pro', category: 'corporate',
    light: { palette: ['#1e40af','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4f46e5','#15803d','#ea580c','#7e22ce','#0369a1'],
      background: '#ffffff', surface: '#f8fafc', text: '#0f172a', textSecondary: '#64748b', grid: '#f1f5f9', axis: '#cbd5e1', tooltipBg: '#ffffff', tooltipText: '#0f172a', tooltipBorder: '#e2e8f0' },
    dark: { palette: ['#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171','#22d3ee','#f472b6','#818cf8','#4ade80','#fb923c','#c084fc','#38bdf8'],
      background: '#0f172a', surface: '#1e293b', text: '#f1f5f9', textSecondary: '#94a3b8', grid: '#1e293b', axis: '#334155', tooltipBg: '#1e293b', tooltipText: '#f1f5f9', tooltipBorder: '#334155' } },

  { id: 'clean-slate', name: 'Clean Slate', category: 'corporate',
    light: { palette: ['#2563eb','#16a34a','#dc2626','#ca8a04','#9333ea','#0d9488','#e11d48','#2563eb','#059669','#ea580c','#7c3aed','#0284c7'],
      background: '#fafafa', surface: '#f4f4f5', text: '#18181b', textSecondary: '#71717a', grid: '#f4f4f5', axis: '#d4d4d8', tooltipBg: '#fff', tooltipText: '#18181b', tooltipBorder: '#e4e4e7' },
    dark: { palette: ['#3b82f6','#22c55e','#ef4444','#eab308','#a855f7','#14b8a6','#f43f5e','#3b82f6','#10b981','#f97316','#8b5cf6','#0ea5e9'],
      background: '#09090b', surface: '#18181b', text: '#fafafa', textSecondary: '#a1a1aa', grid: '#27272a', axis: '#3f3f46', tooltipBg: '#18181b', tooltipText: '#fafafa', tooltipBorder: '#3f3f46' } },

  { id: 'bloomberg', name: 'Bloomberg Terminal', category: 'corporate',
    light: { palette: ['#ff6600','#0066cc','#009900','#cc0000','#9933cc','#006666','#cc6600','#3366ff','#339933','#ff3333','#6633cc','#009999'],
      background: '#f5f0e8', surface: '#ebe6de', text: '#1a1410', textSecondary: '#6b5f4f', grid: '#e5e0d8', axis: '#c5b9a8', tooltipBg: '#fff', tooltipText: '#1a1410', tooltipBorder: '#c5b9a8' },
    dark: { palette: ['#ff8833','#4499ff','#33cc33','#ff4444','#bb66ff','#33aaaa','#ff9944','#5588ff','#55cc55','#ff6666','#9966ff','#44cccc'],
      background: '#1a1000', surface: '#2a2010', text: '#ffcc88', textSecondary: '#aa9060', grid: '#2a2010', axis: '#3a3020', tooltipBg: '#2a2010', tooltipText: '#ffcc88', tooltipBorder: '#3a3020' } },

  { id: 'material-you', name: 'Material You', category: 'corporate',
    light: { palette: ['#6750a4','#625b71','#b3261e','#006c4c','#006590','#984061','#5d5f5f','#ba1a1a','#386a1f','#904d00','#4d57a9','#006b5f'],
      background: '#fffbfe', surface: '#f7f2fa', text: '#1c1b1f', textSecondary: '#49454f', grid: '#e7e0ec', axis: '#c4c0c6', tooltipBg: '#fff', tooltipText: '#1c1b1f', tooltipBorder: '#e7e0ec' },
    dark: { palette: ['#d0bcff','#ccc2dc','#f2b8b5','#70dba5','#8ecff2','#efb8c8','#c5c7c7','#ffb4ab','#a5d395','#ffb871','#bec2ff','#6fd8c4'],
      background: '#1c1b1f', surface: '#2b2930', text: '#e6e1e5', textSecondary: '#cac4d0', grid: '#2b2930', axis: '#49454f', tooltipBg: '#2b2930', tooltipText: '#e6e1e5', tooltipBorder: '#49454f' } },

  { id: 'ibm-carbon', name: 'IBM Carbon', category: 'corporate',
    light: { palette: ['#0f62fe','#da1e28','#198038','#8a3ffc','#002d9c','#6929c4','#005d5d','#fa4d56','#a7f0ba','#d2a106','#1192e8','#ee538b'],
      background: '#ffffff', surface: '#f4f4f4', text: '#161616', textSecondary: '#525252', grid: '#e0e0e0', axis: '#c6c6c6', tooltipBg: '#161616', tooltipText: '#f4f4f4', tooltipBorder: '#393939' },
    dark: { palette: ['#4589ff','#ff8389','#42be65','#be95ff','#78a9ff','#a56eff','#3ddbd9','#ff6f61','#6fdc8c','#f1c21b','#33b1ff','#ff7eb6'],
      background: '#161616', surface: '#262626', text: '#f4f4f4', textSecondary: '#8d8d8d', grid: '#262626', axis: '#393939', tooltipBg: '#262626', tooltipText: '#f4f4f4', tooltipBorder: '#525252' } },

  // ──────────────────────── NATURE ────────────────────────
  { id: 'forest', name: 'Pacific Forest', category: 'nature',
    light: { palette: ['#065f46','#854d0e','#1e3a5f','#9f1239','#365314','#713f12','#0e7490','#881337','#3f6212','#92400e','#155e75','#4c0519'],
      background: '#fefdf8', surface: '#f5f3ed', text: '#1a2e1a', textSecondary: '#5a6b5a', grid: '#ecead9', axis: '#c8c5b0', tooltipBg: '#fff', tooltipText: '#1a2e1a', tooltipBorder: '#d9d6c2' },
    dark: { palette: ['#34d399','#fbbf24','#60a5fa','#fb7185','#86efac','#fdba74','#22d3ee','#fda4af','#a3e635','#fcd34d','#67e8f9','#fecdd3'],
      background: '#0a1a0f', surface: '#152a1a', text: '#d4e8d4', textSecondary: '#7a9a7a', grid: '#1a3020', axis: '#2a4030', tooltipBg: '#152a1a', tooltipText: '#d4e8d4', tooltipBorder: '#2a4030' } },

  { id: 'ocean-depth', name: 'Ocean Depth', category: 'nature',
    light: { palette: ['#0c4a6e','#0e7490','#155e75','#164e63','#1e40af','#0369a1','#0891b2','#115e59','#1d4ed8','#047857','#0d9488','#0284c7'],
      background: '#f0fdfa', surface: '#e4f9f5', text: '#042f2e', textSecondary: '#4a7c77', grid: '#d4f3ed', axis: '#b0d9d2', tooltipBg: '#fff', tooltipText: '#042f2e', tooltipBorder: '#c4e9e2' },
    dark: { palette: ['#38bdf8','#22d3ee','#67e8f9','#2dd4bf','#60a5fa','#0ea5e9','#06b6d4','#14b8a6','#3b82f6','#10b981','#5eead4','#7dd3fc'],
      background: '#021c2e', surface: '#042c3e', text: '#c4e8f8', textSecondary: '#6aa8c8', grid: '#042c3e', axis: '#0a3c50', tooltipBg: '#042c3e', tooltipText: '#c4e8f8', tooltipBorder: '#0a3c50' } },

  { id: 'autumn', name: 'Golden Autumn', category: 'nature',
    light: { palette: ['#9a3412','#b45309','#854d0e','#a16207','#92400e','#c2410c','#d97706','#ca8a04','#ea580c','#dc2626','#78350f','#65a30d'],
      background: '#fffbf0', surface: '#fef3e0', text: '#3a1e08', textSecondary: '#8a6a40', grid: '#fde8c8', axis: '#e8d0a8', tooltipBg: '#fff', tooltipText: '#3a1e08', tooltipBorder: '#ecd8b0' },
    dark: { palette: ['#fb923c','#fbbf24','#fcd34d','#facc15','#fdba74','#f97316','#eab308','#fde047','#ff8c00','#ef4444','#d2a106','#a3e635'],
      background: '#1a0e05', surface: '#2a1a0c', text: '#f8e4c8', textSecondary: '#b89060', grid: '#2a1a0c', axis: '#3a2a15', tooltipBg: '#2a1a0c', tooltipText: '#f8e4c8', tooltipBorder: '#3a2a15' } },

  { id: 'sakura', name: 'Sakura Bloom', category: 'nature',
    light: { palette: ['#be185d','#db2777','#e11d48','#c026d3','#a21caf','#f43f5e','#ec4899','#d946ef','#f472b6','#f9a8d4','#881337','#86198f'],
      background: '#fdf2f8', surface: '#fce7f3', text: '#3b0a2a', textSecondary: '#9a4a7a', grid: '#fad2e8', axis: '#e8b0d0', tooltipBg: '#fff', tooltipText: '#3b0a2a', tooltipBorder: '#f0c0d8' },
    dark: { palette: ['#f472b6','#fb7185','#f9a8d4','#e879f9','#d946ef','#fda4af','#f0abfc','#fecdd3','#f9a8d4','#fbbf24','#c084fc','#f43f5e'],
      background: '#1a0510', surface: '#2a0c1a', text: '#f8d0e0', textSecondary: '#b06888', grid: '#2a0c1a', axis: '#3a1424', tooltipBg: '#2a0c1a', tooltipText: '#f8d0e0', tooltipBorder: '#3a1424' } },

  { id: 'arctic', name: 'Arctic Tundra', category: 'nature',
    light: { palette: ['#0c4a6e','#374151','#164e63','#0f766e','#1e3a5f','#334155','#0e7490','#115e59','#475569','#155e75','#0d9488','#1e293b'],
      background: '#f8fafc', surface: '#f1f5f9', text: '#0f1729', textSecondary: '#475569', grid: '#e2e8f0', axis: '#cbd5e1', tooltipBg: '#fff', tooltipText: '#0f1729', tooltipBorder: '#e2e8f0' },
    dark: { palette: ['#7dd3fc','#9ca3af','#67e8f9','#5eead4','#93c5fd','#d1d5db','#22d3ee','#2dd4bf','#e2e8f0','#a5f3fc','#99f6e4','#cbd5e1'],
      background: '#020617', surface: '#0f172a', text: '#e2e8f0', textSecondary: '#64748b', grid: '#1e293b', axis: '#334155', tooltipBg: '#0f172a', tooltipText: '#e2e8f0', tooltipBorder: '#334155' } },

  // ──────────────────────── SCIENCE ────────────────────────
  { id: 'spectral', name: 'Spectral Analysis', category: 'science',
    light: { palette: ['#6366f1','#06b6d4','#10b981','#eab308','#f97316','#ef4444','#8b5cf6','#14b8a6','#84cc16','#f59e0b','#f43f5e','#a855f7'],
      background: '#fafafa', surface: '#f5f5f5', text: '#171717', textSecondary: '#525252', grid: '#e5e5e5', axis: '#d4d4d4', tooltipBg: '#fff', tooltipText: '#171717', tooltipBorder: '#e5e5e5' },
    dark: { palette: ['#818cf8','#22d3ee','#34d399','#facc15','#fb923c','#f87171','#a78bfa','#2dd4bf','#a3e635','#fbbf24','#fb7185','#c084fc'],
      background: '#0a0a0a', surface: '#171717', text: '#fafafa', textSecondary: '#a3a3a3', grid: '#262626', axis: '#404040', tooltipBg: '#171717', tooltipText: '#fafafa', tooltipBorder: '#404040' } },

  { id: 'periodic', name: 'Periodic Table', category: 'science',
    light: { palette: ['#0369a1','#b91c1c','#15803d','#a16207','#6d28d9','#0e7490','#be123c','#166534','#854d0e','#581c87','#075985','#9f1239'],
      background: '#fffffe', surface: '#f5f5f4', text: '#1c1917', textSecondary: '#57534e', grid: '#e7e5e4', axis: '#d6d3d1', tooltipBg: '#fff', tooltipText: '#1c1917', tooltipBorder: '#e7e5e4' },
    dark: { palette: ['#38bdf8','#f87171','#4ade80','#fbbf24','#a78bfa','#22d3ee','#fb7185','#86efac','#fcd34d','#c084fc','#7dd3fc','#fda4af'],
      background: '#0c0a09', surface: '#1c1917', text: '#fafaf9', textSecondary: '#a8a29e', grid: '#292524', axis: '#44403c', tooltipBg: '#1c1917', tooltipText: '#fafaf9', tooltipBorder: '#44403c' } },

  { id: 'thermal', name: 'Thermal Imaging', category: 'science',
    light: { palette: ['#1e1b4b','#312e81','#3b0764','#4c1d95','#581c87','#6d28d9','#7c3aed','#a21caf','#c026d3','#db2777','#e11d48','#dc2626'],
      background: '#fdf4ff', surface: '#fae8ff', text: '#1a0020', textSecondary: '#6a3088', grid: '#f0d0ff', axis: '#d8a8e8', tooltipBg: '#fff', tooltipText: '#1a0020', tooltipBorder: '#e0c0f0' },
    dark: { palette: ['#312e81','#4338ca','#6d28d9','#7c3aed','#a855f7','#c026d3','#e11d48','#ef4444','#f97316','#eab308','#facc15','#fef08a'],
      background: '#0a0020', surface: '#1a0030', text: '#f0d0ff', textSecondary: '#9060c0', grid: '#1a0030', axis: '#2a0848', tooltipBg: '#1a0030', tooltipText: '#f0d0ff', tooltipBorder: '#2a0848' } },

  { id: 'genome', name: 'Genome Sequencing', category: 'science',
    light: { palette: ['#059669','#dc2626','#2563eb','#ca8a04','#7c3aed','#0891b2','#be185d','#65a30d','#ea580c','#4f46e5','#0d9488','#9333ea'],
      background: '#f0fdf4', surface: '#dcfce7', text: '#052e16', textSecondary: '#3a7a4f', grid: '#c4f0d0', axis: '#9ad8af', tooltipBg: '#fff', tooltipText: '#052e16', tooltipBorder: '#c4f0d0' },
    dark: { palette: ['#34d399','#f87171','#60a5fa','#fbbf24','#a78bfa','#22d3ee','#f472b6','#a3e635','#fb923c','#818cf8','#2dd4bf','#c084fc'],
      background: '#021208', surface: '#042210', text: '#c4f0d0', textSecondary: '#5aaa72', grid: '#042210', axis: '#0a3a1a', tooltipBg: '#042210', tooltipText: '#c4f0d0', tooltipBorder: '#0a3a1a' } },

  { id: 'plasma', name: 'Plasma Physics', category: 'science',
    light: { palette: ['#4338ca','#6d28d9','#9333ea','#c026d3','#db2777','#e11d48','#dc2626','#ea580c','#d97706','#ca8a04','#65a30d','#059669'],
      background: '#faf5ff', surface: '#f3e8ff', text: '#2e1065', textSecondary: '#6b21a8', grid: '#e9d5ff', axis: '#d8b4fe', tooltipBg: '#fff', tooltipText: '#2e1065', tooltipBorder: '#e9d5ff' },
    dark: { palette: ['#818cf8','#a78bfa','#c084fc','#e879f9','#f472b6','#fb7185','#f87171','#fb923c','#fbbf24','#facc15','#a3e635','#34d399'],
      background: '#150030', surface: '#1f0044', text: '#e8d0ff', textSecondary: '#9060c8', grid: '#1f0044', axis: '#300060', tooltipBg: '#1f0044', tooltipText: '#e8d0ff', tooltipBorder: '#300060' } },

  // ──────────────────────── ENGINEERING ────────────────────────
  { id: 'circuit-board', name: 'Circuit Board', category: 'engineering',
    light: { palette: ['#065f46','#b45309','#1e3a5f','#9a3412','#155e75','#854d0e','#0e7490','#92400e','#0c4a6e','#78350f','#115e59','#713f12'],
      background: '#ecfdf5', surface: '#d1fae5', text: '#022c22', textSecondary: '#047857', grid: '#a7f3d0', axis: '#6ee7b7', tooltipBg: '#fff', tooltipText: '#022c22', tooltipBorder: '#a7f3d0' },
    dark: { palette: ['#00ff88','#ffaa00','#00aaff','#ff6633','#00dddd','#ffcc00','#0099ee','#ff8844','#0088cc','#ddaa00','#00bbaa','#ee8800'],
      background: '#001a0a', surface: '#002a14', text: '#88ffcc', textSecondary: '#44aa66', grid: '#002a14', axis: '#003a1e', tooltipBg: '#002a14', tooltipText: '#88ffcc', tooltipBorder: '#003a1e' } },

  { id: 'steel', name: 'Brushed Steel', category: 'engineering',
    light: { palette: ['#374151','#6b7280','#1f2937','#4b5563','#111827','#9ca3af','#374151','#64748b','#1e293b','#475569','#0f172a','#94a3b8'],
      background: '#f3f4f6', surface: '#e5e7eb', text: '#111827', textSecondary: '#4b5563', grid: '#d1d5db', axis: '#9ca3af', tooltipBg: '#fff', tooltipText: '#111827', tooltipBorder: '#d1d5db' },
    dark: { palette: ['#9ca3af','#d1d5db','#e5e7eb','#6b7280','#f3f4f6','#f9fafb','#94a3b8','#cbd5e1','#e2e8f0','#64748b','#f1f5f9','#d4d4d8'],
      background: '#111827', surface: '#1f2937', text: '#f3f4f6', textSecondary: '#9ca3af', grid: '#1f2937', axis: '#374151', tooltipBg: '#1f2937', tooltipText: '#f3f4f6', tooltipBorder: '#374151' } },

  { id: 'blueprint', name: 'Engineering Blueprint', category: 'engineering',
    light: { palette: ['#1d4ed8','#1e40af','#1e3a8a','#1c398e','#2563eb','#3b82f6','#60a5fa','#93c5fd','#0369a1','#0284c7','#0c4a6e','#075985'],
      background: '#eff6ff', surface: '#dbeafe', text: '#1e3a8a', textSecondary: '#3b82f6', grid: '#bfdbfe', axis: '#93c5fd', tooltipBg: '#fff', tooltipText: '#1e3a8a', tooltipBorder: '#bfdbfe' },
    dark: { palette: ['#60a5fa','#93c5fd','#bfdbfe','#3b82f6','#dbeafe','#2563eb','#38bdf8','#7dd3fc','#0ea5e9','#0284c7','#67e8f9','#a5f3fc'],
      background: '#0a1628', surface: '#102040', text: '#bfdbfe', textSecondary: '#3b82f6', grid: '#102040', axis: '#1a3060', tooltipBg: '#102040', tooltipText: '#bfdbfe', tooltipBorder: '#1a3060' } },

  { id: 'industrial', name: 'Industrial Orange', category: 'engineering',
    light: { palette: ['#f97316','#ea580c','#c2410c','#9a3412','#0891b2','#0d9488','#dc2626','#1d4ed8','#65a30d','#7c3aed','#db2777','#115e59'],
      background: '#fff7ed', surface: '#ffedd5', text: '#431407', textSecondary: '#9a3412', grid: '#fed7aa', axis: '#fdba74', tooltipBg: '#fff', tooltipText: '#431407', tooltipBorder: '#fed7aa' },
    dark: { palette: ['#fb923c','#f97316','#ff8c40','#ff6b20','#22d3ee','#2dd4bf','#f87171','#60a5fa','#a3e635','#a78bfa','#f472b6','#14b8a6'],
      background: '#1a0c02', surface: '#2a1608', text: '#fed7aa', textSecondary: '#c87830', grid: '#2a1608', axis: '#3a2010', tooltipBg: '#2a1608', tooltipText: '#fed7aa', tooltipBorder: '#3a2010' } },

  { id: 'cad-green', name: 'CAD Display', category: 'engineering',
    light: { palette: ['#14532d','#15803d','#166534','#064e3b','#065f46','#047857','#059669','#10b981','#0d9488','#0f766e','#115e59','#134e4a'],
      background: '#f0fdf4', surface: '#dcfce7', text: '#052e16', textSecondary: '#166534', grid: '#86efac', axis: '#4ade80', tooltipBg: '#fff', tooltipText: '#052e16', tooltipBorder: '#bbf7d0' },
    dark: { palette: ['#00ff41','#33ff66','#00cc33','#66ff88','#00aa22','#88ffaa','#22dd44','#55ff77','#00ee33','#44ff66','#00bb22','#77ffaa'],
      background: '#001a0a', surface: '#002a10', text: '#88ffaa', textSecondary: '#33aa55', grid: '#002a10', axis: '#003a18', tooltipBg: '#002a10', tooltipText: '#88ffaa', tooltipBorder: '#003a18' } },

  // ──────────────────────── AVIATION ────────────────────────
  { id: 'cockpit', name: 'Glass Cockpit', category: 'aviation',
    light: { palette: ['#0369a1','#15803d','#dc2626','#b45309','#6d28d9','#0d9488','#be185d','#1d4ed8','#059669','#ea580c','#7c3aed','#0891b2'],
      background: '#f0f9ff', surface: '#e0f2fe', text: '#082f49', textSecondary: '#0369a1', grid: '#bae6fd', axis: '#7dd3fc', tooltipBg: '#fff', tooltipText: '#082f49', tooltipBorder: '#bae6fd' },
    dark: { palette: ['#00ccff','#00ff44','#ff3333','#ffaa00','#aa66ff','#00ddbb','#ff55aa','#4488ff','#33dd77','#ff8833','#aa88ff','#33ddee'],
      background: '#001828', surface: '#002838', text: '#aaddff', textSecondary: '#4488aa', grid: '#002838', axis: '#003848', tooltipBg: '#002838', tooltipText: '#aaddff', tooltipBorder: '#003848' } },

  { id: 'flight-nite', name: 'Night Flight', category: 'aviation',
    light: { palette: ['#dc2626','#ea580c','#f59e0b','#14532d','#1e40af','#7c3aed','#be185d','#059669','#0891b2','#d97706','#6d28d9','#9f1239'],
      background: '#fef2f2', surface: '#fee2e2', text: '#450a0a', textSecondary: '#991b1b', grid: '#fecaca', axis: '#fca5a5', tooltipBg: '#fff', tooltipText: '#450a0a', tooltipBorder: '#fecaca' },
    dark: { palette: ['#ff4444','#ff7744','#ffbb33','#22ff66','#4488ff','#aa77ff','#ff66aa','#33dd88','#44ccee','#ffaa33','#9966ff','#ff4477'],
      background: '#0a0000', surface: '#1a0808', text: '#ffcccc', textSecondary: '#aa4444', grid: '#1a0808', axis: '#2a1010', tooltipBg: '#1a0808', tooltipText: '#ffcccc', tooltipBorder: '#2a1010' } },

  { id: 'hud', name: 'Heads-Up Display', category: 'aviation',
    light: { palette: ['#059669','#0891b2','#65a30d','#0369a1','#15803d','#0d9488','#84cc16','#0284c7','#10b981','#14b8a6','#22c55e','#06b6d4'],
      background: '#f0fdfa', surface: '#ccfbf1', text: '#042f2e', textSecondary: '#0d9488', grid: '#99f6e4', axis: '#5eead4', tooltipBg: '#fff', tooltipText: '#042f2e', tooltipBorder: '#99f6e4' },
    dark: { palette: ['#00ff88','#00ddff','#88ff00','#0088ff','#33ff66','#00bbaa','#aaff33','#0099ee','#44dd88','#22ccbb','#66ff44','#33ccff'],
      background: '#000a08', surface: '#001a14', text: '#88ffcc', textSecondary: '#33aa77', grid: '#001a14', axis: '#002a20', tooltipBg: '#001a14', tooltipText: '#88ffcc', tooltipBorder: '#002a20' } },

  // ──────────────────────── CREATIVE ────────────────────────
  { id: 'pop-art', name: 'Pop Art', category: 'creative',
    light: { palette: ['#ef4444','#eab308','#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#06b6d4','#84cc16','#f43f5e','#8b5cf6','#14b8a6'],
      background: '#fffbeb', surface: '#fef3c7', text: '#1c1917', textSecondary: '#78716c', grid: '#fde68a', axis: '#fcd34d', tooltipBg: '#fff', tooltipText: '#1c1917', tooltipBorder: '#fde68a' },
    dark: { palette: ['#ff0055','#ffee00','#0088ff','#00ee55','#ff8800','#cc44ff','#ff44aa','#00ccee','#aaff00','#ff2266','#8855ff','#00ddaa'],
      background: '#0a0000', surface: '#1a0a00', text: '#ffffcc', textSecondary: '#aaaa44', grid: '#1a0a00', axis: '#2a1400', tooltipBg: '#1a0a00', tooltipText: '#ffffcc', tooltipBorder: '#2a1400' } },

  { id: 'bauhaus', name: 'Bauhaus', category: 'creative',
    light: { palette: ['#dc2626','#1d4ed8','#eab308','#1c1917','#991b1b','#1e40af','#ca8a04','#374151','#b91c1c','#2563eb','#d97706','#111827'],
      background: '#fefce8', surface: '#fef9c3', text: '#1c1917', textSecondary: '#57534e', grid: '#fef08a', axis: '#fde047', tooltipBg: '#fff', tooltipText: '#1c1917', tooltipBorder: '#fef08a' },
    dark: { palette: ['#ff4444','#4488ff','#ffdd00','#dddddd','#ff6666','#6699ff','#ffcc33','#aaaaaa','#ff2222','#3377ff','#ffbb00','#888888'],
      background: '#0a0a05', surface: '#1a1a0a', text: '#ffff88', textSecondary: '#aaaa44', grid: '#1a1a0a', axis: '#2a2a10', tooltipBg: '#1a1a0a', tooltipText: '#ffff88', tooltipBorder: '#2a2a10' } },

  { id: 'vaporwave', name: 'Vaporwave', category: 'creative',
    light: { palette: ['#c026d3','#7c3aed','#2563eb','#0891b2','#ec4899','#a855f7','#6366f1','#06b6d4','#f43f5e','#8b5cf6','#4f46e5','#14b8a6'],
      background: '#fdf2f8', surface: '#fce7f3', text: '#4a044e', textSecondary: '#a21caf', grid: '#f5d0fe', axis: '#e879f9', tooltipBg: '#fff', tooltipText: '#4a044e', tooltipBorder: '#f5d0fe' },
    dark: { palette: ['#ff00ff','#8800ff','#0088ff','#00ffff','#ff44cc','#aa55ff','#4466ff','#00dddd','#ff2299','#9944ff','#3355ff','#00bbbb'],
      background: '#0a001a', surface: '#1a0030', text: '#ff88ff', textSecondary: '#aa44aa', grid: '#1a0030', axis: '#2a0048', tooltipBg: '#1a0030', tooltipText: '#ff88ff', tooltipBorder: '#2a0048' } },

  { id: 'gradient-dream', name: 'Gradient Dream', category: 'creative',
    light: { palette: ['#6366f1','#8b5cf6','#c026d3','#ec4899','#f43f5e','#f97316','#eab308','#84cc16','#10b981','#06b6d4','#0ea5e9','#4f46e5'],
      background: '#ffffff', surface: '#faf5ff', text: '#1e1b4b', textSecondary: '#6366f1', grid: '#ede9fe', axis: '#ddd6fe', tooltipBg: '#fff', tooltipText: '#1e1b4b', tooltipBorder: '#ede9fe' },
    dark: { palette: ['#818cf8','#a78bfa','#e879f9','#f472b6','#fb7185','#fb923c','#facc15','#a3e635','#34d399','#22d3ee','#38bdf8','#6366f1'],
      background: '#0f0a2a', surface: '#1a1040', text: '#ddd6fe', textSecondary: '#818cf8', grid: '#1a1040', axis: '#2a1860', tooltipBg: '#1a1040', tooltipText: '#ddd6fe', tooltipBorder: '#2a1860' } },

  // ──────────────────────── RETRO ────────────────────────
  { id: 'c64', name: 'Commodore 64', category: 'retro',
    light: { palette: ['#352879','#6c5eb5','#b8696d','#9ae29b','#ffffff','#959595','#8b542b','#cbdbab','#8b3f96','#68a941','#7c70da','#bf7b58'],
      background: '#e0e0e0', surface: '#d0d0d0', text: '#1a1a3a', textSecondary: '#5050a0', grid: '#c0c0c0', axis: '#a0a0a0', tooltipBg: '#fff', tooltipText: '#1a1a3a', tooltipBorder: '#b0b0c0' },
    dark: { palette: ['#6c5eb5','#a0a0ff','#ff8888','#88ff88','#ffffff','#bbbbbb','#cc8844','#ccffbb','#cc66dd','#88dd66','#9988ff','#ff9966'],
      background: '#40318d', surface: '#352879', text: '#a0a0ff', textSecondary: '#6c5eb5', grid: '#4a3aa0', axis: '#5544b0', tooltipBg: '#352879', tooltipText: '#a0a0ff', tooltipBorder: '#5544b0' } },

  { id: 'retro-crt', name: 'CRT Monitor', category: 'retro',
    light: { palette: ['#00aa00','#cc6600','#aa0000','#0066cc','#cc00cc','#00aaaa','#aaaa00','#666666','#00cc00','#ff8800','#ff0000','#0088ff'],
      background: '#e8e8d8', surface: '#d8d8c8', text: '#1a1a10', textSecondary: '#4a4a3a', grid: '#c8c8b8', axis: '#a8a8a0', tooltipBg: '#fafaf0', tooltipText: '#1a1a10', tooltipBorder: '#b8b8a8' },
    dark: { palette: ['#00ff00','#ff8800','#ff3333','#4499ff','#ff44ff','#00dddd','#dddd00','#999999','#33ff33','#ffaa33','#ff5555','#55aaff'],
      background: '#0a0a05', surface: '#1a1a0a', text: '#00ff00', textSecondary: '#008800', grid: '#1a1a0a', axis: '#222210', tooltipBg: '#1a1a0a', tooltipText: '#00ff00', tooltipBorder: '#222210' } },

  { id: 'solarized', name: 'Solarized', category: 'retro',
    light: { palette: ['#268bd2','#2aa198','#859900','#b58900','#cb4b16','#dc322f','#d33682','#6c71c4','#268bd2','#2aa198','#859900','#b58900'],
      background: '#fdf6e3', surface: '#eee8d5', text: '#073642', textSecondary: '#586e75', grid: '#eee8d5', axis: '#93a1a1', tooltipBg: '#fdf6e3', tooltipText: '#073642', tooltipBorder: '#93a1a1' },
    dark: { palette: ['#268bd2','#2aa198','#859900','#b58900','#cb4b16','#dc322f','#d33682','#6c71c4','#268bd2','#2aa198','#859900','#b58900'],
      background: '#002b36', surface: '#073642', text: '#839496', textSecondary: '#586e75', grid: '#073642', axis: '#586e75', tooltipBg: '#073642', tooltipText: '#839496', tooltipBorder: '#586e75' } },

  { id: 'dracula', name: 'Dracula', category: 'retro',
    light: { palette: ['#7c3aed','#059669','#f97316','#ec4899','#06b6d4','#eab308','#ef4444','#a855f7','#10b981','#f59e0b','#f43f5e','#0ea5e9'],
      background: '#faf7ff', surface: '#ede9fe', text: '#2e1065', textSecondary: '#6d28d9', grid: '#ddd6fe', axis: '#c4b5fd', tooltipBg: '#fff', tooltipText: '#2e1065', tooltipBorder: '#ddd6fe' },
    dark: { palette: ['#bd93f9','#50fa7b','#ffb86c','#ff79c6','#8be9fd','#f1fa8c','#ff5555','#bd93f9','#50fa7b','#ffb86c','#ff79c6','#8be9fd'],
      background: '#282a36', surface: '#44475a', text: '#f8f8f2', textSecondary: '#6272a4', grid: '#44475a', axis: '#6272a4', tooltipBg: '#44475a', tooltipText: '#f8f8f2', tooltipBorder: '#6272a4' } },

  // ──────────────────────── NEON ────────────────────────
  { id: 'neon-city', name: 'Neon City', category: 'neon',
    light: { palette: ['#c026d3','#06b6d4','#ec4899','#22c55e','#f97316','#6366f1','#eab308','#0ea5e9','#f43f5e','#a855f7','#84cc16','#14b8a6'],
      background: '#faf5ff', surface: '#f5d0fe', text: '#3b0764', textSecondary: '#86198f', grid: '#e9d5ff', axis: '#d8b4fe', tooltipBg: '#fff', tooltipText: '#3b0764', tooltipBorder: '#e9d5ff' },
    dark: { palette: ['#ff00ff','#00ffff','#ff0088','#00ff44','#ff8800','#5555ff','#ffee00','#0099ff','#ff2266','#aa44ff','#88ff00','#00ddaa'],
      background: '#05000a', surface: '#0a0018', text: '#ff88ff', textSecondary: '#aa44aa', grid: '#0a0018', axis: '#150028', tooltipBg: '#0a0018', tooltipText: '#ff88ff', tooltipBorder: '#150028' } },

  { id: 'electric', name: 'Electric Blue', category: 'neon',
    light: { palette: ['#2563eb','#0891b2','#6366f1','#0ea5e9','#4f46e5','#06b6d4','#1d4ed8','#0369a1','#3b82f6','#22d3ee','#1e40af','#14b8a6'],
      background: '#eff6ff', surface: '#dbeafe', text: '#1e3a8a', textSecondary: '#2563eb', grid: '#bfdbfe', axis: '#93c5fd', tooltipBg: '#fff', tooltipText: '#1e3a8a', tooltipBorder: '#bfdbfe' },
    dark: { palette: ['#0088ff','#00ccff','#4466ff','#00eeff','#3355ff','#00dddd','#2244ee','#0077cc','#5588ff','#44ddff','#1133cc','#22bbaa'],
      background: '#000820', surface: '#001030', text: '#88ccff', textSecondary: '#3388cc', grid: '#001030', axis: '#001a48', tooltipBg: '#001030', tooltipText: '#88ccff', tooltipBorder: '#001a48' } },

  { id: 'matrix', name: 'Matrix Rain', category: 'neon',
    light: { palette: ['#15803d','#059669','#065f46','#047857','#10b981','#14532d','#166534','#0d9488','#22c55e','#4ade80','#134e4a','#0f766e'],
      background: '#f0fdf4', surface: '#dcfce7', text: '#052e16', textSecondary: '#15803d', grid: '#bbf7d0', axis: '#86efac', tooltipBg: '#fff', tooltipText: '#052e16', tooltipBorder: '#bbf7d0' },
    dark: { palette: ['#00ff41','#00cc33','#00ff66','#33ff55','#00dd22','#22ff44','#00ee33','#00bb22','#44ff66','#00aa11','#55ff77','#00ff55'],
      background: '#000a00', surface: '#001800', text: '#00ff41', textSecondary: '#008822', grid: '#001800', axis: '#002800', tooltipBg: '#001800', tooltipText: '#00ff41', tooltipBorder: '#002800' } },

  { id: 'synthwave', name: 'Synthwave', category: 'neon',
    light: { palette: ['#7c3aed','#c026d3','#db2777','#e11d48','#ea580c','#f59e0b','#06b6d4','#6366f1','#ec4899','#f43f5e','#a855f7','#14b8a6'],
      background: '#fdf2f8', surface: '#fce7f3', text: '#4a044e', textSecondary: '#a21caf', grid: '#f5d0fe', axis: '#e879f9', tooltipBg: '#fff', tooltipText: '#4a044e', tooltipBorder: '#f5d0fe' },
    dark: { palette: ['#7b2fff','#ff00d4','#ff2277','#ff3355','#ff7722','#ffbb00','#00eecc','#5533ff','#ff44aa','#ff4466','#bb55ff','#00ddaa'],
      background: '#0d001a','surface':'#1a0030','text':'#ff88ff','textSecondary':'#9944cc','grid':'#1a0030','axis':'#2a0050','tooltipBg':'#1a0030','tooltipText':'#ff88ff','tooltipBorder':'#2a0050'} },

  // ──────────────────────── MONOCHROME ────────────────────────
  { id: 'ink', name: 'Ink & Paper', category: 'monochrome',
    light: { palette: ['#111827','#374151','#4b5563','#6b7280','#9ca3af','#d1d5db','#1f2937','#3f3f46','#525252','#737373','#a3a3a3','#d4d4d4'],
      background: '#ffffff', surface: '#f9fafb', text: '#111827', textSecondary: '#6b7280', grid: '#f3f4f6', axis: '#e5e7eb', tooltipBg: '#fff', tooltipText: '#111827', tooltipBorder: '#e5e7eb' },
    dark: { palette: ['#f9fafb','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#f3f4f6','#d4d4d8','#a1a1aa','#71717a','#52525b','#3f3f46'],
      background: '#030712', surface: '#111827', text: '#f9fafb', textSecondary: '#6b7280', grid: '#1f2937', axis: '#374151', tooltipBg: '#111827', tooltipText: '#f9fafb', tooltipBorder: '#374151' } },

  { id: 'sepia', name: 'Sepia Tone', category: 'monochrome',
    light: { palette: ['#78350f','#92400e','#a16207','#854d0e','#713f12','#9a3412','#b45309','#ca8a04','#78350f','#6b3500','#8a4f00','#a36800'],
      background: '#fef3e6', surface: '#fde8cc', text: '#3a1e08', textSecondary: '#78350f', grid: '#f5d4a8', axis: '#e8c088', tooltipBg: '#fffaf0', tooltipText: '#3a1e08', tooltipBorder: '#e8c088' },
    dark: { palette: ['#fbbf24','#f59e0b','#d97706','#b45309','#fcd34d','#facc15','#ca8a04','#a16207','#fde047','#eab308','#92400e','#854d0e'],
      background: '#140c02', surface: '#201406', text: '#fcd9a0', textSecondary: '#a08040', grid: '#201406', axis: '#301e0a', tooltipBg: '#201406', tooltipText: '#fcd9a0', tooltipBorder: '#301e0a' } },

  // ──────────────────────── WARM ────────────────────────
  { id: 'sunset', name: 'Desert Sunset', category: 'warm',
    light: { palette: ['#dc2626','#ea580c','#d97706','#ca8a04','#f97316','#ef4444','#f59e0b','#eab308','#b91c1c','#c2410c','#b45309','#a16207'],
      background: '#fffbeb', surface: '#fef3c7', text: '#451a03', textSecondary: '#92400e', grid: '#fde68a', axis: '#fcd34d', tooltipBg: '#fff', tooltipText: '#451a03', tooltipBorder: '#fde68a' },
    dark: { palette: ['#f87171','#fb923c','#fbbf24','#facc15','#ff9040','#ff6060','#ffaa44','#ffcc22','#ff4444','#ff7733','#ddaa00','#cc8800'],
      background: '#1a0800', surface: '#2a1000', text: '#ffe0b0', textSecondary: '#aa7030', grid: '#2a1000', axis: '#3a1808', tooltipBg: '#2a1000', tooltipText: '#ffe0b0', tooltipBorder: '#3a1808' } },

  { id: 'terracotta', name: 'Terracotta', category: 'warm',
    light: { palette: ['#9a3412','#aa5522','#bb7733','#cc9944','#884422','#996633','#aa7744','#773311','#995533','#bb8844','#664422','#886633'],
      background: '#fdf4ef', surface: '#fae8da', text: '#3a1a08', textSecondary: '#9a5a3a', grid: '#f0d4be', axis: '#e0c0a0', tooltipBg: '#fff', tooltipText: '#3a1a08', tooltipBorder: '#e0c0a0' },
    dark: { palette: ['#e8956a','#d4825a','#c0704a','#ffaa80','#cc6e40','#eea878','#dda070','#bb6030','#f0b888','#cc8860','#aa5830','#ddaa88'],
      background: '#1a0c04', surface: '#2a1608', text: '#f0d0b0', textSecondary: '#aa7850', grid: '#2a1608', axis: '#3a200c', tooltipBg: '#2a1608', tooltipText: '#f0d0b0', tooltipBorder: '#3a200c' } },

  // ──────────────────────── COOL ────────────────────────
  { id: 'glacier', name: 'Glacier Ice', category: 'cool',
    light: { palette: ['#0c4a6e','#155e75','#164e63','#0e7490','#0891b2','#06b6d4','#0284c7','#0369a1','#075985','#0d9488','#115e59','#0f766e'],
      background: '#ecfeff', surface: '#cffafe', text: '#083344', textSecondary: '#155e75', grid: '#a5f3fc', axis: '#67e8f9', tooltipBg: '#fff', tooltipText: '#083344', tooltipBorder: '#a5f3fc' },
    dark: { palette: ['#67e8f9','#22d3ee','#06b6d4','#a5f3fc','#0891b2','#5eead4','#2dd4bf','#14b8a6','#7dd3fc','#38bdf8','#99f6e4','#0ea5e9'],
      background: '#001a24', surface: '#002434', text: '#a5f3fc', textSecondary: '#06b6d4', grid: '#002434', axis: '#003444', tooltipBg: '#002434', tooltipText: '#a5f3fc', tooltipBorder: '#003444' } },

  { id: 'lavender', name: 'Digital Lavender', category: 'cool',
    light: { palette: ['#6d28d9','#7c3aed','#8b5cf6','#a855f7','#6366f1','#4f46e5','#4338ca','#3b0764','#581c87','#4c1d95','#c026d3','#a21caf'],
      background: '#faf5ff', surface: '#f3e8ff', text: '#2e1065', textSecondary: '#7c3aed', grid: '#e9d5ff', axis: '#d8b4fe', tooltipBg: '#fff', tooltipText: '#2e1065', tooltipBorder: '#e9d5ff' },
    dark: { palette: ['#a78bfa','#c084fc','#d8b4fe','#e9d5ff','#818cf8','#8b5cf6','#7c3aed','#a855f7','#c084fc','#6366f1','#e879f9','#d946ef'],
      background: '#0c0020', surface: '#180038', text: '#e9d5ff', textSecondary: '#8b5cf6', grid: '#180038', axis: '#280058', tooltipBg: '#180038', tooltipText: '#e9d5ff', tooltipBorder: '#280058' } },

  // ──────────────────────── PASTEL ────────────────────────
  { id: 'cotton-candy', name: 'Cotton Candy', category: 'pastel',
    light: { palette: ['#93c5fd','#f9a8d4','#a5b4fc','#86efac','#fdba74','#fda4af','#c4b5fd','#6ee7b7','#fca5a5','#a5f3fc','#fde68a','#f0abfc'],
      background: '#fefcff', surface: '#fdf2f8', text: '#3b0764', textSecondary: '#9333ea', grid: '#f5d0fe', axis: '#e8b0e0', tooltipBg: '#fff', tooltipText: '#3b0764', tooltipBorder: '#f5d0fe' },
    dark: { palette: ['#60a5fa','#f472b6','#818cf8','#4ade80','#fb923c','#fb7185','#a78bfa','#34d399','#f87171','#22d3ee','#fbbf24','#e879f9'],
      background: '#0a0010', surface: '#180020', text: '#f0d0ff', textSecondary: '#a050d0', grid: '#180020', axis: '#280038', tooltipBg: '#180020', tooltipText: '#f0d0ff', tooltipBorder: '#280038' } },

  { id: 'macarons', name: 'French Macarons', category: 'pastel',
    light: { palette: ['#d4a5a5','#a5d4b3','#a5b8d4','#d4caa5','#c4a5d4','#a5d4d0','#d4a5c0','#b5d4a5','#d4b8a5','#a5c4d4','#d4d4a5','#a5a5d4'],
      background: '#fffdfb', surface: '#fef7f0', text: '#3a2e28', textSecondary: '#8a7a6a', grid: '#f0e8e0', axis: '#e0d0c0', tooltipBg: '#fff', tooltipText: '#3a2e28', tooltipBorder: '#e8d8c8' },
    dark: { palette: ['#e8b0b0','#b0e8c0','#b0c0e8','#e8dab0','#d0b0e8','#b0e8e0','#e8b0d0','#c0e8b0','#e8c8b0','#b0d0e8','#e8e8b0','#b0b0e8'],
      background: '#1a1210', surface: '#2a1c18', text: '#f0e0d0', textSecondary: '#a08868', grid: '#2a1c18', axis: '#3a2820', tooltipBg: '#2a1c18', tooltipText: '#f0e0d0', tooltipBorder: '#3a2820' } },

  // ──────────────────────── EARTH ────────────────────────
  { id: 'terra', name: 'Terra Firma', category: 'earth',
    light: { palette: ['#78350f','#065f46','#854d0e','#1e3a5f','#713f12','#155e75','#92400e','#164e63','#9a3412','#0c4a6e','#b45309','#115e59'],
      background: '#fefdf2', surface: '#faf8e8', text: '#1e1a08', textSecondary: '#6a5a3a', grid: '#f0ead0', axis: '#d8d0b0', tooltipBg: '#fff', tooltipText: '#1e1a08', tooltipBorder: '#e0d8c0' },
    dark: { palette: ['#fbbf24','#34d399','#fcd34d','#60a5fa','#fdba74','#22d3ee','#fb923c','#67e8f9','#f87171','#38bdf8','#facc15','#5eead4'],
      background: '#0a0804', surface: '#1a1208', text: '#f0e4c8', textSecondary: '#a09060', grid: '#1a1208', axis: '#2a1c10', tooltipBg: '#1a1208', tooltipText: '#f0e4c8', tooltipBorder: '#2a1c10' } },

  { id: 'volcanic', name: 'Volcanic', category: 'earth',
    light: { palette: ['#7f1d1d','#991b1b','#b91c1c','#dc2626','#ef4444','#92400e','#78350f','#451a03','#9a3412','#c2410c','#ea580c','#f97316'],
      background: '#fef2f2', surface: '#fee2e2', text: '#450a0a', textSecondary: '#991b1b', grid: '#fecaca', axis: '#fca5a5', tooltipBg: '#fff', tooltipText: '#450a0a', tooltipBorder: '#fecaca' },
    dark: { palette: ['#fca5a5','#f87171','#ef4444','#dc2626','#ff6060','#fdba74','#fbbf24','#991b1b','#fb923c','#f97316','#ff8040','#ff4444'],
      background: '#1a0404', surface: '#2a0808', text: '#fecaca', textSecondary: '#dc2626', grid: '#2a0808', axis: '#3a0c0c', tooltipBg: '#2a0808', tooltipText: '#fecaca', tooltipBorder: '#3a0c0c' } },

  { id: 'sandstone', name: 'Sandstone', category: 'earth',
    light: { palette: ['#a8763e','#7e6145','#c69c6d','#9a7b5b','#d4ad80','#887050','#b08858','#786044','#c0a070','#907040','#a89060','#685838'],
      background: '#fef8f0', surface: '#f8f0e0', text: '#3a2e1e', textSecondary: '#8a7058', grid: '#f0e4d0', axis: '#e0d0b8', tooltipBg: '#fff', tooltipText: '#3a2e1e', tooltipBorder: '#e0d0b8' },
    dark: { palette: ['#d4b080','#c4a070','#e0c898','#b89060','#ecd8b0','#a88858','#ccb078','#988050','#e0c890','#b09068','#c8aa80','#887048'],
      background: '#141008', surface: '#201a0e', text: '#e8d8c0', textSecondary: '#a89068', grid: '#201a0e', axis: '#302414', tooltipBg: '#201a0e', tooltipText: '#e8d8c0', tooltipBorder: '#302414' } },

  { id: 'moss', name: 'Forest Moss', category: 'earth',
    light: { palette: ['#365314','#3f6212','#4d7c0f','#65a30d','#166534','#15803d','#047857','#059669','#14532d','#064e3b','#134e4a','#115e59'],
      background: '#f7fdf0', surface: '#ecfce0', text: '#142e08', textSecondary: '#3f6212', grid: '#d8f4c4', axis: '#b8e4a0', tooltipBg: '#fff', tooltipText: '#142e08', tooltipBorder: '#c8ecb0' },
    dark: { palette: ['#a3e635','#86efac','#84cc16','#4ade80','#bef264','#6ee7b7','#a3e635','#34d399','#d9f99d','#86efac','#a3e635','#22c55e'],
      background: '#060e02', surface: '#0c1a06', text: '#d0f0b0', textSecondary: '#6aaa30', grid: '#0c1a06', axis: '#14280a', tooltipBg: '#0c1a06', tooltipText: '#d0f0b0', tooltipBorder: '#14280a' } },

  // ──────────────────────── MORE SPECIALTY ────────────────────────
  { id: 'radar-green', name: 'Radar Screen', category: 'aviation',
    light: { palette: ['#059669','#0891b2','#10b981','#14b8a6','#22c55e','#06b6d4','#34d399','#0ea5e9','#4ade80','#22d3ee','#86efac','#67e8f9'],
      background: '#f0fdf9', surface: '#d0fbe8', text: '#024030', textSecondary: '#058060', grid: '#a0f0d0', axis: '#70e0b0', tooltipBg: '#fff', tooltipText: '#024030', tooltipBorder: '#a0f0d0' },
    dark: { palette: ['#00ff66','#00ddff','#33ff88','#22ddcc','#66ff99','#00ccee','#55ffaa','#44bbff','#88ffbb','#44eeff','#aaffcc','#88ddff'],
      background: '#001a0c', surface: '#002a16', text: '#88ffbb', textSecondary: '#33aa66', grid: '#002a16', axis: '#003a20', tooltipBg: '#002a16', tooltipText: '#88ffbb', tooltipBorder: '#003a20' } },

  { id: 'gold-lux', name: 'Gold Luxury', category: 'warm',
    light: { palette: ['#a16207','#854d0e','#92400e','#ca8a04','#b45309','#78350f','#d97706','#713f12','#eab308','#9a3412','#f59e0b','#65a30d'],
      background: '#fffdf0', surface: '#fef9e0', text: '#3a2e08', textSecondary: '#8a7028', grid: '#fef0c0', axis: '#f8e098', tooltipBg: '#fff', tooltipText: '#3a2e08', tooltipBorder: '#f0e0a0' },
    dark: { palette: ['#fbbf24','#f59e0b','#fcd34d','#eab308','#facc15','#d97706','#fde047','#ca8a04','#fef08a','#b45309','#fde68a','#a3e635'],
      background: '#0a0800', surface: '#1a1200', text: '#fef0a8', textSecondary: '#b09020', grid: '#1a1200', axis: '#2a1c00', tooltipBg: '#1a1200', tooltipText: '#fef0a8', tooltipBorder: '#2a1c00' } },

  { id: 'rosegold', name: 'Rose Gold', category: 'warm',
    light: { palette: ['#be185d','#db2777','#e11d48','#9f1239','#881337','#ec4899','#f472b6','#f43f5e','#be123c','#a21caf','#d946ef','#c026d3'],
      background: '#fdf2f8', surface: '#fce7f3', text: '#500724', textSecondary: '#9d174d', grid: '#fbcfe8', axis: '#f9a8d4', tooltipBg: '#fff', tooltipText: '#500724', tooltipBorder: '#fbcfe8' },
    dark: { palette: ['#f472b6','#fb7185','#fda4af','#fecdd3','#f9a8d4','#f43f5e','#ec4899','#e879f9','#f0abfc','#ff6090','#ff88aa','#ffaacc'],
      background: '#1a0510', surface: '#2a0c1a', text: '#fecdd3', textSecondary: '#f472b6', grid: '#2a0c1a', axis: '#3a1424', tooltipBg: '#2a0c1a', tooltipText: '#fecdd3', tooltipBorder: '#3a1424' } },

  { id: 'cyberpunk', name: 'Cyberpunk 2077', category: 'neon',
    light: { palette: ['#eab308','#06b6d4','#ef4444','#c026d3','#3b82f6','#22c55e','#f97316','#a855f7','#14b8a6','#f43f5e','#84cc16','#8b5cf6'],
      background: '#fffbeb', surface: '#fef3c7', text: '#422006', textSecondary: '#92400e', grid: '#fde68a', axis: '#fcd34d', tooltipBg: '#fff', tooltipText: '#422006', tooltipBorder: '#fde68a' },
    dark: { palette: ['#fcee09','#00fFca','#ff3547','#e900ff','#3366ff','#39ff14','#ff6a00','#bf40ff','#00e5ff','#ff0040','#76ff03','#7c4dff'],
      background: '#0c0c14', surface: '#14141e', text: '#fcee09', textSecondary: '#b0a800', grid: '#14141e', axis: '#1e1e28', tooltipBg: '#14141e', tooltipText: '#fcee09', tooltipBorder: '#1e1e28' } },

  { id: 'tokyo-night', name: 'Tokyo Night', category: 'cool',
    light: { palette: ['#2e7de9','#f52a65','#587539','#946be0','#166775','#b35900','#007a76','#8c6c3e','#9854f1','#118c74','#0f4b6e','#ad5c7c'],
      background: '#e1e2e7', surface: '#d5d6db', text: '#343b59', textSecondary: '#6172b0', grid: '#c8c9ce', axis: '#b0b1b6', tooltipBg: '#fff', tooltipText: '#343b59', tooltipBorder: '#c8c9ce' },
    dark: { palette: ['#7aa2f7','#f7768e','#9ece6a','#bb9af7','#2ac3de','#ff9e64','#73daca','#e0af68','#7dcfff','#1abc9c','#89ddff','#c0caf5'],
      background: '#1a1b26', surface: '#24283b', text: '#c0caf5', textSecondary: '#565f89', grid: '#24283b', axis: '#3b4261', tooltipBg: '#24283b', tooltipText: '#c0caf5', tooltipBorder: '#3b4261' } },

  { id: 'nord', name: 'Nord', category: 'cool',
    light: { palette: ['#5e81ac','#bf616a','#a3be8c','#b48ead','#88c0d0','#d08770','#ebcb8b','#81a1c1','#8fbcbb','#bf616a','#a3be8c','#b48ead'],
      background: '#eceff4', surface: '#e5e9f0', text: '#2e3440', textSecondary: '#4c566a', grid: '#d8dee9', axis: '#c0c8d4', tooltipBg: '#eceff4', tooltipText: '#2e3440', tooltipBorder: '#c0c8d4' },
    dark: { palette: ['#88c0d0','#bf616a','#a3be8c','#b48ead','#5e81ac','#d08770','#ebcb8b','#81a1c1','#8fbcbb','#bf616a','#a3be8c','#b48ead'],
      background: '#2e3440', surface: '#3b4252', text: '#eceff4', textSecondary: '#d8dee9', grid: '#3b4252', axis: '#434c5e', tooltipBg: '#3b4252', tooltipText: '#eceff4', tooltipBorder: '#4c566a' } },

  { id: 'gruvbox', name: 'Gruvbox', category: 'retro',
    light: { palette: ['#cc241d','#98971a','#d79921','#458588','#b16286','#689d6a','#d65d0e','#928374','#9d0006','#79740e','#b57614','#076678'],
      background: '#fbf1c7', surface: '#f2e5bc', text: '#3c3836', textSecondary: '#665c54', grid: '#ebdbb2', axis: '#d5c4a1', tooltipBg: '#fbf1c7', tooltipText: '#3c3836', tooltipBorder: '#d5c4a1' },
    dark: { palette: ['#fb4934','#b8bb26','#fabd2f','#83a598','#d3869b','#8ec07c','#fe8019','#a89984','#cc241d','#98971a','#d79921','#458588'],
      background: '#282828', surface: '#3c3836', text: '#ebdbb2', textSecondary: '#a89984', grid: '#3c3836', axis: '#504945', tooltipBg: '#3c3836', tooltipText: '#ebdbb2', tooltipBorder: '#504945' } },
];

// ── Quick lookup ─────────────────────────────────────────────────────────
export function getPalette(id: string): PalettePair | undefined {
  return palettes.find(p => p.id === id);
}

export function listPalettesByCategory(category: PalettePair['category']): PalettePair[] {
  return palettes.filter(p => p.category === category);
}

export function getAllThemes(): ThemeConfig[] {
  const themes: ThemeConfig[] = [];
  for (const p of palettes) {
    themes.push(paletteToTheme(p, 'light'));
    themes.push(paletteToTheme(p, 'dark'));
  }
  return themes;
}
