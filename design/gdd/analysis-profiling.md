# 系统设计文档 — S5 分析与玩家画像

> 源码依据：`src/analysis/{pedagogy,mistakePatterns,humanPersona,learningRoadmap,statistics,MoveAnalyzer,teachingVariants,abTesting,matchReport,LLMAnalyzer,HeuristicAnalyzer,populationMistakes,populationPersona}.ts`
> 目标：把对局数据转化为「玩家画像 + 失误模式 + 教学编排」，支撑 S3 教学表达与 S6 分析面板。

## ① 概述与目标
- 对单局/多局做**可解释的诊断**：推荐弃牌、手牌分析、失误检测、玩家风格与技术水平画像、个性化教学路线图、群体统计。
- 为 S3 提供 `LLMAnalyzer`（用 LLM 生成讲解/复盘/画像文本），为 S6 提供 `HeuristicAnalyzer`（确定性 Top3 弃牌推荐等面板数据）。

## ② 核心机制 / 玩家动词
- **启发式分析** `HeuristicAnalyzer`：`recommendDiscards`(Top3)、`analyzeHand`、`analyzeReactions`（确定性，不依赖 LLM）。
- **玩家画像** `humanPersona.ts`：`createHumanPersona` 用 EMA 估计 `riskTolerance/efficiencyBias/defenseAwareness`；`playStyle`=AGGRESSIVE/BALANCED/DEFENSIVE/ERRATIC；`learningStage`=BEGINNER/INTERMEDIATE/ADVANCED。
- **失误模式** `mistakePatterns.ts`：`detectMistakePatterns` 检测 greedy-efficiency(≥0.25)/late-game-no-defense(≥0.4)/early-meld(≥0.2)/style-swing(≥0.3) 四类，带频率阈值。
- **教学编排** `pedagogy.ts`：`buildTeachingPlan`（按 `learningStage` 调语气；`focusPoints` ≤2/3/4；BEGINNER 触发 `avoidOverload`）。
- **学习路线** `learningRoadmap.ts`：`buildLearningRoadmap`。
- **统计** `statistics.ts`：`DecisionStat`（style/dangerLevel/shantenBefore/After/topThreat/opponentPersonas）、`MatchStat`、`MatchResult`；单例采集，S6 每步 `recordDecisionStat`。
- **LLM 分析器** `LLMAnalyzer`：`explainDecision/chat/chatStream/summarizeMatch/summarizeMatchReport/explainForHuman/summarizePopulationInsights`。
- **群体** `populationMistakes.ts`（`analyzePopulationMistakes`，按 prevalence 定 severity）、`populationPersona.ts`（`buildPopulationPersona`，`sampleSize≥5` 判稳定）。
- **A/B 变体** `teachingVariants.ts`（TEACHING_VARIANTS A/B/C）+ `abTesting.ts`（`evaluateTeachingVariants`）。

## ③ 系统依赖
- 上游：`core/model`、`S1`（读 `ChengduState`）、`S2`（消费 `DecisionStat`、对手模型）、`llm/*`（`LLMAnalyzer`）。
- 下游：S3（画像/复盘 prompt 消费）、S6（`GameReviewPanel/UserProfilePanel/GameHistoryPanel/AIParamsPanel` UI 组件）。

## ④ 关键数据结构 / 状态
- `DecisionStat`（`statistics.ts`）：每步决策快照。
- `HumanPersona`：`{riskTolerance, efficiencyBias, defenseAwareness, playStyle, learningStage}`。
- `MistakePattern`：`{type, frequency, ...}`。
- `TeachingPlan`：`{tone, focusPoints[], ...}`。
- `MatchResult`：`{rounds: MatchStat[], summary}`（`meta/matchManager.ts` 产出）。

## ⑤ 核心流程 / 算法
1. 对局中 S6 每步 `recordDecisionStat`（S2 输出）→ `statistics` 累积。
2. 对局结束 → `matchReport.generateMatchReport(MatchResult, MetaAdjustment[])`。
3. 画像：聚合 `humanPersona` + `mistakePatterns` → `pedagogy.buildTeachingPlan`（分级聚焦）。
4. LLM 增强：`LLMAnalyzer` 将结构化数据转为自然语言（复盘/画像/群体洞察）。
5. 群体：多局 `populationMistakes`/`populationPersona` 给出跨玩家统计（样本≥5 才稳定）。

## ⑥ 参数与平衡
- 失误阈值：greedy 0.25 / late-defense 0.4 / early-meld 0.2 / style-swing 0.3（`mistakePatterns.ts`）。
- 教学聚焦点数：BEGINNER≤2、INTERMEDIATE≤3、ADVANCED≤4（`pedagogy.ts`）。
- 群体稳定样本：`sampleSize≥5`（`populationPersona.ts`）。

## ⑦ 异常 / 边界处理
- `MoveAnalyzer.analyze` 为 **stub**，恒返回 `null`（`MoveAnalyzer.ts`）——单步深度分析未实现。
- `HistoryStorage.calculateStatsForAnalysis` 中 `commonMistakes` 为 TODO 空（`llm/HistoryStorage.ts`）——画像的「常见失误」聚合尚未落地。
- 小样本群体统计标为不稳定（不输出强结论）。
- LLM 分析失败回退到 `HeuristicAnalyzer` 确定性输出。

## ⑧ 验收标准
- [x] `HeuristicAnalyzer` 能给出确定性 Top3 弃牌推荐与手牌分析（UI 可用）。
- [x] `humanPersona`/`mistakePatterns`/`pedagogy` 能产出分级画像与教学聚焦。
- [x] `statistics` 每步决策采集并在终局汇总 `MatchResult`。
- [x] `LLMAnalyzer` 提供 LLM 自然语言复盘/画像（依赖 S3）。
- [ ] **（CONCERN）** `MoveAnalyzer.analyze` 是 stub（返回 null），若文档/UI 声称「单步决策深度解析」需补实现或下调表述。
- [ ] **（CONCERN）** `A/B 教学变体`（teachingVariants + abTesting）已实现但无 UI/编排调用，未形成闭环。
- [ ] **（CONCERN）** 群体画像的 `commonMistakes` 聚合为 TODO，跨玩家洞察不完整。
