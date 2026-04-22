import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    passWithNoTests: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // TESTING_STRATEGY.md §6 — global minimums; tighten per-file branches on security/errors/executor at Phase 4 gate
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
