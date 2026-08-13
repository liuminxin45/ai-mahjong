# neo-mahjong — 系统设计文档（GDD）总索引

> 反向梳理（Reverse-engineering GDD）· 项目：成都麻将 AI 教学平台 · 引擎：Vite + TypeScript + PixiJS · 平台：Web / Vercel
> 评审强度：**full**。所有结论均可回溯到 `src/` 或现有 `*.md`；未实现/仅有文档设想的功能均明确标注，不伪造成已实现。

## 0. 文档地图

| 文件 | 内容 | 状态 |
|---|---|---|
| `design/gdd/INDEX.md` | 本文件：系统全景、清单、依赖 DAG、范围分层 | — |
| `design/gdd/rule-engine.md` | 规则引擎（RulePack / chengdu 包） | 已实现（含骨架标记） |
| `design/gdd/explainable-ai.md` | 可解释 AI 决策 | 已实现（high 难度主路径） |
| `design/gdd/llm-teaching-layer.md` | LLM 教学表达层 | 已实现（可选开关） |
| `design/gdd/training-system.md` | 训练系统（自对弈 / 在线学习 / 参数持久化） | 部分实现（见 CONCERNS） |
| `design/gdd/analysis-profiling.md` | 分析与玩家画像 | 已实现（含 stub） |
| `design/gdd/match-orchestration-ui.md` | 对局编排与 UI 流程 | 已实现 |
| `design/gdd/REVIEW.md` | 跨 GDD 一致性检查 + 设计理论评审 | full 强度 |

## 1. 系统全景图

```
                        ┌─────────────────────┐
                        │   core/model（基础） │  Tile/State/Action/Event/PlayerId
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   规则引擎 RulePack   │  chengdu 包（换三张/定缺/血战/番型/结算）
                        └──────────┬──────────┘
                                   │
            ┌──────────────────────▼───────────────────────┐
            │            可解释 AI 决策（agents/algo）        │  shanten/ukeire/danger/style/
            │                                              │  opponentModel/bloodBattleEV/policy
            └───┬──────────────────────┬───────────────────┘
                │                      │
   ┌────────────▼───────┐   ┌──────────▼──────────┐   ┌────────────────┐
   │  LLM 教学表达层     │   │  分析 & 玩家画像     │   │  训练系统        │
   │  (llm/* + 策略知识库)│   │  (analysis/*)       │   │  (training/*)   │
   └────────────┬───────┘   └──────────┬──────────┘   └───────┬────────┘
                │                      │                      │
                └──────────────┬───────┴──────────────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │   对局编排 & UI 流程        │  GameOrchestrator + ui/* + store/*
                  │  (orchestration + 渲染)    │  + persistence/*（回放/历史）
                  └───────────────────────────┘
```

## 2. 系统清单（含核心模块映射）

| # | 系统 | 关键源码 | 对外动词 / 能力 |
|---|---|---|---|
| F0 | 核心模型（共享基础） | `src/core/model/{types,tile,state,action,event}.ts` | 牌、状态、动作、事件的不可变数据结构 |
| S1 | 规则引擎 | `src/core/rules/{RulePack,RuleRegistry,validation}` + `src/core/rules/packs/chengdu/*` | 合法动作枚举、状态迁移、番型判定、血战结算 |
| S2 | 可解释 AI 决策 | `src/agents/{algo,PlayerAgent,HumanAgent}` | 向听/进张、危险度、风格、对手模型、血战 EV、出牌/碰杠胡决策 |
| S3 | LLM 教学表达层 | `src/llm/*` + `docs/strategy/*` | 实时辅导、换张/定缺建议、复盘、画像、问答（仅表达，不决策） |
| S4 | 训练系统 | `src/training/*` + `src/meta/metaStrategy.ts` | 自对弈调参、在线学习、参数持久化 |
| S5 | 分析与玩家画像 | `src/analysis/*` | 失误检测、教学编排、画像、A/B 变体、群体统计 |
| S6 | 对局编排与 UI 流程 | `src/orchestration/GameOrchestrator.ts` + `src/ui/*` + `src/store/*` + `src/persistence/*` | 游戏主循环、人工/AI 调度、TABLE/DEBUG 渲染、回放、历史 |

## 3. 依赖排序（DAG，拓扑序）

> 边的含义：`A → B` 表示「A 依赖 B / B 是 A 的前置」。

