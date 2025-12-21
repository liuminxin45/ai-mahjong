#!/usr/bin/env tsx
/**
 * CLI 自我对局训练脚本
 * 在 Node.js 环境下运行，支持命令行参数
 */

import { GameOrchestrator } from '../src/orchestration/GameOrchestrator';
import { gameStore } from '../src/store/gameStore';
import { settingsStore } from '../src/store/settingsStore';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { AutoTrainer, DEFAULT_TRAINING_CONFIG } from '../src/training/autoRun';
import type { TrainingConfig } from '../src/training/autoRun';
import { loadParams, saveParams } from '../src/training/paramPersistence';

// 解析命令行参数
function parseArgs(): Partial<TrainingConfig> & { seed?: number } {
  const args = process.argv.slice(2);
  const config: Partial<TrainingConfig> & { seed?: number } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--games':
      case '--totalGames':
        config.totalGames = parseInt(next, 10);
        i++;
        break;
      case '--blocking':
        config.blocking = next === 'true';
        i++;
        break;
      case '--mode':
        config.mode = next as 'baseline' | 'mirror';
        i++;
        break;
      case '--batch':
      case '--batchSize':
        config.batchSize = parseInt(next, 10);
        i++;
        break;
      case '--rule':
      case '--ruleId':
        config.ruleId = next as 'chengdu' | 'placeholder';
        i++;
        break;
      case '--trainPlayer':
        config.trainPlayerId = next as 'P0' | 'P1' | 'P2' | 'P3';
        i++;
        break;
      case '--seed':
        config.seed = parseInt(next, 10);
        i++;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Mahjong AI Self-Play Training Script

Usage:
  npm run train [options]

Options:
  --games, --totalGames <number>   Number of games to train (default: 100)
  --blocking <boolean>             Use blocking mode for faster training (default: false)
  --mode <string>                  Training mode: 'baseline' or 'mirror' (default: baseline)
  --batch, --batchSize <number>    Batch size for parameter updates (default: 10)
  --rule, --ruleId <string>        Rule pack: 'chengdu' or 'placeholder' (default: chengdu)
  --trainPlayer <P0|P1|P2|P3>      Player to train (default: P0)
  --seed <number>                  Random seed for reproducibility
  --verbose                        Enable verbose logging
  --help                           Show this help message

Examples:
  npm run train -- --games 1000 --blocking true
  npm run train -- --games 500 --mode mirror --verbose
  npm run train -- --games 2000 --blocking true --batch 3

Training Modes:
  baseline - Train player uses candidate params, opponents use best params
  mirror   - All players use the same candidate params (self-play)

Output:
  - Training logs will be printed to console
  - Parameters will be saved to ./ai-params.json after each game
  - Best parameters are automatically tracked
`);
}

// 主函数
async function main(): Promise<void> {
  console.log('🎮 Mahjong AI Self-Play Training\n');

  // 解析参数
  const cliConfig = parseArgs();
  const config: TrainingConfig = {
    ...DEFAULT_TRAINING_CONFIG,
    ...cliConfig,
    blocking: cliConfig.blocking ?? true, // CLI 默认使用阻塞模式
  };

  console.log('Configuration:');
  console.log(`  Games: ${config.totalGames}`);
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Blocking: ${config.blocking}`);
  console.log(`  Batch Size: ${config.batchSize}`);
  console.log(`  Rule: ${config.ruleId}`);
  console.log(`  Train Player: ${config.trainPlayerId}`);
  console.log(`  Seed: ${cliConfig.seed ?? 'auto'}`);
  console.log(`  Verbose: ${config.verbose}`);
  console.log('');

  // 加载当前参数
  const paramsFile = loadParams();
  console.log(`📂 Loaded parameters from file (step: ${paramsFile.trainingState.currentStep})`);
  console.log(`   Best fitness: ${paramsFile.trainingState.bestFitness.toFixed(1)}`);
  console.log('');

  // 创建 orchestrator
  const orchestrator = new GameOrchestrator(
    chengduRulePack,
    undefined,
    gameStore,
    settingsStore,
    null
  );

  // 创建训练器
  const trainer = new AutoTrainer(
    orchestrator,
    config,
    (log) => {
      if (config.verbose) {
        console.log(JSON.stringify(log, null, 2));
      }
    },
    cliConfig.seed  // 传递 seed 参数
  );

  // 监听进度
  const progressInterval = setInterval(() => {
    const progress = trainer.getProgress();
    if (progress.isRunning) {
      const percentage = ((progress.currentGame / progress.totalGames) * 100).toFixed(1);
      process.stdout.write(
        `\r[${progress.currentGame}/${progress.totalGames}] ${percentage}% | ` +
        `Best: ${progress.bestFitness.toFixed(0)} | ` +
        `Current: ${progress.currentFitness.toFixed(0)} | ` +
        `Accept: ${(progress.acceptRate * 100).toFixed(1)}%`
      );
    }
  }, 1000);

  // 开始训练
  const startTime = Date.now();
  console.log('🚀 Starting training...\n');

  try {
    await trainer.start();
  } catch (error) {
    console.error('\n❌ Training failed:', error);
    clearInterval(progressInterval);
    process.exit(1);
  }

  clearInterval(progressInterval);

  // 训练完成
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n\n✅ Training completed!\n');
  console.log(`Duration: ${duration}s`);
  console.log(`Games per second: ${(config.totalGames / parseFloat(duration)).toFixed(2)}`);

  // 输出最终统计
  const finalParams = loadParams();
  console.log('\nFinal Statistics:');
  console.log(`  Total steps: ${finalParams.trainingState.currentStep}`);
  console.log(`  Best fitness: ${finalParams.trainingState.bestFitness.toFixed(1)}`);
  console.log(`  Parameters saved to: ./ai-params.json`);

  // 显示最优参数的关键变化
  if (finalParams.trainingState.lastResult) {
    console.log('\nLast Training Result:');
    console.log(`  Accepted: ${finalParams.trainingState.lastResult.accepted}`);
    console.log(`  Fitness: ${finalParams.trainingState.lastResult.fitness.toFixed(1)}`);
    console.log(`  Metrics:`, finalParams.trainingState.lastResult.metrics);
  }

  console.log('\n🎉 Training session complete!');
}

// 运行
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
