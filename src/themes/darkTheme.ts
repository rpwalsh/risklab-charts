// ============================================================================
// RiskLab Charts — Dark Theme
// Modern dark mode with vibrant accent colors
// ============================================================================

import type { ThemeConfig } from '../core/types';

export const darkTheme: ThemeConfig = {
  id: 'dark',
  name: 'RiskLab Dark',
  palette: [
    '#818CF8', // Indigo light
    '#38BDF8', // Sky light
    '#34D399', // Emerald light
    '#FBBF24', // Amber light
    '#F87171', // Red light
    '#A78BFA', // Violet light
    '#F472B6', // Pink light
    '#22D3EE', // Cyan light
    '#A3E635', // Lime light
    '#FB923C', // Orange light
    '#6366F1', // Indigo
    '#2DD4BF', // Teal light
    '#FB7185', // Rose light
    '#C084FC', // Purple light
    '#4ADE80', // Green light
    '#FDE047', // Yellow light
  ],
  backgroundColor: '#0F172A',
  textColor: '#E2E8F0',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 12,
  axis: {
    lineColor: '#334155',
    gridColor: '#1E293B',
    labelColor: '#94A3B8',
    titleColor: '#CBD5E1',
  },
  tooltip: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    textColor: '#E2E8F0',
    shadow: {
      enabled: true,
      color: 'rgba(0,0,0,0.3)',
      offsetX: 0,
      offsetY: 4,
      blur: 16,
    },
  },
  legend: {
    textColor: '#CBD5E1',
    hoverColor: '#F1F5F9',
    inactiveColor: '#475569',
  },
};
