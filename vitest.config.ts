import { defineConfig } from 'vitest/config';

/**
 * Workspace-wide vitest config using v4 "projects" mode. Each package
 * declares its own vitest.config.ts with environment + setup specifics;
 * `pnpm test` here runs them all.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/broker-core',
      'packages/broker-alpaca',
      'packages/db',
      'packages/sidecar',
      'apps/desktop',
    ],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/src-tauri/**',
        '**/*.config.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
});
