# 🎮 麻将 AI 自我对局训练系统

## ✅ 完整实现总结

本系统已完成**全自动自我对局调参系统**，支持在线参数优化、持久化存储和完整的 UI/CLI 控制。

---

## 📦 已完成的功能

### 1. ✅ 参数化系统
- **文件**: `src/agents/algo/aiParams.ts`
- **参数数量**: 47 个可调参数
- **覆盖模块**: P(win), P(lose), Score, Loss, 信息惩罚
- **API**: `getAIParams()`, `setAIParams()`, `resetAIParams()`

### 2. ✅ 参数持久化
- **文件**: `src/training/paramPersistence.ts`
- **存储位置**: `./ai-params.json` (Node.js) 或 localStorage (浏览器)
- **原子写入**: 使用临时文件 + rename 保证数据安全
- **版本管理**: 包含 version, params, trainingState, updatedAt

### 3. ✅ 训练指标系统
- **文件**: `src/training/metrics.ts`
- **指标**: 净收益、首胡、放炮、Stage B/C 放炮、平均 EV、速度
- **Fitness 函数**: 多目标加权优化

### 4. ✅ 在线优化器
- **文件**: `src/training/optimizer.ts`
- **算法**: 随机爬山 + 模拟退火
- **特性**: 可重现随机数、温度衰减、参数边界约束

### 5. ✅ 自动跑局系统
- **文件**: `src/training/autoRun.ts`
- **模式**: 阻塞/非阻塞两种
- **流程**: 加载参数 → 生成候选 → 运行游戏 → 提取指标 → 更新参数 → 保存

### 6. ✅ CLI 训练脚本
- **文件**: `scripts/train-selfplay.ts`
- **命令**: `npm run train`
- **参数**: --games, --blocking, --mode, --batch, --seed, --verbose

### 7. ✅ UI 训练控制面板
- **位置**: 设置页面
- **功能**: 训练局数、阻塞模式、详细日志、进度条、实时统计
- **国际化**: 完整的中英文支持

---

## 🚀 使用方法

### 方式 1：浏览器 UI 训练

1. 启动开发服务器：
```bash
npm run dev
```

2. 打开浏览器访问 `http://localhost:5173`

3. 点击"设置" → 滚动到"训练状态"区域

4. 配置训练参数：
   - **训练局数**: 1-10000（建议从 100 开始）
   - **阻塞模式**: 关闭（UI 友好）
   - **详细日志**: 可选

5. 点击"开始训练"

6. 观察实时进度：
   - 进度条显示完成百分比
   - 最佳适应度、当前适应度、接受率

7. 训练完成后，参数自动保存到 localStorage

### 方式 2：CLI 训练（推荐用于大规模训练）

```bash
# 基础训练（100 局）
npm run train

# 快速训练（1000 局，阻塞模式）
npm run train -- --games 1000 --blocking true

# 详细训练（500 局，详细日志）
npm run train -- --games 500 --verbose

# 镜像自博弈（所有玩家用同一参数）
npm run train -- --games 2000 --mode mirror --blocking true

# 查看帮助
npm run train -- --help
```

**CLI 参数说明**：
- `--games <number>`: 训练局数（默认 100）
- `--blocking <boolean>`: 阻塞模式，更快但会卡 UI（默认 true）
- `--mode <baseline|mirror>`: 训练模式（默认 baseline）
- `--batch <number>`: 批次大小（默认 1）
- `--seed <number>`: 随机种子，用于可重现训练
- `--verbose`: 启用详细日志

**训练模式**：
- **baseline**: 训练玩家用候选参数，对手用最佳参数（更稳定）
- **mirror**: 所有玩家用同一候选参数（自博弈）

---

## 📊 训练效果预期

### 短期（100-500 局）
- ✅ 参数开始收敛
- ✅ Fitness 曲线上升
- ✅ 接受率稳定在 30-50%

### 中期（500-2000 局）
- ✅ `basePloseScale` 优化（减少放炮）
- ✅ `stageFactorB` 调整（Stage B 更谨慎）
- ✅ 放炮率下降 10-15%

### 长期（2000+ 局）
- ✅ 首胡率提升 5-10%
- ✅ Stage B 放炮率显著下降
- ✅ 平均 EV 提升
- ✅ 参数收敛到局部最优

---

## 📁 文件结构

```
src/
├── agents/algo/
│   ├── aiParams.ts              # 参数配置系统
│   └── bloodBattleEV.ts         # 参数化的 EV 计算（已集成）
├── training/
│   ├── paramPersistence.ts      # 参数持久化
│   ├── metrics.ts               # 训练指标
│   ├── optimizer.ts             # 在线优化器
│   └── autoRun.ts               # 自动跑局系统
├── i18n/
│   └── translations.ts          # 国际化翻译（含训练相关）
└── ui/pages/
    └── settings.ts              # 设置页面（含训练控制）

scripts/
└── train-selfplay.ts            # CLI 训练脚本

ai-params.json                   # 参数存储文件（自动生成）
```

---

## 🔧 参数说明

### P(win) 相关
- `xiangtingBase`: 向听数基础系数（0.2-0.5）
- `pimproveNStageA/B`: Stage A/B 进张次数（4-8 / 2-6）
- `stageFactorB`: Stage B 胜率折扣（0.4-0.8）

