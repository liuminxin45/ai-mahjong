import type { Action } from '../core/model/action';
import type { GameEvent } from '../core/model/event';
import type { GameState } from '../core/model/state';
import { PLAYER_ORDER, type PlayerId } from '../core/model/types';
import type { RulePack } from '../core/rules/RulePack';
import type { DiscardValidator } from '../core/rules/validation/types';
import { RuleRegistry } from '../core/rules/RuleRegistry';
import { chengduRulePack } from '../core/rules/packs/chengdu';
import { placeholderRulePack } from '../core/rules/packs/placeholder';
import { HumanAgent } from '../agents/HumanAgent';
import type { AgentDecisionContext, PlayerAgent } from '../agents/PlayerAgent';
import { policyForDifficulty } from '../agents/algo/difficulty';
import { makeAgentStyleContext } from '../agents/algo/style';
import { evaluateTileDanger } from '../agents/algo/danger';
import { shantenWithMelds } from '../agents/algo/shanten';
import { tileToString } from '../core/model/tile';
import { timers } from './timers';
import { gameStore } from '../store/gameStore';
import { settingsStore, type Difficulty, type RuleId } from '../store/settingsStore';
import type { HeuristicAnalyzer } from '../analysis/HeuristicAnalyzer';
import type { ReplayFile } from '../persistence/replay';
import { storage } from '../persistence/storage';
import { finishMatchStat, recordDecisionStat, startMatchStat } from '../analysis/statistics';
import { createOpponentModel } from '../agents/algo/opponentModel';
import { gameLogger } from '../utils/gameLogger';

function now(): number {
  return Date.now();
}

