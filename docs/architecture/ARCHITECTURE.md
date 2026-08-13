# neo-mahjong 技术架构文档（反向梳理）

> 文档性质：基于现有 `src/` 代码**反向**梳理，结论均可溯源到具体文件与行号（见各节「依据」）。本仓库已可运行、可部署（Vite 构建 + Vercel 部署 + Vitest 单测全绿）。
>
> 评审强度：**full**；配套文档：`ADR-001..004.md`（决策记录）、`REVIEW.md`（架构评审与控制清单）。
>
> 技术栈：Vite 6 + TypeScript 5（strict）+ PixiJS 8（依赖已引入，见 ADR-002）+ Vitest 2 + Vercel Serverless API 代理 + pnpm 9。

---

## 1. 总览

neo-mahjong 是一个**成都麻将（血战到底）AI 教学平台**：玩家（P0）对战 3 个由期望值/EV 算法驱动的 AI（P1–P3），并辅以 LLM 教练、出牌分析、对局复盘、玩家画像与自对弈训练系统。

代码以**纯函数式核心 + 响应式 Store + 命令式编排器（GameOrchestrator）** 为骨架：

- **核心（core）** 不依赖框架、不依赖 DOM，只描述「牌 / 状态 / 动作 / 事件 / 规则包」的数据与算法。
- **编排层（orchestration）** 的 `GameOrchestrator` 是运行时心脏，驱动对局主循环、调用规则包、调度 AI/人类代理、落盘回放与历史。
- **表现层（ui）** 通过订阅 `gameStore` 的快照做渲染，与游戏逻辑解耦。

### 1.1 分层总览（自底向上）

| 层 | 目录 | 职责 | 是否纯逻辑 |
|---|---|---|---|
| 0 核心模型与规则 | `src/core/**` | Tile/Action/Event/State 类型；`RulePack` 接口与可插拔规则包（placeholder / chengdu） | ✅ 纯 |
| 1 代理与算法 | `src/agents/**` | `PlayerAgent` 接口、人类代理、AI 决策算法（向听/危险度/风格/对手模型/EV） | ✅ 纯（除 `llmConfig`） |
| 2 编排 | `src/orchestration/**` | 对局主循环、反应结算、降级、定时器 | ⚠️ 见 §3 依赖违规 |
| 3 分析与教学 | `src/analysis/**` | 启发式分析、LLM 分析适配、错例/画像/教学路线 | ✅ 纯（除 IO） |
| 4 LLM 表达层 | `src/llm/**`、`src/agents/llm/**` | `LLMService`、Prompt 构造、历史存储、策略上下文 | ✅ 纯（除 fetch/IndexedDB） |
| 5 训练 | `src/training/**` | 自对弈训练器、参数优化、在线学习、指标、参数持久化 | ✅ 纯（Node/浏览器双端） |
| 6 持久化 | `src/persistence/**` | 回放（localStorage）、历史（IndexedDB，位于 `llm/HistoryStorage`） | ❌ 有 IO |
| 7 状态 | `src/store/**`、`src/gameLogStore.ts` | 对局状态、设置、语言、日志的响应式单例 | ❌ 有副作用 |
| 8 表现 | `src/ui/**`、`src/main.ts` | 哈希路由页面、DOM/CSS 渲染器、PixiJS 场景（见 ADR-002）、样式、i18n | ❌ 有 DOM |
| 旁路 元策略 | `src/meta/**` | 多局聚合（matchManager）、元策略自适应的类型与工厂 | ✅ 纯（见 §6 债务） |

---

## 2. 模块依赖关系

### 2.1 依赖方向（理想 vs 实际）

理想依赖方向为「上层依赖下层、下层不反向依赖上层」：

```
ui ─▶ orchestration ─▶ agents ─▶ core
 ▲        ▲               ▲
 │        │               │
analysis ─┘        llm ───┘
 ▲
training ─▶ orchestration / core
persistence ◀ (被 orchestration / llm / ui 写入)
store ◀ (被几乎所有人读取)
```

### 2.2 ASCII 依赖图（标注实际耦合热点）

