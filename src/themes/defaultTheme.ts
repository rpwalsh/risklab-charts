// ============================================================================
// RiskLab Charts — Default Theme (Light)
// A clean, modern light theme with an accessible color palette
// ============================================================================

import type { ThemeConfig } from '../core/types';

export const defaultTheme: ThemeConfig = {
  id: 'default',
  name: 'RiskLab Light',
  palette: [
    '#4F46E5', // Indigo
    '#0EA5E9', // Sky
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo lighter
    '#14B8A6', // Teal
    '#E11D48', // Rose
    '#A855F7', // Purple
    '#22C55E', // Green
    '#FACC15', // Yellow
  ],
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 12,
  axis: {
    lineColor: '#D1D5DB',
    gridColor: '#F3F4F6',
    labelColor: '#6B7280',
    titleColor: '#374151',
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    textColor: '#1F2937',
    shadow: {
      enabled: true,
      color: 'rgba(0,0,0,0.08)',
      offsetX: 0,
      offsetY: 4,
      blur: 12,
    },
  },
  legend: {
    textColor: '#374151',
    hoverColor: '#111827',
    inactiveColor: '#9CA3AF',
  },
};
