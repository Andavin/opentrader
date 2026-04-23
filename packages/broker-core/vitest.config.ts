import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'broker-core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
