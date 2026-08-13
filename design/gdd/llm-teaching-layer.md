# 系统设计文档 — S3 LLM 教学表达层

> 源码依据：`src/llm/{LLMService,StrategyContext,RuleContext,PromptBuilder,browserConfig,llmConfig,HistoryStorage,types,index}.ts`、`docs/strategy/*`、`src/ui/components/{LLMChatAssistant,LLMCoachingPanel,LLMSettingsPanel}.ts`
> 设计铁律：**LLM 只做「表达/讲解」，不做任何落子决策**。决策权完全在 S1/S2（`LLMService` 无 `decideMove` 之类方法）。

## ① 概述与目标
- 把 S2 的可解释决策 + S1 的规则状态，转化为**自然语言教学**：实时出牌辅导、换三张建议、定缺建议、对局复盘、玩家画像、自由问答。
- 目标：① 在 `llmEnabled` 开关下可选启用（不配 API Key 也能跑游戏/AI/训练/回放）；② 通过分层策略知识库把 token 压到最低并提升讲解与成都规则对齐度；③ 多供应商兼容（OpenAI 兼容 / Anthropic / Deepseek / 自定义），浏览器经 Vercel serverless 代理转发。

## ② 核心机制 / 玩家动词
- **接入供应商** `LLMService`：`getCoachingAdvice/getExchangeAdvice/getDingQueAdvice/generateReview/analyzeProfile/answerQuestion/generateCommentary/predictOpponent`（`LLMService.ts`）；内置 `memory` 缓存；浏览器侧将 `kimi-k2`/`openai-compatible` 映射到代理 URL（`browserConfig.ts`：`localStorage` key `ai-mahjong:llm-config`）。
- **规则上下文** `RuleContext`：`CHENGDU_RULES` 全文、`getRuleSummary/getYakuExplanation/getPhaseRules`（阶段规则文本）。
- **策略上下文** `StrategyContext`：`getStrategyContext(phase, situation?, withProbability?)` 按阶段/场景路由 `docs/strategy/*.md`（`?raw` 内联），`inferSituation` 自动推断（缺门→quemen / 尾局→endgame / 对手副露≥2 且牌墙<40→defense / 默认 offense，`StrategyContext.ts:111-148`）。
- **提示构建** `PromptBuilder`：六个已实现 prompt builder（`buildCoaching/Exchange/DingQue/Review/Profile/QA`）+ 两个**未接线** builder（`buildCommentary` 解说、`buildOpponentPrediction` 对手预测）。
- **教学分级** `GuidanceLevel`：beginner/learning/practicing/advanced（对应文案详略，见 `PromptBuilder:97-102`）。

## ③ 系统依赖
- 上游：`core/model`(GameState)、`S1`（读 `ChengduState.dingQueSelection/passedHuPlayers` 等）、`docs/strategy/*`（知识库）、`S5`（`LLMAnalyzer` 消费画像/复盘）。
- 下游：S6（match 页在 `llmEnabled && gameState` 时渲染 `LLMChatAssistant`/`LLMCoachingPanel`，`ui/pages/match.ts:108-113`）。
- 持久化：`HistoryStorage`（IndexedDB `ai-mahjong-db`，存 GAMES/PROFILE/REVIEWS/QA_HISTORY，`llm/HistoryStorage.ts`）。

## ④ 关键数据结构 / 状态
- `LLMConfig`（`types.ts`）：provider/baseURL/apiKey/model/...；`browserConfig` 的 `LLMProfile` 单例。
- `CoachingAdvice / GameReview / UserProfile / Commentary / QASession / OpponentPrediction / GuidanceLevel`（`types.ts`）。
- `StrategySituation`：quemen/offense/baoting/listen/gang/defense/endgame（`StrategyContext.ts`）。
- `MODULE_MAP`：`exchange/dingque/discard_quemen/offense/baoting/listen/gang/defense/endgame/probability` 十个 Markdown 模块（Vite `?raw`）。

## ⑤ 核心流程 / 算法
1. 玩家在 match 页触发辅导 → `syncCoachPanelContext({gameState, legalActions, dispatchAction})`（`match.ts:96-104`）。
2. `LLMCoachingPanel` 调 `LLMService.getCoachingAdvice` → `PromptBuilder.buildCoachingPrompt(state, 'P0', legalActions, level)`：注入 `getRuleSummary`+`getPhaseRules`+`getStrategyContext`（含 `inferSituation`）+ 局面/手牌/副露/弃牌/对手定缺，要求 JSON 输出（`recommendedAction/confidence/reasoning/alternatives/riskAssessment/strategicHints`）。
3. 换三张/定缺：`buildExchangePrompt/buildDingQuePrompt` 解析手牌分组、枚举同花 3 张组合、注入硬约束（禁止混花色、只能 ≥3 张门换出）。
4. 复盘/画像/问答：`buildReview/Profile/QAPrompt` 各自组织统计与规则/策略上下文，返回结构化 JSON。
5. 分级 token 控制：仅 `advanced` 或教学场景联合 `probability.md`（`StrategyContext.ts:99-102`），达成「token 降 90%+」目标（`STRATEGY_KNOWLEDGE_DESIGN.md`）。

## ⑥ 参数与平衡
- `level` 决定讲解深度与 JSON 字段丰富度（beginner 直接给答案 → advanced 给概率级深度）。
- 代理映射：Kimi Coding / OpenAI Compatible 预设（`browserConfig.ts`），`llmConfig.ts` 默认 `kimi-k2`。
- 缓存：对话/复盘结果 `memory` 缓存避免重复调用。

## ⑦ 异常 / 边界处理
- **可选性**：`llmEnabled=false` 或 `API Key` 缺失时，UI 不渲染辅导面板，游戏不受影响（`match.ts:108`）。
- **JSON 容错**：`LLMService.parseJSON` 带默认值，模型输出非 JSON 时不崩溃。
- **策略模块缺失**：`getStrategyContext` 未指定 situation 时回退通用进攻模块（`StrategyContext.ts:84-87`）。
- **API 失败**：由 `try/catch` + UI 提示；不阻塞对局主循环。

## ⑧ 验收标准
- [x] LLM 仅生成讲解文本，无任何代码路径让 LLM 选择落子（决策在 S1/S2）。
- [x] `llmEnabled=false` 时整套游戏/AI/训练/回放可运行（README 明示）。
- [x] 分层策略知识库经 Vite `?raw` 内联，按阶段/场景按需加载。
- [x] 六类教学 prompt（coaching/exchange/dingque/review/profile/qa）已实现并接 UI 或分析器。
- [ ] **（CONCERN）** `buildCommentaryPrompt`（解说）与 `buildOpponentPredictionPrompt`（对手预测）在 `LLMService` 有方法但**无 UI 消费方**；若对外宣称「AI 解说/对手预测」需补充接线或下调为「预留」。
- [ ] **（CONCERN）** 辅导文案番型数值与代码不一致：文案写「清一色3番、门清+1番」（`PromptBuilder:168`），但代码清一色=2番、门清未实现（详见 rule-engine.md §6 与 REVIEW.md）。LLM 会据此给出**错误番型建议**，属教学正确性风险。
- [ ] **（CONCERN）** `LLM-Features-Design.md` 中的 LearningPath、社交分享、语音、心理辅导均仅文档，无代码；不应计入已实现功能。