1. **core/model (F0)** — 无前置。
2. **S1 规则引擎** → `core/model`
3. **S2 可解释 AI 决策** → `core/model`, `S1`
4. **S3 LLM 教学表达层** → `core/model`, `S1`, `docs/strategy/*`, `S5`（画像消费 LLM 分析器）
5. **S5 分析与玩家画像** → `core/model`, `S1`, `S2`
6. **S4 训练系统** → `core/model`, `S1`, `S2`, `S6`（自对弈复用 Orchestrator 跑局）
7. **S6 对局编排与 UI 流程** → 全部上游（S1/S2/S3/S4/S5）

入度为 0 的根：仅 `core/model`。训练系统(S4)与编排层(S6)存在双向耦合（AutoTrainer 实例化 `GameOrchestrator` 跑局），属「运行期复用」而非编译期循环，DAG 仍可拓扑排序。

## 4. 范围分层（MVP / 扩展）

### MVP — 已随代码交付（可运行、可部署）
- **规则引擎（S1）**：`EXCHANGE → DING_QUE → PLAYING → END` 四阶段；换三张、定缺、碰/明杠/暗杠/加杠、点炮胡/自摸、杠上开花、抢杠胡、海底捞月、一炮多响、过水不能胡、血战到底（3 家胡或牌墙空结束）、查花猪 + 查叫流局结算、刮风下雨杠钱（`index.ts` 全量实现）。
- **可解释 AI（S2）**：`high` 难度 `decideHigh`（向听+进张效率、危险度、风格、对手模型、血战 EV）；训练态回退 `fastDiscardDecision`；参数体系 `AIParams` 27 项可调。
- **编排与 UI（S6）**：TABLE / DEBUG 双模式；home/settings/match/replay 四页；人类 P0 + AI(P1–P3)，`p0IsAI` 开关；出牌校验器；决策统计采集；回放导出；IndexedDB 对局历史。
- **分析（S5）**：`HeuristicAnalyzer`（弃牌推荐 Top3、手牌分析）、`statistics`、`humanPersona`、`pedagogy`、`mistakePatterns`、`matchReport`、`populationMistakes`、`populationPersona`、`LLMAnalyzer`。
- **LLM 教学层（S3）**：`buildCoachingPrompt`/`buildExchangePrompt`/`buildDingQuePrompt`/`buildReviewPrompt`/`buildProfilePrompt`/`buildQAPrompt`；多供应商 `LLMService`（openai/anthropic/deepseek/custom，Kimi 默认）；浏览器代理至 Vercel serverless；`llmEnabled` 开关门控；分层策略知识库 `docs/strategy/*`（Vite `?raw` 内联）。
- **训练（S4 子集）**：`AutoTrainer` 自对弈（mirror 实际生效）、`OnlineOptimizer`（随机爬山 + 模拟退火）、`paramPersistence`（localStorage / 原子写文件）、在线学习（P1–P3 集体表现驱动参数增量）。

### 扩展 / 文档设想但未接线 — REVIEW 中标记为 CONCERNS/FAIL
- **训练 `baseline` 模式**：`autoRun.ts` 注释自承「当前实现：所有玩家共享同一套参数（等效于 mirror）」，baseline（对手用 best 参数、训练者用候选参数）未真正实现。
- **神经网络训练**：`neuralTrainer.ts` 的 `updateWeights` 为「随机扰动」示意，非真实反向传播；`NeuralNetwork` 未被任何决策路径调用（实验性）。
- **LLM 设想功能未接线**：`buildCommentaryPrompt`（解说）、`buildOpponentPredictionPrompt`（对手预测）无 UI 消费方；`LLM-Features-Design.md` 中的 LearningPath、社交分享、语音、心理辅导均仅文档。
- **A/B 教学变体**：`teachingVariants.ts` + `abTesting.ts` 存在但无 UI 调用。
- **`MoveAnalyzer.analyze` 为 stub**（恒返回 `null`）。
- **`HUN_YI_SE`（混一色）**：在 `YakuType` 中声明，但 `detectYaku` 无对应加分分支（未计分）。
- **`MEN_QING`（门清）**：未在 `patterns.ts` 计分实现；`CHENGDU_RULES_COMPLETE.md` 已更正为「尚未实现为番型」；`PromptBuilder` 辅导文案仍写「门清+1番」（src 侧待 engineering-lead 修复）。

## 5. 红线与已知风险（预告，详见 REVIEW.md）
- **文档漂移（高）**：同一番型在 `patterns.ts`、`CHENGDU_RULES_COMPLETE.md`、`CHENGDU_MISSING_FEATURES.md`、`PromptBuilder` 中数值互不一致（如清一色 2 / 6 / 6 / 3 番）。
- **规则包版本标记**：`rule.config.ts` 版本为 `'0.1.0-skeleton'`，提示骨架状态。

---
*反向梳理时间：基于仓库当前源码快照（无 git 版本约束）。所有文件路径相对仓库根。*
