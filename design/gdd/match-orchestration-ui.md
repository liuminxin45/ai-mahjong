# 系统设计文档 — S6 对局编排与 UI 流程

> 源码依据：`src/orchestration/{GameOrchestrator,degrade,timers}.ts`、`src/ui/{pages,components,pixi,renderers,context,aiLocale,speechToText}.ts`、`src/store/*`、`src/persistence/{replay,storage}.ts`、`src/meta/*`、`src/config/testConfig.ts`
> 目标：把 S1–S5 串成可玩的 Web 对局：主循环驱动、人工/AI 调度、TABLE/DEBUG 双渲染、回放与历史持久化。

## ① 概述与目标
- 单一 `GameOrchestrator` 主循环：枚举合法动作 → 调度人类/AI → 应用动作 → 结算并发响应 → 推进状态 → 记录统计 → 渲染。
- 提供四页面（home/settings/match/replay）、双渲染模式（TABLE 像素风 / DEBUG 文本调试）、出牌校验、回放导出、IndexedDB 历史；人类 P0 可选 `p0IsAI` 全 AI 对战。

## ② 核心机制 / 玩家动词
- **主循环** `loop()`（`GameOrchestrator.ts:305-612`）：死循环 `while(running)`；若有 `lastDiscard` 先 `collectAndResolveReactions`；否则判 `isRoundEnd`→`settleRound`+导出回放+存历史；否则取 actor 合法动作，人类 P0 非 AI 时 `await human.awaitAction`（除 EXCHANGE/DING_QUE 外带 `timeoutMs` 超时回退 AI），其余 `decideAction`。
- **人类调度** `dispatchHumanAction`：先 `validateHumanAction` 再 `discardValidator.validateDiscard`（违规弹窗并拦截，`GameOrchestrator.ts:237-277`）。
- **并发响应** `collectAndResolveReactions`：对 P1–P3（非弃牌人、未胡）并行 `decideAction` → `resolveReactions`（`GameOrchestrator.ts:737-762`）。
- **渲染模式**：`settingsStore.uiMode`=TABLE/DEBUG（`match.ts:77-94`）；TABLE 用 `matchTableRenderer` + Pixi 场景（`pixi/MahjongTableScene`）+ 出牌飞行动效；DEBUG 用 `matchDebugRenderer` 文本。
- **页面流**：home（newGame/settings/replay）→ `startNewMatch` + 导航 `#/match`；`#/replay` 载入 `storage.loadLatest()`；`#/settings` 改 `settingsStore`。
- **AI 参数加载**：开局 `loadParams` 用 `bestParams`，再叠 `loadOnlineLearnedParams`（`GameOrchestrator.ts:164-190`）。
- **降级** `degradeDifficulty`：high→mid→low（`degrade.ts`）。

## ③ 系统依赖
- 上游：全部 —— `S1 规则引擎`（跑局）、`S2`（AI `decide`）、`S3`（match 页在 `llmEnabled` 渲染辅导面板）、`S4`（`startNewMatch` 加载训练/在线参数）、`S5`（`analyzer` 在手牌变化时 `analyzeHand`、统计采集）。
- 同级：`store/*`（gameStore/gameLogStore/settingsStore/languageStore）、`persistence/*`（回放/历史）。

## ④ 关键数据结构 / 状态
- `GameOrchestrator` 字段：`human:HumanAgent`、`agents:Record<PlayerId,PlayerAgent>`、`rulePack`、`discardValidator`、`opponentModel`、`running`、`state`、`currentGameId`（`GameOrchestrator.ts:89-106`）。
- `GameStore`：`{state, events, status}` + 订阅（`store/gameStore.ts`）。
- `ReplayFile`：`{meta, settings, events}`（`persistence/replay.ts`）；`storage` 存 `localStorage:'ai-mahjong:latest-replay'`。
- `UiCtx`：`{orchestrator, gameStore, settingsStore, analyzer, llmAnalyzer, storage, navigate}`（`ui/context.ts`）。

