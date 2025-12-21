#!/usr/bin/env npx tsx
/**
 * 大规模训练脚本
 * 运行5000+局游戏验证收敛性
 */

import { AutoTrainer, DEFAULT_TRAINING_CONFIG } from '../src/training/autoRun';
import { GameOrchestrator } from '../src/orchestration/GameOrchestrator';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { clearShantenCache, getShantenCacheStats } from '../src/agents/algo/shanten';

// 解析命令行参数
const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string): string => {
  const idx = args.findIndex(a => a === `--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const totalGames = parseInt(getArg('games', '5000'), 10);
const batchSize = parseInt(getArg('batch', '10'), 10);
const verbose = args.includes('--verbose');

console.log('🚀 Large-Scale Mahjong AI Training\n');
console.log('Configuration:');
console.log(`  Total Games: ${totalGames}`);
console.log(`  Batch Size: ${batchSize}`);
console.log(`  Verbose: ${verbose}`);
console.log('');

// 清空向听缓存开始新训练
clearShantenCache();

const orchestrator = new GameOrchestrator(chengduRulePack);

const trainer = new AutoTrainer(
  orchestrator,
  {
    ...DEFAULT_TRAINING_CONFIG,
    totalGames,
    batchSize,
    blocking: false,
    verbose,
  },
  (log) => {
    if (verbose || log.step % 10 === 0) {
      console.log(JSON.stringify(log, null, 2));
    }
  }
);

const startTime = Date.now();

trainer.start()
  .then(() => {
    const duration = (Date.now() - startTime) / 1000;
    const cacheStats = getShantenCacheStats();
    
    console.log('\n✅ Large-Scale Training Complete!\n');
    console.log('Statistics:');
    console.log(`  Duration: ${duration.toFixed(1)}s`);
    console.log(`  Games/sec: ${(totalGames / duration).toFixed(2)}`);
    console.log(`  Shanten Cache Size: ${cacheStats.shantenSize}`);
    console.log(`  Ukeire Cache Size: ${cacheStats.ukeireSize}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Training Failed:', err);
    process.exit(1);
  });
