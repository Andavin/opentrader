import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'broker-fidelity',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