## ⑤ 核心流程 / 算法
1. `startNewMatch(ruleId)`：`stop()`→重置→`startMatchStat`→`opponentModel.init`→加载 bestParams+在线增量→`registry.get(ruleId)`→`buildInitialState`→`gs.setRunning`→`loop()`。
2. 每步：取 actor → 合法动作（SET 全局 `__lastLegalActions`）→ 人类等待/AI `decide` → 校验出牌 → `applyAction` → `recordDecisionStat`（仅 AI 弃牌，`GameOrchestrator.ts:559-586`）→ `eventFromAction` 推事件 → 若有 `lastDiscard` 再结算响应 → 分析面板（`analysisEnabled && P0 手持+1`）。
3. 结束：`isRoundEnd`→`settleRound`→判定 P0 结果(HU/LOSE/DRAW)→`finishMatchStat`→`exportReplay`→`saveGameToHistory`（仅人类局，含 `recordGameResult` 在线学习）→`break`。
4. 渲染：`gameStore.subscribe(render)`；TABLE 模式 `playActionTransferFx` 串行飞行动效。

## ⑥ 参数与平衡
- `settingsStore` 默认值：`difficulty='high', ruleId='chengdu', analysisEnabled=true, llmEnabled=true, uiMode='TABLE', timeoutEnabled=false, timeoutMs=30000, p0IsAI=false, trainingGames=100, uiScale=1, hudSafeZonePercent=3`（`settingsStore.ts:25-39`）；均有 `sanitize` 边界（uiScale 0.85–1.35、hudSafeZone 0–8、timeoutMs 1000–120000）。
- AI 对手步间延迟：`!p0IsAI && actor∈{P1,P2,P3} && !declaredHu.P0` 时 `sleep(2000)`（更自然，`GameOrchestrator.ts:856-860`）。
- 训练种子 `globalThis.__trainingGameSeed` 注入保证可复现。

## ⑦ 异常 / 边界处理
- **死锁守卫**：活跃玩家仅 PASS 可选时 `buildRecoveryAction`（DRAW 或首张合法弃牌），否则 `stop()`+弹窗（`GameOrchestrator.ts:439-461,764-816`）。
- **无限循环检测**：同状态哈希连续 >10 次，强制清 `lastDiscard` 或推进玩家（`GameOrchestrator.ts:314-352`）。
- **出牌校验**：人类违规由 `discardValidator` 拦截并提示（训练态抛错停局，`GameOrchestrator.ts:508-548`）。
- **非法人类动作**：`validateHumanAction` 覆盖换三张（3 同花、在手）、定缺、碰杠胡合法性。
- **历史保存失败**：`saveGameToHistory` `catch` 仅 log，不阻断对局。

## ⑧ 验收标准
- [x] 主循环能驱动完整对局至 `END`，并自动导出回放、存 IndexedDB 历史（人类局）。
- [x] 人类 P0 与 AI(P1–P3) 可同局；`p0IsAI` 可切换全 AI 自对弈。
- [x] 出牌校验器强制 ding-que 规则；死锁/循环守卫防止卡死。
- [x] TABLE/DEBUG 双模式与四页面导航可用；`llmEnabled` 时辅导面板出现。
- [ ] **（CONCERN）** `GameOrchestrator` 中大量 `console.log`/`console.error`（验证、自摸、暗杠、循环报错等，如 `:319-347,595-675`）在生产 UI 下仍会打印，建议统一日志级别开关（S2 同问题）。
- [ ] **（CONCERN）** `timeoutMs` 仅在 EXCHANGE/DING_QUE 之外启用、且默认 `timeoutEnabled=false`；若开启，超时回退 AI 可能让「人类思考时间」被压缩，需 UX 确认。
- [ ] **（CONCERN）** `saveGameToHistory` 的 `replay` 字段把 `state: finalState` 塞进每事件（`:901-909`），回放体积偏大，长期历史可能膨胀 IndexedDB。
