#!/usr/bin/env npx tsx
/**
 * 快速训练脚本
 * 使用优化的训练系统大幅提高训练速度
 */

import { FastTrainer } from '../src/training/parallelTrainer';

// 解析命令行参数
const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string): string => {
  const idx = args.findIndex(a => a === `--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const totalGames = parseInt(getArg('games', '100'), 10);
const batchSize = parseInt(getArg('batch', '5'), 10);
const verbose = args.includes('--verbose');

console.log('🎮 Fast Mahjong AI Training\n');
console.log(`Configuration:`);
console.log(`  Games: ${totalGames}`);
console.log(`  Batch Size: ${batchSize}`);
console.log(`  Verbose: ${verbose}`);
console.log('');

const trainer = new FastTrainer({
  totalGames,
  batchSize,
  verbose,
});

trainer.run()
  .then(() => {
    console.log('\n🎉 Training completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Training failed:', err);
    process.exit(1);
  });
