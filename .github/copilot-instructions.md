# Project Guidelines

## Build and Test

- Package manager is `pnpm@9.15.0` with Node `20.x` (see `package.json`). Use `pnpm` only.
- Core commands:
  - `pnpm install`
  - `pnpm dev` (Vite dev server)
  - `pnpm build`
  - `pnpm test` (watch)
  - `pnpm test:run` (single run)
  - `pnpm train` (self-play training)
- Training script (`scripts/train-selfplay.ts`) supports flags: `--games`, `--mode`, `--batch`, `--seed`, `--verbose`, `--blocking`.

## Architecture

- This repo uses a rule-first architecture for Chengdu Mahjong (Blood Battle): orchestrator and agents never hardcode Mahjong rules.
- `RulePack` is the source of truth for legal actions and state transitions (`getLegalActions`, `applyAction`, `getCurrentActor`).
- Layer boundary:
  - UI (vanilla DOM, hash router) -> stores (pub-sub) -> `GameOrchestrator` -> `RulePack` + `PlayerAgent`.
- Key directories:
  - `src/core/model`: pure game data types
  - `src/core/rules`: `RulePack` interface and rule packs
  - `src/orchestration`: game loop and runtime control
  - `src/agents`: human/AI agents and policy logic
  - `src/store`: pub-sub stores
  - `src/ui`: DOM pages/components/renderers
  - `src/training`: self-play, optimizer, persistence

## Conventions

- No UI framework. UI is plain DOM code and each render/page function must return a cleanup function that unsubscribes listeners and removes DOM nodes.
- Keep state transitions in rules/orchestrator logic immutable (spread/copy style), not ad-hoc mutation from UI.
- Keep move validation in `RulePack`; do not duplicate rule checks in orchestrator, agents, or UI.
- Agent contract:

```ts
interface PlayerAgent {
  decide(state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext): Promise<Action>;
}
```

- Common types/patterns:
  - Player IDs: `'P0' | 'P1' | 'P2' | 'P3'`
  - Suits: `'W' | 'B' | 'T'`
  - Main phases: `'EXCHANGE' | 'DING_QUE' | 'PLAYING' | 'END'`
- Put all user-facing strings in `src/i18n/translations.ts`.
- Tests belong under `tests/` and use Vitest (`describe`/`it`).

## Pitfalls

- `trainingMode` changes runtime behavior (reduced logging/diagnostics and altered decision flow). Verify mode before debugging AI quality.
- Missing cleanup functions in UI pages/components will leak subscribers when the hash route changes.
- AI params are persisted (`ai-params.json` in Node, localStorage in browser). Keep persistence behavior in mind when evaluating policy changes.

## Documentation

Link to existing docs instead of duplicating details:

- `README.md`: setup and feature overview
- `RULES_CHENGDU.md`: rule spec and phase/action behavior
- `README_TRAINING.md`: training workflow and usage
- `TRAINING_SYSTEM.md`: training internals and optimization strategy
- `docs/LLM-Features-Design.md`: LLM coaching design
- `EXCHANGE_INTEGRATION_GUIDE.md`: exchange-phase integration details
- `CHENGDU_MISSING_FEATURES.md`: roadmap and missing features
- `DEPLOY.md`: deployment steps

## Strategy Knowledge Base

策略知识库位于 `docs/strategy/`，按决策阶段拆分为独立模块。
需要参考策略理论时，先读 `docs/strategy/_index.yaml` 确定相关模块，
再按需读取具体模块文件。**不要一次性读取所有模块。**

模块列表:
- `exchange.md`: 换三张决策
- `dingque.md`: 定缺决策
- `discard_quemen.md`: 缺门清理出牌
- `discard_offense.md`: 中盘进攻出牌
- `discard_baoting.md`: 保听策略
- `listen.md`: 听牌选择与EV比较
- `gang.md`: 杠决策
- `defense.md`: 防守切换
- `endgame.md`: 尾局与查叫/花猪
- `probability.md`: 核心概率公式（共享）

代码集成: `src/llm/StrategyContext.ts` 实现按阶段路由加载，
`PromptBuilder.ts` 通过 `getStrategyContext()` 注入到 LLM prompt 中。
