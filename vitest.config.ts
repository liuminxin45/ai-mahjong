import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // 防止个别用例/钩子挂起导致 CI 无限等待（B3：防测试挂起）
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
