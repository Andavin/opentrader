import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'broker-robinhood',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
