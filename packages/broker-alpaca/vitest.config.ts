import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'broker-alpaca',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