```
┌─────────────────────────── src/ui ───────────────────────────┐
│ pages/ · renderers/ · components/ · pixi/(孤儿) · styles/ ·   │
│ i18n/ · context.ts · main.ts                                  │
└───────┬───────────────────────────────▲──────────────────────┘
        │ 订阅                            │ 直接 import（违规）
        ▼                                │
┌─────────────── src/store ───────────┐  │  ┌──────── src/orchestration ────────┐
│ gameStore · settingsStore ·         │  │  │ GameOrchestrator (枢纽)            │
│ languageStore · gameLogStore        │  │  │  loop() / collectResolve / settle   │
└───────▲─────────────────────────────┘  │  └──┬──────────┬─────────┬───────────┘
        │ 被读取                          │     │          │         │
        │                                 │     ▼          ▼         ▼
┌───────┴──────── src/analysis ──────┐   │  agents   llm     persistence
│ HeuristicAnalyzer · LLMAnalyzer ·   │   │  (ui✗)   (ui✗)   (ui✗)
│ mistakePatterns · humanPersona ·     │   │           │         │
│ population* · pedagogy · learning-   │   │           ▼         ▼
│ Roadmap · abTesting · statistics ·   │   │  ┌── src/agents ──┐ ┌─ src/persistence ─┐
│ matchReport                          │   │  │ PlayerAgent    │ │ storage(replay)   │
└───────▲─────────────────────────────┘   │  │ HumanAgent     │ │ llm/HistoryStorage│
        │ 被 orchestrator 调用             │  │ algo/(shanten, │ └──────────────────┘
┌───────┴────── src/llm ─────────────┐   │  │  danger,style, │
│ LLMService · PromptBuilder ·        │   │  │  opponentModel,│
│ HistoryStorage · RuleContext ·      │   │  │  expectedValue,│
│ StrategyContext · browserConfig     │   │  │  bloodBattleEV,│
└───────▲─────────────────────────────┘   │  │  policy_high,  │
        │                                   │  │  difficulty,   │
┌───────┴────── src/training ────────┐    │  │  aiParams,     │
│ autoRun(AutoTrainer) ·             │    │  │  neural/(NN)   │
│ parallelTrainer(FastTrainer) ·     │    │  └───────────────┘
│ metrics · optimizer ·             │    │
│ onlineLearning · paramPersistence │    │
└───────▲─────────────────────────────┘    │
        │ 读 core / 调 orchestrator         │
        └──────────────────────────────────┘
                    │
                    ▼
        ┌────────────── src/core ──────────────┐
        │ model/(tile,types,action,event,state) │
        │ rules/RulePack · RuleRegistry ·        │
        │   validation/types ·                  │
        │   packs/(placeholder | chengdu)        │
        └────────────────────────────────────────┘
```

### 2.3 实际依赖违规（重要，详见 REVIEW.md §阻塞项）

| 违规 | 证据 | 影响 |
|---|---|---|
| **编排层反向依赖表现层** | `GameOrchestrator.ts:28` import `clearChatHistory`；`:29` import `showPixelDialog`；`safeAlert()` 直接调用 `showPixelAlertDialog` | 引擎与 DOM 强耦合；不利于测试与复用 |
| **核心规则包反向依赖状态层** | `core/rules/packs/chengdu/index.ts:14` import `settingsStore`；`getLegalActions` 内读 `settingsStore.p0IsAI`（`:472`、`:510`） | 纯逻辑核心不再「纯」；规则包无法独立单测/复用 |
| **编排层依赖训练层与 LLM 层** | `GameOrchestrator.ts:54` import `loadParams`；`:55` import `recordGameResult/loadOnlineLearnedParams`；`:56` import `historyStorage` | `GameOrchestrator` 成为跨层「枢纽」，体积与耦合度高 |
| **全局可变状态跨层传递** | `globalThis.__trainingGameSeed`（训练层写、规则包读）、`globalThis.__aiDecision`/`__lastLegalActions`（编排层写、日志读） | 单线程下可用，但破坏可测试性与并发安全性 |

---

## 3. 运行时数据流

### 3.1 对局主循环（game loop）

入口：`main.ts` 构造 `GameOrchestrator(placeholderRulePack, …)`，UI 通过 `ctx.orchestrator.startNewMatch()` 开局。

`GameOrchestrator.loop()`（`GameOrchestrator.ts:305`）是单线程 `async` 循环，关键分支：

