# Project Guidelines

## Build and Test

Package manager is **pnpm 9.15.0** (Node 20.x). All commands via `pnpm`:

```bash
pnpm install          # Install dependencies
pnpm dev              # Vite dev server (port 5173)
pnpm build            # Production build → dist/
pnpm test             # Vitest watch mode
pnpm test:run         # Vitest single run (CI)
pnpm train            # Self-play AI training (tsx scripts/train-selfplay.ts)
```

Training CLI flags: `--games N`, `--mode baseline|mirror`, `--batch N`, `--seed N`, `--verbose`.

## Architecture

**Chengdu Mahjong (Blood Battle / 血战到底)** — 4-player game with exchange, ding-que, and blood-battle phases. See [RULES_CHENGDU.md](../RULES_CHENGDU.md) for full rule spec.

### Rule-First Design

All game logic is delegated to a `RulePack` interface. The orchestrator, agents, and UI never hardcode rules — they call RulePack methods (`getLegalActions`, `applyAction`, `getCurrentActor`). New rule variants are added by implementing a new RulePack, not by modifying the orchestrator.

### Layer Hierarchy

```
UI (vanilla DOM, hash router)
  → Stores (pub-sub: GameStore, SettingsStore, LanguageStore)
    → GameOrchestrator (state machine, turn loop, event logging)
      → RulePack (Chengdu rules, state transitions)
      → PlayerAgent.decide() (async — human or AI)
        → Algorithmic policies (danger, EV, shanten, difficulty)
```

### Key Directories

| Directory | Responsibility |
|-----------|---------------|
| `src/core/model/` | Game state, tiles, actions, events — pure data types |
| `src/core/rules/` | RulePack interface and Chengdu implementation |
| `src/agents/algo/` | Heuristic AI: 47 tunable parameters, danger eval, expected value, shanten |
| `src/orchestration/` | GameOrchestrator — game loop, timers, degradation |
| `src/store/` | Pub-sub stores (no framework — plain `Set<Listener>`, emit on mutation) |
| `src/ui/` | Vanilla DOM components, hash router with cleanup functions |
| `src/training/` | Self-play, optimizer (hill climbing + simulated annealing), metrics, persistence |
| `src/analysis/` | Move analysis, LLM coaching, mistake patterns, pedagogy |
| `src/llm/` | LLM integration: prompt builder, rule context, history |

## Conventions

### No UI Framework

UI is vanilla DOM manipulation — no React, Vue, or Solid. Components are functions that:
1. Create DOM elements and attach event listeners
2. Subscribe to stores for reactivity
3. Return a cleanup function (`() => void`) that removes listeners and DOM nodes

### State Management

Stores use a hand-rolled pub-sub pattern. Mutations call `this.emit()` to notify subscribers. Subscribe returns an unsubscribe function. No external state library.

### Agent Interface

```typescript
interface PlayerAgent {
  decide(state: GameState, playerId: PlayerId, legal: Action[], ctx?: AgentDecisionContext): Promise<Action>;
}
```

Both `HumanAgent` (awaits UI input) and AI agents implement this. The orchestrator is agent-agnostic.

### Type Patterns

- Player IDs: `'P0' | 'P1' | 'P2' | 'P3'`
- Phases: `'EXCHANGE' | 'DING_QUE' | 'PLAYING' | 'END'`
- Suits: `'W' | 'B' | 'T'` (Wan, Bamboo, Dot — no honors)
- State updates use spread operators (immutable style)

### Testing

Tests live in `tests/` (not colocated). Use Vitest with `describe`/`it` blocks. Helper functions like `baseState()` and `t(suit, rank)` create fixtures. Run `pnpm test:run` before committing.

### I18n

All user-facing strings go through `src/i18n/translations.ts` (Chinese and English).

## Pitfalls

- **Training mode disables logging** — the orchestrator skips event logging when `trainingMode` is true. Don't rely on events during training runs.
- **RulePack is the single source of truth** — never validate moves outside the RulePack. If you need a new rule check, add it to the RulePack interface.
- **Cleanup functions are critical** — every UI render function must return a cleanup that unsubscribes stores and removes DOM nodes, or the hash router will leak listeners.
- **AI params are persisted** — `ai-params.json` (Node) or localStorage (browser). The training system uses atomic writes via `paramPersistence.ts`.

## Documentation

| Document | Topic |
|----------|-------|
| [README.md](../README.md) | Setup, dev commands, UI modes, LLM config |
| [RULES_CHENGDU.md](../RULES_CHENGDU.md) | Complete Chengdu Mahjong rule specification |
| [README_TRAINING.md](../README_TRAINING.md) | Training system guide, CLI usage, fitness function |
| [TRAINING_SYSTEM.md](../TRAINING_SYSTEM.md) | Training architecture details |
| [docs/LLM-Features-Design.md](../docs/LLM-Features-Design.md) | LLM coaching system design |
| [DEPLOY.md](../DEPLOY.md) | Vercel deployment configuration |
| [EXCHANGE_INTEGRATION_GUIDE.md](../EXCHANGE_INTEGRATION_GUIDE.md) | Exchange phase integration |
| [CHENGDU_MISSING_FEATURES.md](../CHENGDU_MISSING_FEATURES.md) | Unimplemented features |
