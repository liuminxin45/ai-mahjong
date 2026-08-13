# 系统设计文档 — S2 可解释 AI 决策

> 源码依据：`src/agents/{algo,PlayerAgent,HumanAgent}.ts`、`src/agents/algo/{shanten,danger,style,opponentModel,bloodBattleEV,expectedValue,policy_high,aiParams,difficulty,feature,neural}.ts`
> 设计原则：**AI 不黑箱**——所有决策由可解释启发式（向听/进张/危险度/风格/对手模型/血战 EV）计算得出，并把中间量写入 `globalThis.__aiDecision` 供 UI/日志/训练读取。**LLM 不在此层做决策**（见 S3）。

## ① 概述与目标
- 为 P1–P3（及可选 `p0IsAI`）提供「高水平且可解释」的成都麻将决策。
- 目标：① 单个合法动作内选出最优弃牌/碰杠/胡；② 输出可教学的中间推理（效率分、危险度、威胁、EV）供 S3/S5/S6 复用；③ 决策受 27 项 `AIParams` 调参控制，供 S4 训练优化。

## ② 核心机制 / 玩家动词
- **向听 / 进张**：`shantenWithMelds` + `ukeireTiles(WithMelds)`，带 `SHANTEN_CACHE`/`UKEIRE_CACHE`（上限 100k，`shanten.ts`）。
- **危险度** `evaluateTileDanger`（`danger.ts`）：生张/熟张基础分（3.0/1.5/-1.0）、相邻张未见加成、对手副露花色加成、尾局系数（≤8 张 ×1.35, ≤16 ×1.2, ≤24 ×1.1）、自副露减分；`DangerLevel` LOW<3.0 / MEDIUM<6.0 / HIGH≥6.0。
- **风格** `detectGameStyle` → AGGRESSIVE/BALANCED/DEFENSIVE/STALLING；`styleWeights`（攻 eff/dang：AGGRESSIVE 1.3/0.5、DEFENSIVE 0.7/6.0、STALLING 0.45/8.0、BALANCED 1.0/1.6，`style.ts`）。
- **对手模型** `createOpponentModel`：EMA(α=0.1) 维护每人 persona（aggression/defense/meldRate/efficiencyBias/riskTolerance），在 DISCARD/PENG/GANG/HU 事件上更新；`computeThreat` → LOW/MEDIUM/HIGH（阈值 0.3/0.55）；`findMostDangerousOpponent`（`opponentModel.ts`）。
- **血战 EV** `bloodBattleEV.ts`：`calcStage`（A 无人胡/B 他人胡我未胡/C 我已胡，B 且向听≥2 应防守）、`calcPwin/calcPlose/calcScore/calcLoss`、`calcDiscardEV`(=Pwin·Score − Plose·Loss，C 阶段防守)、`calcMeldEV`（含信息暴露惩罚）。
- **决策主路径** `decideHigh`（`policy_high.ts`）：效率分 `shantenGain*60 + ukeireTotal`；`totalScore = effWeight*eff − dangerWeight*danger − threatPenalty`；按风格/DEFENSIVE/STALLING 过滤候选；再按 `calcDiscardEV` 排序；杠/暗杠/加杠用 `calcMeldEV`；结果写入 `globalThis.__aiDecision`。
- **训练回退** `fastDiscardDecision`：仅向听+进张，忽略 27 参数（仅训练 `trainingMode` 用，`autoRun.ts:133-136` 明确**不得**用训练态跑训练，否则参数无效）。
- **难度路由** `policyForDifficulty('high') → decideHigh`（`difficulty.ts`，仅 `high` 实现）。
- **人类代理** `HumanAgent.awaitAction(legal, timeoutMs)`（Infinity=无超时），`dispatch(action)` 校验合法性（`HumanAgent.ts`）。