1. **开局**：`rulePack.buildInitialState()` → `gameStore.reset()` + `setRunning(state)`；加载训练参数（`loadParams`/`setAIParams`）、在线学习增量（`loadOnlineLearnedParams`）。
2. **有弃牌待响应**（`state.lastDiscard`）：`collectAndResolveReactions()` 并行征求其他三家决策 → `rulePack.resolveReactions()`（碰/杠/胡/过水/抢杠）→ `applyState` + 推送事件。
3. **轮次结束**（`rulePack.isRoundEnd`）：`settleRound` → 计算 `END` 态 → `exportReplay()`（写 `persistence/storage`）→ `saveGameToHistory()`（写 IndexedDB）→ `recordGameResult()`（在线学习）→ `break`。
4. **常规行动**：`getCurrentActor` → `getLegalActions` → `decideAction`：
   - 人类 P0（`!p0IsAI`）：`HumanAgent.awaitAction()` 等待 DOM 派发 `dispatchHumanAction`（经 `validateHumanAction` + `DiscardValidator` 校验）。
   - AI：直接 `policyForDifficulty('high') => decideHigh`（EV 算法）。
   → `rulePack.applyAction()` 产生新状态 → `applyState` → 推事件 + 对手模型更新 → 若为弃牌再次结算反应 → 若开启分析则 `HeuristicAnalyzer.analyzeHand()`。
5. 每次迭代 `await timers.yield()`（让出事件循环，保持 UI 响应）。

### 3.2 事件流（event flow）

```
                 ┌─────────────── applyAction / resolveReactions ───────────────┐
                 │                                                              │
                 ▼                                                              ▼
        GameOrchestrator.loop()  ──pushEventAndUpdateModel(ev)──▶  gameStore.events
                 │ (GameEvent: INIT/DRAW/DISCARD/PENG/GANG/HU/TURN/END)                │
                 │                                                                  │
                 │ opponentModel.onEvent(state, ev)                               ▼
                 │                                                       UI render() 订阅 gameStore
                 │                                                       (match.ts:117)
                 │                                                                │
                 ▼                                                                ▼
        analysis/statistics.recordDecisionStat()                     renderers/ + components/
        (AI 决策统计，供复盘/画像)                                    actionEventFx 播放过场动画
```

- **单一事实源**：`gameStore.state` / `gameStore.events` 是 UI 唯一数据源；规则包返回**新状态对象**（以 `spread` 构造，见 `chengdu/index.ts` 多处 `as ChengduState` 新对象），`applyState` 替换引用并 `emit()`。
- **调试桥**：`globalThis.__lastLegalActions` / `__aiDecision` 供 `gameLogger` 记录（见 §2.3 风险）。

### 3.3 状态管理（state management）

| Store | 位置 | 持久化 | 作用 |
|---|---|---|---|
| `gameStore` | `src/store/gameStore.ts` | 否（内存） | 当前 `GameState` + `events[]` + 状态机 `idle/running/ended`，UI 主数据源 |
| `settingsStore` | `src/store/settingsStore.ts` | ✅ localStorage（`ai-mahjong:settings`），`sanitizeSettings` 校验 | 难度/规则/分析/LLM/UI/训练参数 |
| `languageStore` | `src/store/languageStore.ts` | i18n 运行时 | `t()` 取词，订阅即重渲染 |
| `gameLogStore` | `src/store/gameLogStore.ts` | 否 | 对局日志 |
| `historyStorage` | `src/llm/HistoryStorage.ts` | ✅ IndexedDB（`ai-mahjong-db`） | 对局记录/画像/复盘/QA 历史 |
| `storage` | `src/persistence/storage.ts` | ✅ localStorage | 最近一局回放 |

订阅模式统一：各 Store 暴露 `subscribe(listener)`，UI 在 `renderMatch`/`renderDebugMode` 中订阅并在清理时 `unsub()`（`match.ts:117-128`）。

---

## 4. 构建与部署管线

### 4.1 构建

