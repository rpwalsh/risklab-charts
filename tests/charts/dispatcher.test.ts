// ============================================================================
// Chart Dispatcher — Unit Tests (import verification + structure)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { renderChart } from '../../src/charts/index';

describe('Chart Dispatcher (renderChart)', () => {
  it('should be a function export', () => {
    expect(typeof renderChart).toBe('function');
  });

  // We can't easily call renderChart without a full renderer mock,
  // but we can verify the module loads all chart type imports cleanly.
  it('should load without import errors', () => {
    // If we reach here, all 36+ chart type modules were imported successfully.
    expect(true).toBe(true);
  });
});
