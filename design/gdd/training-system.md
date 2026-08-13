# 系统设计文档 — S4 训练系统

> 源码依据：`src/training/{autoRun,gameWorker,metrics,neuralTrainer,onlineLearning,optimizer,parallelAutoRun,parallelTrainer,paramPersistence,workerPool}.ts`、`src/meta/{metaStrategy,matchManager}.ts`、`src/agents/algo/aiParams.ts`、`src/config/testConfig.ts`
> 目标：用自对弈 + 在线学习持续优化 S2 的 27 项 `AIParams`，并在人类对局中增量微调。

## ① 概述与目标
- **离线自对弈**：`AutoTrainer` 驱动 `GameOrchestrator` 跑大量 AI vs AI 对局，用 `OnlineOptimizer`（随机爬山 + 模拟退火）搜索更优 `AIParams`，经 `paramPersistence` 持久化 `bestParams`。
- **在线学习**：人类对局中观察 P1–P3 集体表现，以「增量（delta）」形式微调 AI 参数，叠加在训练参数之上（`onlineLearning.ts`）。
- **元策略**：对局级 `metaStrategy` 对 efficiency/danger/threat 权重做粗调。

## ② 核心机制 / 玩家动词
- `AutoTrainer.start()`：自动开 `p0IsAI=true`；**显式不**设 `trainingMode=true`（否则走 `fastDiscardDecision` 忽略参数，`autoRun.ts:133-136`）；阻塞/非阻塞两模式。
- 每局：生成候选参数 → `setAIParams` → `startNewMatch` → 等结束 → `extractMetrics` → 入批 → `finishBatch` 调 `optimizer.update` → `saveParams`。
- `OnlineOptimizer`：`mutateParams`（界内随机扰动，每次变 2–5 参）、`update`（更好则接受；更差按 `exp(Δ/T)` 模拟退火接受；温度线性衰减至 0.1，`optimizer.ts:176-239`）。
- `calculateFitness`（`metrics.ts`）：净收益 + 首胡奖励(300) − 放炮惩罚(80) − B/C 阶段放炮额外(−40/−100) + 速度奖励 + 无放炮流局(+50)；`drawPenalty=0`（流局中性）。
- `onlineLearning`：按 P1–P3 集体胜率/排名/均分四策略调参（胜率低→加攻；排名靠后→加守；表现好→小幅探索），增量上限 20% 参数范围，存 `localStorage:'ai-params-online-deltas'` + `ai-params.json`（`onlineLearning.ts`）。
- `paramPersistence`：浏览器用 `localStorage:'ai-params'`，Node 用原子写 `ai-params.json.tmp`→`rename`；含 `version/trainingState(bestParams,bestFitness,currentStep,...)`。

## ③ 系统依赖
- 上游：`S1 规则引擎`、`S2 可解释 AI`（参数被改写）、`config/testConfig`、`store/settingsStore`。
- 下游/复用：S6 编排（`AutoTrainer` 直接 `new GameOrchestrator` 跑局；`GameOrchestrator.startNewMatch` 加载 `bestParams` + 在线增量）。
- 并行基础设施：`workerPool`/`gameWorker`/`parallelAutoRun`/`parallelTrainer` 为 Web Worker 并行跑局版本（`src/training/parallel*`）。
- 元层：`meta/metaStrategy.ts`、`meta/matchManager.ts`（对局汇总，供在线学习参考）。

## ④ 关键数据结构 / 状态
- `TrainingConfig`：`totalGames/blocking/mode('baseline'|'mirror')/batchSize/ruleId/trainPlayerId/verbose`（`autoRun.ts:19-37`）。
- `ParamsFile`：`{version, params, trainingState, updatedAt}`。
- `GameMetrics`：`result/finalScore/didWin/isFirstHu/dealInCount/stageB,CDealIn/avgEV/totalTurns/xiangting/meldCount`（`metrics.ts:9-32`）。
- `LearningState`：增量 `paramDeltas`、近 60 局结果（`onlineLearning.ts:43-59`）。

## ⑤ 核心流程 / 算法
1. 离线：`AutoTrainer.runSingleGame` → `optimizer.generateCandidate` → `setAIParams` → `startNewMatch(ruleId)` → 覆盖参数（因 `startNewMatch` 会从文件重载）→ 等比种子 `(step*1e5 + batchIdx*1e6+3)` 保证可复现 → 等 `phase==='END'` → `extractMetrics` → 批满则 `optimizer.update` 接受/退火 → `saveParams`。
2. 在线：人类对局结束 → `recordGameResult` → `updateParamsFromResults` → 累积 delta → `applyDeltas` → 存 localStorage/json；下次开局 `loadOnlineLearnedParams` 叠加。
3. 恢复：`loadParams` 读 `trainingState.currentStep>0` 时 `optimizer.setState` 续训（`autoRun.ts:88-103`）。

## ⑥ 参数与平衡
- 变异：`mutationRate=0.6, mutationScale=0.15, min/maxMutations=2/5`（`optimizer.ts:30-35`）。
- 退火：温度 `max(0.1, 1.0 - step*0.0018)`，约 500 步降至 0.1。
- Fitness 权重见 §②（首胡 300、B/C 放炮 −40/−100、输局 −150、无放炮流局 +50）。
- 在线学习：`learningRate=0.02, maxDelta=0.05`，增量上限 20% 参数范围。

## ⑦ 异常 / 边界处理
- 训练**必须** `trainingMode=false` 否则参数无效（`autoRun.ts` 注释与 `finally` 恢复）。
- 参数越界：`mutateParams`/`applyDeltas` 均 `clamp` 到 `PARAM_BOUNDS`。
- 持久化失败：原子写失败 `catch` 不抛；localStorage 不可用回退内存/文件。
- 等待结束：`waitForGameEnd` 轮询 `phase==='END' || !isRunning`（1ms 间隔）。

## ⑧ 验收标准
- [x] 自对弈能产出并持久化 `bestParams`，且可被 `GameOrchestrator` 开局加载（线上 AI 随之变强）。
- [x] 在线学习在人类对局中按集体表现增量调参并叠加。
- [x] 参数在 `PARAM_BOUNDS` 内，可复现（种子注入），支持断点续训。
- [x] **（文档侧已解决）** `TrainingConfig.mode='baseline'` 名义存在，但 `autoRun.ts:233-234` 自承「所有玩家共享同一套参数（等效于 mirror）」——baseline 未独立实现；`README.md` / `README_TRAINING.md` 已更正为「baseline ≈ mirror（未独立实现）」。src `autoRun.ts` 真实实现属 engineering-lead 范围。
- [x] **（文档侧已解决）** 神经网络训练 `neuralTrainer.ts` 的 `updateWeights` 为随机扰动示意（非真实反向传播）；`NeuralNetwork` 未被任何决策路径使用（实验性）。`README.md` 已注明「神经网络实验性、未接入决策路径」，删除「神经网络 AI」「智能训练」等误导性表述；若需真正接入属 engineering-lead 范围。
- [ ] **（CONCERN）** `extractMetrics.xiangting` 用 `hand.length` 占位（TODO：`metrics.ts:155`），训练信号中真实向听缺失，影响 fitness 质量。
- [ ] **（CONCERN）** `parallelAutoRun/parallelTrainer/workerPool` 为并行版，需确认其是否与主 `AutoTrainer` 共用同一 `ai-params.json` 避免并发写损坏（原子写缓解但多 worker 竞争未在本梳理中核验）。