- `vite.config.ts`：无特殊插件；`server.proxy` 为**开发期**将 `/api/llm/{kimi,openai,deepseek,anthropic}` 转发到对应厂商并注入 `KIMI_API_KEY`（`vite.config.ts:9-44`）。**仅 dev 生效**，生产不走此代理。
- `tsconfig.json`：`strict: true` + `noUnusedLocals/Parameters` + `moduleResolution: Bundler`；`noEmit: true`（类型检查由编辑器/CI 负责，见 REVIEW §CI）。
- `package.json`：`build = vite build`；产物 `dist/`。
- `vercel.json`：`buildCommand: pnpm build`，`outputDirectory: dist`；`rewrites` 将 `/api/*` 路由到 Serverless 函数、其余 SPA 回退到 `index.html`。

### 4.2 部署

- **Vercel Git 集成**：推送到 Git 后 Vercel 自动构建并部署（DEPLOY.md）。**注意：Vercel 的自动部署不等于 CI 门禁**——它不会运行 Vitest 或 `tsc`（详见 REVIEW §CI）。
- **Serverless API 代理**：`api/llm/kimi/messages.ts` 是 Vercel 函数，浏览器默认配置 `baseUrl=/api/llm/kimi/messages` 同源调用，由函数转发到 `api.kimi.com` 并注入服务端 `KIMI_API_KEY`（生产密钥仅存在于 Vercel 环境变量，**不进浏览器包**）。

### 4.3 离线训练与评测脚本（`scripts/`）

| 脚本 | 入口 | 训练器 |
|---|---|---|
| `pnpm train` | `scripts/train-selfplay.ts` | `AutoTrainer`（`training/autoRun.ts`） |
| `scripts/train-large.ts` | `AutoTrainer` | 同上，大规模 |
| `scripts/fast-train.ts` | `FastTrainer`（`training/parallelTrainer.ts`） | 参数优化器（`optimizer.ts`）+ 指标（`metrics.ts`） |
| `scripts/benchmark-params.ts` | 直接驱动 `GameOrchestrator` + `extractMetrics`/`calculateFitness` | — |
| `pnpm ai-eval` | `scripts/ai-eval.ts` | `testing/ai-eval/*` 评测 LLM 输出 |

训练参数回路：训练器生成候选 `AIParams` → `setAIParams()` → 跑局 → `extractMetrics` → `OnlineOptimizer.update` → `paramPersistence.saveParams`（Node 端原子写 `./ai-params.json`；浏览器端写 localStorage）。

---

## 5. 测试策略

- **框架**：Vitest 2（`vitest.config.ts`：`environment: 'node'`）。
- **现状**：`29` 个测试文件、`174` 个用例，**全部通过**（已实跑 `npx vitest run`，Duration ~9.8s）。
- **覆盖分布（证据：测试文件名）**：
  - 规则正确性：`tests/chengduRules.test.ts`、`tests/guafeng-xiаyu.test.ts`、`core/rules/packs/chengdu/*.{test}.ts`、`core/rules/packs/placeholder/*.{test}.ts`。
  - 算法单元：`tests/shanten.test.ts`、`tests/danger.test.ts`、`tests/policy_high_risk.test.ts`、`tests/policy_style_diff.test.ts`、`tests/policy_threat_diff.test.ts`、`tests/style.test.ts`、`tests/opponentModel.test.ts`、`tests/bloodBattleEV` 等。
  - 分析与教学：`tests/mistakePatterns.test.ts`、`tests/humanPersona.test.ts`、`tests/pedagogy.test.ts`、`tests/populationAnalysis.test.ts`、`tests/stage3.test.ts`、`tests/metaStrategy.test.ts`、`tests/matchManager.test.ts`。
  - LLM 与代理：`tests/llmServiceConfigUpdate.test.ts`、`tests/llmProxyRouting.test.ts`、`tests/llmBrowserConfig.test.ts`、`tests/kimiProxyHandler.test.ts`。
  - 表现/契约：`tests/uiPages.contract.test.ts`、`tests/pixelFrameClasses.test.ts`、`tests/runtimeDisplay.test.ts`、`tests/settingsStore.test.ts`。
- **AI 评测 harness**：`src/testing/ai-eval/*` 提供「硬约束/软约束」分离的验证器（`types.ts:PhaseValidator`），`scripts/ai-eval.ts` 支持 `--dry-run`、多阶段、多 prompt 评分；这是 LLM 表达层的质量闸门（但**未接入 CI**，见 REVIEW）。
- **缺口**：无覆盖率门禁；`training/`、`llm/HistoryStorage`(IndexedDB)、完整对局端到端（E2E）缺少自动化覆盖。

