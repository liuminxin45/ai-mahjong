/**
 * 测试配置
 * 用于控制 P0 是否为 AI，以便进行自动化测试
 */

export const testConfig = {
  // 设置为 true 让 P0 也由 AI 控制，用于测试
  p0IsAI: false,
  
  // 详细日志记录
  enableDetailedLogging: true,
};

// 全局函数，方便在控制台修改
(globalThis as any).setP0AI = (enabled: boolean) => {
  testConfig.p0IsAI = enabled;
  console.log(`[TestConfig] P0 AI mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log('[TestConfig] Please refresh the page to apply changes');
};

(globalThis as any).setDetailedLogging = (enabled: boolean) => {
  testConfig.enableDetailedLogging = enabled;
  console.log(`[TestConfig] Detailed logging: ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

// 启动时显示配置
console.log('[TestConfig] P0 AI mode:', testConfig.p0IsAI ? 'ENABLED' : 'DISABLED');
console.log('[TestConfig] Use setP0AI(true) to enable AI for P0');
console.log('[TestConfig] Use setP0AI(false) to disable AI for P0');