## ③ 系统依赖
- 上游：`core/model`、`S1 规则引擎`（读 `GameState`/`ChengduState` 字段）、`config/testConfig`。
- 下游：S6 编排（每步 `decide`）、S4 训练（参数被优化器改写）、S5 分析（`DecisionStat` 取自本层输出）。

## ④ 关键数据结构 / 状态
- `AIParams`（27 项，`aiParams.ts`）：`xiangtingBase, pimproveNStageA/B, stageFactorB, basePloseScale, stageFactorPloseB/C, genbutsuRiskScale, dingQueRiskScale, meldSuitRiskScale, turnRiskFactor, baseWinValue, speedBonusK, firstWinBonus, stageDiscountB, baseLoss, stageMultiplierA/B/C, oppNotHuMultiplier, oppMeldMultiplierK, gangSideEffectK, gangPenaltyBCMultiplier, informationPenaltyPeng/Gang A/B …`。`DEFAULT_PARAMS` + `PARAM_BOUNDS` 提供边界；模块单例 `getAIParams/setAIParams/resetAIParams`。
- `AgentDecisionContext = {style, opponentSnapshot?, metaParams?}`（`PlayerAgent.ts`）。
- `__aiDecision` 全局调试结构（efficiency/danger/EV/候选列表）。

## ⑤ 核心流程 / 算法
1. 编排层 `decideAction` → `pickAlgoAction` → `policyForDifficulty` → `decideHigh`。
2. `decideHigh`：`computeShantenFeature`（向听+进张 Top）→ 枚举候选弃牌 → 计算 `efficiencyScore` → 评估 `evaluateTileDanger` → `makeAgentStyleContext`/`opponentModel.getSnapshot` 得威胁 → `totalScore` 排序 → `calcDiscardEV` 终排 → 写 `__aiDecision`（`policy_high.ts`）。
3. 碰/杠/胡：同 `getLegalActions` 候选，用 `calcMeldEV`（`calcDiscardEV`）比较；暗杠/加杠仅当向听不恶化时接受。

## ⑥ 参数与平衡
- 效率权重 `shantenGain*60 + ukeireTotal`；危险/威胁为减项，权重由 `dangerWeight`/`threatWeight` 与风格联合决定。
- 全部 27 参数有 `PARAM_BOUNDS`，由 S4 `OnlineOptimizer` 在界内扰动。
- `metaStrategy.ts` 提供对局级元调整（over-aggression→+dangerWeight；over-defensive→+efficiencyWeight；threat-focus→+threatWeight），阈值见 `meta/metaStrategy.ts:78,106,140`；`matchManager.ts` 汇总胜/负/流率与风险分布。

## ⑦ 异常 / 边界处理
- 仅 `high` 难度有策略；若 `policyForDifficulty` 收到其它值回退 `decideHigh`（当前唯一实现）。
- 训练态 `fastDiscardDecision` 不读参数，确保自对弈训练**必须**用 `decideHigh`（`autoRun.ts` 注释）。
- 缓存上限防止 `shanten/ukeire` 内存膨胀（10 万条）。
- 对手模型对「已胡玩家」不计入威胁（`opponentModel.ts`）。

## ⑧ 验收标准
- [x] 给定合法动作集，AI 在选择弃牌时综合向听进展、进张、危险度、对手威胁。
- [x] 决策中间量（`__aiDecision`）可被 S5/S6 采集用于教学与统计。
- [x] 27 项参数可被 S4 优化器在 `PARAM_BOUNDS` 内改写并即时生效。
- [ ] **（CONCERN）** `decideHigh` 中残留大量 `console.log`（如 `index.ts:595-675` 自摸/暗杠调试输出），生产环境应降级；S4 训练通过 `testConfig.trainingMode` 关日志，但运行时 UI 仍可能打印。
- [ ] **（CONCERN）** 神经网络 `NeuralNetwork`（FEATURE_SIZE=167）**未被任何决策路径调用**，属实验性；`decideHigh` 即线上 AI，文档若提及「神经网络 AI」属误导。