---

## 6. 已知架构债务（精简，详见 REVIEW.md）

以下均为代码事实，非臆测：

1. **孤儿模块（已实现但未接入运行期）**：
   - `src/ui/pixi/*`（PixiJS 牌桌场景）——全代码库无任何外部 import（`grep` 仅在 pixi/ 内部自引用）。**实际 TABLE 渲染由 DOM/CSS 的 `renderers/matchTableRenderer.ts` 完成**（见 ADR-002）。`pixi.js` 依赖因此被 tree-shake，运行时未真正使用。
   - `src/analysis/MoveAnalyzer.ts`、`src/training/parallelAutoRun.ts`、`src/training/parallelTrainer.ts` 的 `runParallelTraining`、`src/training/neuralTrainer.ts`(`NeuralTrainer`)、`src/training/fastTrain.ts`、`orchestration/degrade.ts` 的 `degradeDifficulty`——均未被运行期或其他脚本引用（详见 §2.2 grep 证据）。
   - `src/meta/matchManager.ts` 与 `src/meta/metaStrategy.ts` 的**工厂函数** `createMatchManager`/`createMetaStrategy` 未被调用；运行期改用 `analysis/statistics.ts` 聚合单局统计。仅其类型被 `matchReport.ts`/`PlayerAgent.ts` 引用。
2. **依赖违规**：见 §2.3（`GameOrchestrator` 跨层枢纽、规则包依赖 `settingsStore`、全局可变状态）。
3. **单例与全局状态**：`testConfig`、`settingsStore`、`llmService` 等为全局单例；训练与运行期共用 `globalThis` 通道，单线程安全但不可并发。

---

## 7. 架构图（一页总览）

```
┌──────────────────────── 浏览器 / Vercel Edge ────────────────────────┐
│                                                                       │
│  ┌──────────── UI (DOM/CSS) ────────────┐   ┌── LLM 表达层 ─────────┐ │
│  │ hash 路由: home/match/replay/settings │   │ LLMService(PromptBuilder)│
│  │ renderers/ + components/ + i18n       │   │ OpenAICompatibleAnalyzer │
│  │ (PixiJS 场景为孤儿,未接入)            │   │ HistoryStorage(IndexedDB) │
│  └───────────────┬───────────────────────┘   └──────────┬─────────────┘
│                  │ 订阅/派发                              │ fetch /api/llm/*
│                  ▼                                        ▼
│  ┌────────── gameStore(state+events) ◀── orchestration/GameOrchestrator ──┐
│  │  settingsStore · languageStore · gameLogStore                          │
│  └──────────▲────────────────────────────────────────────────────────────┘
│              │ 调用                 │ 调用规则包            │ 写回放/历史
│              ▼                      ▼                      ▼
│       agents/(PlayerAgent,      core/rules/RulePack    persistence/storage
│       HumanAgent, algo/EV)      (chengdu | placeholder) (localStorage)
│              │                      ▲                    historyStorage(IndexedDB)
│              └──── 训练脚本驱动 ──────┼──── training/(AutoTrainer, ──────┘
│                                     │     FastTrainer, optimizer,
│                                     │     onlineLearning, paramPersistence)
└─────────────────────────────────────┴──────────────────────────────────┘
        ▲  生产 API 密钥在 Vercel 环境变量，经 api/llm/kimi/messages.ts 代理
        │  默认 baseUrl=/api/llm/kimi/messages（同源，密钥不出浏览器）
        └── Vercel 自动部署（git push）→ pnpm build → dist/
```

---

## 8. 文档索引

- `ARCHITECTURE.md`（本文件）：分层、依赖、数据流、构建部署、测试、债务。
- `ADR-001.md`：前端 Vite + TypeScript 技术栈选型。
- `ADR-002.md`：渲染与游戏状态分离（含 PixiJS 孤儿事实）。
- `ADR-003.md`：`RulePack` 可插拔规则抽象。
- `ADR-004.md`：LLM 表达层与决策层分离。
- `REVIEW.md`：full 强度评审、判定、阻塞项、控制清单。
