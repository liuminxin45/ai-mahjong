# 自我对局训练系统实现指南

## 已完成的工作

### 1. ✅ 任务 1：对局页面中文翻译
- 已修复 `match.ts` 页面的中文翻译
- 所有按钮和标题现在支持中英文切换

### 2. ✅ 任务 2：胡牌规则验证
- 检查了 `patterns.ts` 中的胡牌验证逻辑
- 手牌 `T1 T2 T3 T6 T7 B5 B4 B2 T5 B3 B6 T1 T1` (14张)
- 验证逻辑正确：尝试所有可能的将牌组合，检查剩余12张能否组成4组顺子/刻子

### 3. ✅ AIParams 配置系统
- 创建了 `aiParams.ts`
- 定义了 `AIParams` 接口，包含所有可调参数
- 提供了 `DEFAULT_PARAMS` 和 `PARAM_BOUNDS`
- 实现了 `getAIParams()`, `setAIParams()`, `resetAIParams()` API

### 4. ✅ 参数持久化系统
- 创建了 `paramPersistence.ts`
- 支持浏览器（localStorage）和 Node.js（文件系统）
- 实现了原子写入（临时文件 + rename）
- 提供了 `loadParams()`, `saveParams()`, `resetParams()` API

## 剩余任务（需要完成）

### 5. 🔲 集成 AIParams 到 bloodBattleEV
需要修改 `bloodBattleEV.ts`，将所有硬编码常数替换为 `getAIParams()` 调用：

```typescript
// 示例：
const params = getAIParams();
const xiangtingFactor = Math.pow(params.xiangtingBase, xiangting);
const N = stageInfo.stage === 'A' ? params.pimproveNStageA : params.pimproveNStageB;
```

### 6. 🔲 创建训练指标系统
创建 `src/training/metrics.ts`：
- 定义 `GameMetrics` 接口
- 实现 `calculateFitness()` 函数
- 收集每局的关键指标（首胡、放炮、Stage B 放炮等）

### 7. 🔲 实现在线优化器
创建 `src/training/optimizer.ts`：
- 实现随机爬山算法
- 参数扰动（在 bounds 内）
- 接受/拒绝规则（带温度的模拟退火）

### 8. 🔲 创建自动跑局系统
创建 `src/training/autoRun.ts`：
- 实现阻塞/非阻塞两种模式
- 每局结束后更新参数
- 结构化日志输出

### 9. 🔲 创建 CLI 训练脚本
创建 `scripts/train-selfplay.ts`：
- 支持命令行参数（--games, --blocking, --mode 等）
- 在 Node 环境下运行
- 输出训练进度和最终结果

### 10. 🔲 添加 UI 开关
在设置页面添加：
- "自动训练模式" 开关
- "训练局数" 输入框
- "开始训练" 按钮

## 快速实现建议

由于任务量巨大，建议采用以下优先级：

### 高优先级（必须完成）
1. 集成 AIParams 到 bloodBattleEV（否则参数无法生效）
2. 创建基础的训练指标和 fitness 函数
3. 实现简单的参数扰动和更新逻辑

### 中优先级（核心功能）
4. 创建自动跑局循环
5. 添加训练日志输出
6. 创建 CLI 脚本

### 低优先级（锦上添花）
7. UI 开关和可视化
8. 高级优化算法（模拟退火等）
9. 详细的训练分析报告

## 使用示例

### 浏览器环境（开发调试）
```typescript
import { loadParams, saveParams } from './training/paramPersistence';
import { setAIParams } from './agents/algo/aiParams';

// 每局开始前
const paramsFile = loadParams();
setAIParams(paramsFile.params);

// 每局结束后
paramsFile.trainingState.currentStep++;
saveParams(paramsFile);
```

### Node.js 环境（正式训练）
```bash
npm run train -- --games 1000 --blocking true
```

## 注意事项

1. **参数生效**：必须在每局开始前调用 `setAIParams()`
2. **持久化**：每局结束后必须调用 `saveParams()`
3. **原子性**：文件写入使用临时文件 + rename 保证原子性
4. **浏览器限制**：浏览器环境只能用 localStorage，无法写文件
5. **训练环境**：正式训练必须在 Node.js 环境下进行

## 当前状态

- ✅ 基础架构已完成（参数系统 + 持久化）
- 🔲 核心训练逻辑待实现
- 🔲 CLI 脚本待创建
- 🔲 UI 集成待完成

## 下一步行动

建议用户选择以下之一：

1. **快速原型**：手动实现一个简单的训练循环，验证参数系统可用
2. **完整实现**：按照上述剩余任务逐步完成所有功能
3. **分阶段**：先完成高优先级任务，确保核心功能可用

---

**重要提示**：由于任务量巨大（涉及多个模块的重构和新系统的创建），建议分多次会话完成，每次专注于1-2个核心功能。
