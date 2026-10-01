import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    globalSetup: ['./tests/global-setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