### P(lose) 相关
- `basePloseScale`: 基础放炮概率系数（0.1-0.5）
- `stageFactorPloseB/C`: Stage B/C 放炮系数（1.0-2.0 / 2.0-4.0）
- `gangSideEffectK`: 杠副作用系数（0.1-0.4）

### Score 相关
- `baseWinValue`: 基础胜利价值（500-1500）
- `speedBonusK`: 速度奖励系数（100-300）
- `firstWinBonus`: 先胡奖励（300-700）

### Loss 相关
- `baseLoss`: 基础损失（1000-2000）
- `stageMultiplierA/B/C`: Stage A/B/C 损失系数

### 信息惩罚
- `informationPenaltyPengA/B`: 碰惩罚（50-150 / 100-250）
- `informationPenaltyGangA/B`: 杠惩罚（50-150 / 150-300）

---

## 📈 监控训练进度

### 浏览器控制台
```javascript
// 查看当前参数
import { getAIParams } from './src/agents/algo/aiParams';
console.log(getAIParams());

// 查看训练状态
import { loadParams } from './src/training/paramPersistence';
const state = loadParams();
console.log('Step:', state.trainingState.currentStep);
console.log('Best Fitness:', state.trainingState.bestFitness);
```

### CLI 输出
训练过程中会实时显示：
```
[1/1000] 1.0% | Best: 1234 | Current: 1180 | Accept: 45.2%
[2/1000] 2.0% | Best: 1234 | Current: 1205 | Accept: 46.1%
...
```

### 日志文件
详细日志会输出到控制台（使用 `--verbose`）：
```json
{
  "phase": "train",
  "step": 42,
  "accepted": true,
  "fitness": { "current": 1234, "candidate": 1250, "delta": 16 },
  "metrics": { "result": "WIN", "isFirstHu": true, "dealInCount": 0 },
  "changedParams": [
    { "key": "basePloseScale", "from": "0.30", "to": "0.27" }
  ]
}
```

---

## ⚠️ 注意事项

### 1. 训练环境
- **浏览器训练**: 适合小规模测试（<500 局），参数存储在 localStorage
- **CLI 训练**: 适合大规模训练（>500 局），参数存储在文件系统

### 2. 阻塞模式
- **阻塞模式 ON**: 最快，但会卡住 UI，适合 CLI
- **阻塞模式 OFF**: 稍慢，但 UI 响应，适合浏览器

### 3. 参数备份
训练前建议备份 `ai-params.json`：
```bash
cp ai-params.json ai-params.backup.json
```

### 4. 重置参数
如果训练结果不理想，可以重置：
```javascript
import { resetParams } from './src/training/paramPersistence';
resetParams();
```

---

## 🎯 最佳实践

### 1. 渐进式训练
```bash
# 第一阶段：快速探索（100 局）
npm run train -- --games 100 --blocking true

# 第二阶段：精细调优（500 局）
npm run train -- --games 500 --blocking true

# 第三阶段：长期优化（2000 局）
npm run train -- --games 2000 --blocking true
```

### 2. 对比实验
```bash
# 训练前记录基准
cp ai-params.json baseline.json

# 训练
npm run train -- --games 1000 --blocking true

# 对比结果
# 手动对比 baseline.json 和 ai-params.json
```

### 3. 多次运行
```bash
# 使用不同种子运行多次，选择最佳结果
npm run train -- --games 500 --seed 12345
npm run train -- --games 500 --seed 67890
npm run train -- --games 500 --seed 11111
```

---

## 🐛 故障排除

### 问题 1: 训练无法启动
**解决**: 确保已安装依赖 `npm install tsx --save-dev`

### 问题 2: 参数文件损坏
**解决**: 删除 `ai-params.json`，系统会自动使用默认参数

### 问题 3: Fitness 不上升
**解决**: 
- 增加训练局数
- 调整 mutation scale
- 尝试不同的随机种子

### 问题 4: UI 卡顿
**解决**: 关闭阻塞模式或使用 CLI 训练

---

## 📝 开发者指南

### 添加新参数
1. 在 `aiParams.ts` 中添加参数定义
2. 在 `PARAM_BOUNDS` 中设置边界
3. 在 `bloodBattleEV.ts` 中使用参数
4. 重新训练

### 自定义 Fitness 函数
编辑 `src/training/metrics.ts` 中的 `calculateFitness()` 函数。

### 修改优化算法
编辑 `src/training/optimizer.ts` 中的 `OnlineOptimizer` 类。

---

## 🎉 总结

你现在拥有一个**完整的自我对局训练系统**：

✅ **全自动**: 无需人工干预，自动跑局、更新、保存  
✅ **持久化**: 每局结束立即保存，下一局立即生效  
✅ **双模式**: CLI（快速）+ UI（友好）  
✅ **国际化**: 完整的中英文支持  
✅ **可监控**: 实时进度、详细日志、统计数据  
✅ **可扩展**: 易于添加新参数、新指标、新算法  

**开始训练吧！** 🚀

```bash
npm run train -- --games 1000 --blocking true
```
