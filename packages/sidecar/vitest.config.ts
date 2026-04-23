import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'sidecar',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