function makeId(): string {
  return `replay_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function eventFromAction(
  action: Action,
  stateAfter: GameState,
  actor: PlayerId,
): GameEvent[] {
  const base = { turn: stateAfter.turn, ts: now() };
  if (action.type === 'DRAW') {
    const tile = stateAfter.hands[actor][stateAfter.hands[actor].length - 1];
    return [{ type: 'DRAW', playerId: actor, tile, ...base }];
  }
  if (action.type === 'DISCARD') {
    return [{ type: 'DISCARD', playerId: actor, tile: action.tile, ...base }];
  }
  return [];
}

export class GameOrchestrator {
  private readonly human: HumanAgent;
  private readonly agents: Record<PlayerId, PlayerAgent>;
  private readonly registry: RuleRegistry;

  private readonly gs: typeof gameStore;
  private readonly ss: typeof settingsStore;
  private readonly analyzer: HeuristicAnalyzer | null;

  private rulePack: RulePack;
  private discardValidator: DiscardValidator | null = null;
  private opponentModel = createOpponentModel();

  private running = false;
  private state: GameState | null = null;

  constructor(
    rulePack: RulePack = placeholderRulePack,
    agents?: Record<PlayerId, PlayerAgent>,
    gs: typeof gameStore = gameStore,
    ss: typeof settingsStore = settingsStore,
    analyzer: HeuristicAnalyzer | null = null,
  ) {
    this.rulePack = rulePack;
    this.human = new HumanAgent();

    this.gs = gs;
    this.ss = ss;
    this.analyzer = analyzer;

    this.registry = new RuleRegistry();
    this.registry.register(placeholderRulePack);
    this.registry.register(chengduRulePack);

    this.agents =
      agents ??
      ({
        P0: this.human,
        P1: { decide: async (s, pid, legal, ctx) => this.pickAlgoAction(s, pid, legal, this.ss.difficulty, ctx) },
        P2: { decide: async (s, pid, legal, ctx) => this.pickAlgoAction(s, pid, legal, this.ss.difficulty, ctx) },
        P3: { decide: async (s, pid, legal, ctx) => this.pickAlgoAction(s, pid, legal, this.ss.difficulty, ctx) },
      } satisfies Record<PlayerId, PlayerAgent>);
  }

  startNewMatch(ruleId?: RuleId): void {
    this.stop();
    this.running = true;

    startMatchStat();
    this.opponentModel.init(['P0', 'P1', 'P2', 'P3']);

    const selected = ruleId ?? this.ss.ruleId;
    this.rulePack = this.registry.get(selected);

    // 加载规则包的出牌校验器
    if (this.rulePack.getDiscardValidator) {
      this.discardValidator = this.rulePack.getDiscardValidator();
      if (this.discardValidator) {
        console.log('[GameOrchestrator] 📋 Discard validator loaded:', this.discardValidator.getDescription());
      }
    }

    const init = this.rulePack.buildInitialState();
    this.state = init;

    this.gs.reset();
    this.gs.setRunning(init);
    this.pushEventAndUpdateModel({ type: 'INIT', turn: init.turn, ts: now() });

    // 开始游戏日志记录
    const gameId = makeId();
    gameLogger.startGame(gameId);
    if (this.ss.p0IsAI) {
      console.log('[GameOrchestrator] 🤖 P0 AI mode ENABLED - Full AI vs AI game');
    }

    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  dispatchHumanAction(action: Action): void {
    // 如果是出牌动作且有校验器，先进行校验
    if (action.type === 'DISCARD' && this.discardValidator && this.state) {
      const validation = this.discardValidator.validateDiscard(this.state, 'P0', action.tile);
      
      if (!validation.valid) {
        console.warn('[Validator] ❌ Invalid discard:', validation.reason);
        
        // 在 UI 上显示错误提示
        alert(`Cannot discard this tile!\n\n${validation.reason}`);
        
        // 如果有建议的牌，显示给玩家
        if (validation.suggestedTiles && validation.suggestedTiles.length > 0) {
          console.log('[Validator] 💡 Suggested tiles:', validation.suggestedTiles);
        }
        
        return; // 阻止非法出牌
      }
      
      console.log('[Validator] ✅ Valid discard');
    }
    
    this.human.dispatch(action);
  }

  getLegalActions(playerId: PlayerId): Action[] {
    const s = this.state;
    if (!s) return [];
    return this.rulePack.getLegalActions(s, playerId);
  }

  exportReplay(): ReplayFile {
    const meta = {
      id: makeId(),
      createdAt: now(),
      rulePackId: this.rulePack.id,
      rulePackVersion: this.rulePack.version,
    };

    const settings = {
      difficulty: this.ss.difficulty,
      ruleId: this.ss.ruleId,
      analysisEnabled: this.ss.analysisEnabled,
    };

    const events = this.gs.events.slice();
    const replay: ReplayFile = { meta, settings, events };
    storage.saveLatest(replay);
    return replay;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const state = this.state;
      if (!state) break;

      if (state.lastDiscard) {
        const resolved = await this.collectAndResolveReactions(state);
        this.state = resolved.state;
        this.gs.applyState(resolved.state);
        for (const ev of resolved.events) {
          this.pushEventAndUpdateModel(ev);
        }
        await timers.yield();
        continue;
      }

      if (this.rulePack.isRoundEnd(state)) {
        const res: 'HU' | 'LOSE' | 'DRAW' = state.declaredHu.P0
          ? 'HU'
          : (['P1', 'P2', 'P3'] as PlayerId[]).some((pid) => state.declaredHu[pid])
            ? 'LOSE'
            : 'DRAW';
        finishMatchStat(res);
        const ended: GameState = { ...state, phase: 'END' };
        this.state = ended;
        this.gs.applyState(ended);
        this.pushEventAndUpdateModel({ type: 'END', turn: ended.turn, ts: now() });
        this.gs.setEnded(ended);
        
        // 记录游戏结束
        gameLogger.endGame(ended, res);
        
        break;
      }

      const actor = this.rulePack.getCurrentActor(state);
      const legal = this.rulePack.getLegalActions(state, actor);
      if (legal.length === 0) {
        this.stop();
        break;
      }

      let action: Action;
      if (legal.length === 1 && legal[0].type === 'DRAW') {
        action = legal[0];
      } else if (legal.length === 1) {
        // 如果只有一个合法动作，直接使用它（例如 AI 在换三张阶段自动选择）
        action = legal[0];
      } else {
        action = await this.decideAction(actor, state, legal);
      }

      // 记录动作
      gameLogger.logAction(state, actor, action);

      // 对所有玩家的出牌动作进行校验
      if (action.type === 'DISCARD' && this.discardValidator) {
        const validation = this.discardValidator.validateDiscard(state, actor, action.tile);
        
        if (!validation.valid) {
          console.error(`[Validator] ❌ ${actor} attempted invalid discard:`, validation.reason);
          console.error(`[Validator] This should not happen - AI or rule logic error!`);
          
          // 获取合法的出牌选项
          const legalDiscards = this.discardValidator.getLegalDiscards(state, actor);
          console.log(`[Validator] Legal discards for ${actor}:`, legalDiscards);
          
          // 对于 AI，这是一个严重错误，应该记录
          if (actor !== 'P0' || this.ss.p0IsAI) {
            console.error(`[Validator] AI ${actor} violated discard rules!`);
          }
          
          // 继续游戏但记录错误
          gameLogger.logAction(state, actor, { type: 'PASS' });
        } else {
          console.log(`[Validator] ✅ ${actor} discard validated`);
        }
      }

      const ctx: AgentDecisionContext = { style: makeAgentStyleContext(state, actor) };

      const next = this.rulePack.applyAction(state, action);
      this.state = next;
      this.gs.applyState(next);

      if (action.type === 'DISCARD' && actor !== 'P0') {
        const meldCount = state.melds[actor].length;
        const shantenBefore = shantenWithMelds(state.hands[actor], meldCount);
        const afterHand = next.hands[actor];
        const shantenAfter = shantenWithMelds(afterHand, meldCount);
        const danger = evaluateTileDanger(state, actor, action.tile);
        const snapshot = this.opponentModel.getSnapshot(state, actor);
        const topThreat = ['P0', 'P1', 'P2', 'P3']
          .filter((pid) => pid !== actor)
          .map((pid) => snapshot.threats[pid as PlayerId])
          .sort((a, b) => b.threatScore - a.threatScore)[0];
        const opponentPersonas = ['P0', 'P1', 'P2', 'P3']
          .filter((pid) => pid !== actor)
          .map((pid) => {
            const p = snapshot.personas[pid as PlayerId];
            return { playerId: pid as PlayerId, aggression: p.aggression, defense: p.defense };
          });
        recordDecisionStat({
          turn: state.turn,
          style: ctx.style.style,
          discard: tileToString(action.tile),
          shantenBefore,
          shantenAfter,
          dangerLevel: danger.level,
          topThreat: topThreat ? { playerId: topThreat.playerId, threatLevel: topThreat.threatLevel } : undefined,
          opponentPersonas,
        });
      }

      for (const ev of eventFromAction(action, next, actor)) {
        this.pushEventAndUpdateModel(ev);
      }

      if (action.type === 'DISCARD' && next.lastDiscard) {
        const resolved = await this.collectAndResolveReactions(next);
        this.state = resolved.state;
        this.gs.applyState(resolved.state);
        for (const ev of resolved.events) {
          this.pushEventAndUpdateModel(ev);
        }
      }

      if (this.ss.analysisEnabled && this.analyzer && this.state) {
        const s = this.state;
        const meldCount = s.melds.P0.length;
        const base = 13 - meldCount * 3;
        if (!s.lastDiscard && s.currentPlayer === 'P0' && s.hands.P0.length === base + 1) {
          void this.analyzer.analyzeHand(s.hands.P0, meldCount, { state: s, playerId: 'P0' });
        }
      }

      await timers.yield();
    }
  }

  private async collectAndResolveReactions(state: GameState): Promise<{ state: GameState; events: GameEvent[] }> {
    if (!state.lastDiscard) return { state, events: [] };
    const from = state.lastDiscard.from;

    const tasks = PLAYER_ORDER
      .filter((pid) => pid !== from)
      .filter((pid) => !state.declaredHu[pid])
      .map(async (pid) => {
        const legal = this.rulePack.getLegalActions(state, pid);
        if (legal.length === 0) return null;
        if (legal.length === 1 && legal[0].type === 'PASS') return null;
        const action = await this.decideAction(pid, state, legal);
        if (action.type === 'PASS') return null;
        return { playerId: pid, action };
      });

    const decided = (await Promise.all(tasks)).filter(Boolean) as Array<{ playerId: PlayerId; action: Action }>;
    return this.rulePack.resolveReactions(state, decided);
  }

  private pickAlgoAction(state: GameState, playerId: PlayerId, legal: Action[], d: Difficulty, ctx?: AgentDecisionContext): Action {
    const policy = policyForDifficulty(d);
    return policy(state, playerId, legal, ctx);
  }

  private pushEventAndUpdateModel(ev: GameEvent): void {
    this.gs.pushEvent(ev);
    if (this.state) {
      this.opponentModel.onEvent(this.state, ev);
    }
  }

  private async decideAction(actor: PlayerId, state: GameState, legal: Action[]): Promise<Action> {
    const ctx: AgentDecisionContext = {
      style: makeAgentStyleContext(state, actor),
      opponentSnapshot: this.opponentModel.getSnapshot(state, actor),
    };
    
    // 检查 P0 是否为 AI 模式
    if (actor === 'P0' && !this.ss.p0IsAI) {
      // 换三张和定缺阶段不使用超时机制，避免卡住
      const isSpecialPhase = state.phase === 'EXCHANGE' || state.phase === 'DING_QUE';
      const timeout = isSpecialPhase ? Infinity : (this.ss.timeoutEnabled ? this.ss.timeoutMs : Infinity);
      
      const res = await this.human.awaitAction(legal, timeout);
      if (res) return res;
      return this.pickAlgoAction(state, actor, legal, 'mid', ctx);
    }

    // P0 AI 模式或其他 AI 玩家 - 直接使用算法选择，无延迟
    if (actor === 'P0' && this.ss.p0IsAI) {
      // P0 AI 模式：直接使用算法决策，快速执行
      return this.pickAlgoAction(state, actor, legal, 'mid', ctx);
    }

    // 其他 AI 玩家
    return await this.agents[actor].decide(state, actor, legal, ctx);
  }
}

export const gameOrchestrator = new GameOrchestrator();
