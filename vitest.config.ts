import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/charts/**/*.ts',
        'src/scales/**/*.ts',
        'src/utils/**/*.ts',
        'src/themes/**/*.ts',
        'src/boost/**/*.ts',
        'src/sdk/**/*.ts',
        'src/data/**/*.ts',
        'src/core/DataPipeline.ts',
        'src/core/EventBus.ts',
        'src/core/SpatialIndex.ts',
        'src/core/Registry.ts',
      ],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
