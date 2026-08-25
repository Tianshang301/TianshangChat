import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Each test file gets its own worker with a fresh env + module registry.
    pool: 'forks',
    poolOptions: { forks: { isolate: true } },
  },
});
