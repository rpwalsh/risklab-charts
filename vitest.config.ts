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
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/index.ts',                    // barrel files
        'src/**/*.d.ts',
        'src/adapters/react/**',              // needs React test setup
        // WebGL 3D infrastructure — requires real GPU/browser context, untestable in jsdom
        'src/3d/WebGL3DRenderer.ts',
        'src/3d/Scene3D.ts',
        'src/3d/OrbitControls.ts',
        'src/3d/Overlay3D.ts',
        'src/3d/Responsive3DViewport.ts',
        'src/3d/render3DChart.ts',
        // Animation engine — uses requestAnimationFrame, requires real browser loop
        'src/animations/AnimationEngine.ts',
        'src/animations/TimelineControls.ts',
        'src/animations/TimelinePlayback.ts',
        // Framework-specific adapter glue — requires DOM/MUI/StyleX runtime
        'src/adapters/mui/**',
        'src/adapters/stylex/**',
        'src/adapters/webcomponent/**',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
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
