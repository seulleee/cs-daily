import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/modules/*/domain/**/*.ts'],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});
