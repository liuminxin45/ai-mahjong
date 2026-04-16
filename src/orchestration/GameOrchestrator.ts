import type { Action } from '../core/model/action';
import type { GameEvent } from '../core/model/event';
import type { GameState } from '../core/model/state';
import { PLAYER_ORDER, nextPlayerId, type PlayerId } from '../core/model/types';
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
import { setAIParams } from '../agents/algo/aiParams';
import { testConfig } from '../config/testConfig';
import { clearChatHistory } from '../ui/components/LLMChatAssistant';

// 条件日志函数 - 训练模式下禁用
const log = (...args: any[]) => {
  if (!testConfig.trainingMode) console.log(...args);
};
const warn = (...args: any[]) => {
  if (!testConfig.trainingMode) console.warn(...args);
};
const error = (...args: any[]) => {
  if (!testConfig.trainingMode) console.error(...args);
};
// 安全的alert函数 - 训练模式或Node.js环境下跳过
const safeAlert = (msg: string) => {
  if (testConfig.trainingMode) return;
  if (typeof alert === 'function') {
    alert(msg);
  } else {
    console.error('[Alert]', msg);
  }
};
import { loadParams } from '../training/paramPersistence';
import { recordGameResult, loadOnlineLearnedParams, type GameResult } from '../training/onlineLearning';
import { historyStorage } from '../llm';
import type { GameRecord } from '../llm/types';

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
  private gameStartTime: number = 0;
  private currentGameId: string = '';

  private setLastLegalActions(playerId: PlayerId, legal: Action[]): void {
    const g = globalThis as any;
    if (!g.__lastLegalActions) g.__lastLegalActions = {};
    g.__lastLegalActions[playerId] = legal.map((a: Action) => {
      if (a.type === 'DISCARD' && 'tile' in a) return `DISCARD:${tileToString(a.tile)}`;
      if (a.type === 'PENG' && 'tile' in a) return `PENG:${tileToString(a.tile)}`;
      if (a.type === 'GANG' && 'tile' in a) return `GANG:${tileToString(a.tile)}`;
      if (a.type === 'HU' && 'tile' in a && a.tile) return `HU:${tileToString(a.tile)}`;
      if (a.type === 'DING_QUE' && 'suit' in a) return `DING_QUE:${a.suit}`;
      if (a.type === 'EXCHANGE_SELECT' && 'tiles' in a) return `EXCHANGE_SELECT:${a.tiles.map(tileToString).join(',')}`;
      return a.type;
    });
  }

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

    // 重置人类代理，避免"already waiting"错误
    this.human.reset();

    // 新对局清空 AI 导师聊天记忆
    clearChatHistory();

    startMatchStat();
    this.opponentModel.init(['P0', 'P1', 'P2', 'P3']);

    // 加载训练后的 AI 参数
    try {
      const paramsFile = loadParams();

      // 使用 bestParams 而不是 params（bestParams 是训练过程中找到的最佳参数）
      const paramsToUse = paramsFile.trainingState.bestParams || paramsFile.params;
      setAIParams(paramsToUse);

      log('[GameOrchestrator] ✅ Loaded trained AI parameters');
      log('[GameOrchestrator] 📊 Best fitness:', paramsFile.trainingState.bestFitness);
      log('[GameOrchestrator] 📊 Training steps:', paramsFile.trainingState.currentStep);
      // 调试：对比 params 和 bestParams
      log('[GameOrchestrator] 📋 Using bestParams:', {
        baseWinValue: paramsToUse.baseWinValue,
        baseLoss: paramsToUse.baseLoss,
        speedBonusK: paramsToUse.speedBonusK,
      });
      if (paramsFile.params.baseWinValue !== paramsToUse.baseWinValue) {
        log('[GameOrchestrator] ⚠️ params differs from bestParams!');
      }
    } catch (err) {
      warn('[GameOrchestrator] ⚠️ Failed to load AI parameters, using defaults:', err);
    }

    // 在线学习叠加：在训练参数基础上应用在线学习的调整
    if (loadOnlineLearnedParams()) {
      log('[GameOrchestrator] 🧠 Applied online-learned adjustments on top of base params');
    }

    const selected = ruleId ?? this.ss.ruleId;
    this.rulePack = this.registry.get(selected);

    // 加载规则包的出牌校验器
    if (this.rulePack.getDiscardValidator) {
      this.discardValidator = this.rulePack.getDiscardValidator();
      if (this.discardValidator) {
        log('[GameOrchestrator] 📋 Discard validator loaded:', this.discardValidator.getDescription());
      }
    }

    const init = this.rulePack.buildInitialState();
    this.state = init;

    this.gs.reset();
    this.gs.setRunning(init);
    this.pushEventAndUpdateModel({ type: 'INIT', turn: init.turn, ts: now() });

    // 开始游戏日志记录
    this.currentGameId = makeId();
    this.gameStartTime = Date.now();
    gameLogger.startGame(this.currentGameId);
    if (this.ss.p0IsAI) {
      log('[GameOrchestrator] 🤖 P0 AI mode ENABLED - Full AI vs AI game');
    }

    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  getState(): GameState | null {
    return this.state;
  }

  isRunning(): boolean {
    return this.running;
  }

  dispatchHumanAction(action: Action): void {
    // 如果是出牌动作且有校验器，先进行校验
    if (action.type === 'DISCARD' && this.discardValidator && this.state) {
      const validation = this.discardValidator.validateDiscard(this.state, 'P0', action.tile);

      if (!validation.valid) {
        warn('[Validator] ❌ Invalid discard:', validation.reason);

        // 在 UI 上显示错误提示
        if (!testConfig.trainingMode) {
          safeAlert(`Cannot discard this tile!\n\n${validation.reason}`);
        }

        // 如果有建议的牌，显示给玩家
        if (validation.suggestedTiles && validation.suggestedTiles.length > 0) {
          log('[Validator] 💡 Suggested tiles:', validation.suggestedTiles);
        }

        return; // 阻止非法出牌
      }

      log('[Validator] ✅ Valid discard');
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
    let consecutivePassCount = 0;
    let lastStateHash = '';

    while (this.running) {
      const state = this.state;
      if (!state) break;

      // 检测无限循环：如果状态没有变化且连续处理超过 10 次
      const currentStateHash = `${state.turn}-${state.currentPlayer}-${state.lastDiscard ? 'discard' : 'nodiscard'}`;
      if (currentStateHash === lastStateHash) {
        consecutivePassCount++;
        if (consecutivePassCount > 10) {
          console.error('='.repeat(80));
          console.error('[INFINITE LOOP DETECTED] Game stuck in reaction loop!');
          console.error('='.repeat(80));
          console.error('Turn:', state.turn);
          console.error('Current player:', state.currentPlayer);
          console.error('Has lastDiscard:', !!state.lastDiscard);
          console.error('Consecutive passes:', consecutivePassCount);
          console.error('='.repeat(80));

          // 强制清除 lastDiscard 并继续
          if (state.lastDiscard) {
            warn('[LOOP FIX] Forcing lastDiscard clear and advancing game');
            const nextP = nextPlayerId(state.lastDiscard.from);
            this.state = { ...state, lastDiscard: null, currentPlayer: nextP };
            this.gs.applyState(this.state);
            consecutivePassCount = 0;
            lastStateHash = '';
            await timers.yield();
            continue;
          }

          // 没有lastDiscard时，强制推进游戏到下一个玩家
          warn('[LOOP FIX] No lastDiscard, forcing game to next player');
          const nextP = nextPlayerId(state.currentPlayer);
          this.state = { ...state, currentPlayer: nextP };
          this.gs.applyState(this.state);
          consecutivePassCount = 0;
          lastStateHash = '';
          await timers.yield();
          continue;
        }
      } else {
        consecutivePassCount = 0;
        lastStateHash = currentStateHash;
      }

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
        // 结算分数 - 调用规则包的 settleRound 方法获取最终分数
        const roundResult = this.rulePack.settleRound(state);

        const res: 'HU' | 'LOSE' | 'DRAW' = state.declaredHu.P0
          ? 'HU'
          : (['P1', 'P2', 'P3'] as PlayerId[]).some((pid) => state.declaredHu[pid])
            ? 'LOSE'
            : 'DRAW';
        finishMatchStat(res);

        // 将最终分数应用到游戏状态中
        const ended: GameState = {
          ...state,
          phase: 'END',
          // 添加结算后的分数到状态中
          ...(roundResult.scores && { roundScores: roundResult.scores })
        };
        this.state = ended;
        this.gs.applyState(ended);
        this.pushEventAndUpdateModel({ type: 'END', turn: ended.turn, ts: now() });
        this.gs.setEnded(ended);

        // 自动保存回放数据
        this.exportReplay();

        // 记录游戏结束
        gameLogger.endGame(ended, res);

        // 在线学习：记录游戏结果
        if (!this.ss.p0IsAI) {
          // 仅在人类对局时启用在线学习
          const gameResults: GameResult[] = [];
          const players: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

          // 计算排名
          const rankings = players
            .map(pid => ({
              pid,
              isWinner: ended.declaredHu[pid],
              score: (ended as any).roundScores?.[pid] || 0,
            }))
            .sort((a, b) => {
              if (a.isWinner && !b.isWinner) return -1;
              if (!a.isWinner && b.isWinner) return 1;
              return b.score - a.score;
            });

          rankings.forEach((r, idx) => {
            gameResults.push({
              playerId: r.pid,
              isWinner: r.isWinner,
              rank: idx + 1,
              scoreChange: r.score,
              turn: ended.turn,
            });
          });

          recordGameResult(gameResults);

          // 保存游戏记录到历史
          this.saveGameToHistory(ended, res).catch(err => {
            console.error('[GameOrchestrator] Failed to save game history:', err);
          });
        }

        break;
      }

      const actor = this.rulePack.getCurrentActor(state);
      let legal = this.rulePack.getLegalActions(state, actor);
      this.setLastLegalActions(actor, legal);
      const actionable = legal.filter((a) => a.type !== 'PASS');

      if (
        !state.lastDiscard &&
        actor === state.currentPlayer &&
        !state.declaredHu[actor] &&
        actionable.length === 0
      ) {
        warn('[DeadlockGuard] Detected PASS-only options for active player. Attempting recovery...');
        const recoveryAction = this.buildRecoveryAction(state, actor);
        if (recoveryAction) {
          legal = [recoveryAction];
          this.setLastLegalActions(actor, legal);
          warn('[DeadlockGuard] Recovery action selected:', recoveryAction.type);
        } else {
          error('[DeadlockGuard] Unable to recover from PASS-only state. Stopping game.');
          this.stop();
          safeAlert('Game entered invalid PASS-only state. Game stopped. Please check console for details.');
          throw new Error(`PASS-only state for ${actor} with no recovery action`);
        }
      }

      if (legal.length === 0) {
        this.stop();
        break;
      }

      let action: Action;

      // P0 人类模式：除非只能摸牌，否则始终等待用户输入，避免自动出牌
      if (actor === 'P0' && !this.ss.p0IsAI) {
        if (legal.length === 1 && legal[0].type === 'DRAW') {
          action = legal[0];
        } else {
          action = await this.decideAction(actor, state, legal);
        }
      } else if (legal.length === 1 && legal[0].type === 'DRAW') {
        action = legal[0];
      } else if (legal.length === 1) {
        // 如果只有一个合法动作，直接使用它（例如 AI 在换三张阶段自动选择）
        action = legal[0];
      } else {
        action = await this.decideAction(actor, state, legal);
      }

      if (!state.lastDiscard && actor === state.currentPlayer && action.type === 'PASS') {
        console.warn('[DeadlockGuard] Active player attempted PASS during own turn. Forcing recovery action.');
        const recoveryAction = this.buildRecoveryAction(state, actor);
        if (!recoveryAction) {
          this.stop();
          safeAlert('Game entered invalid PASS state. Game stopped. Please check console for details.');
          throw new Error(`Active player ${actor} produced PASS action during own turn with no recovery available.`);
        }
        action = recoveryAction;
      }

      // 记录动作（包含 AI 决策数据）
      const aiDecision = (globalThis as any).__aiDecision;
      gameLogger.logAction(state, actor, action, aiDecision);
      // 清除全局 AI 决策数据
      (globalThis as any).__aiDecision = undefined;

      // 对所有玩家的出牌动作进行校验
      if (action.type === 'DISCARD' && this.discardValidator) {
        const validation = this.discardValidator.validateDiscard(state, actor, action.tile);

        if (!validation.valid) {
          // 记录详细的错误信息
          const errorDetails = {
            timestamp: new Date().toISOString(),
            player: actor,
            attemptedTile: `${action.tile.suit}${action.tile.rank}`,
            reason: validation.reason,
            hand: state.hands[actor].map(t => `${t.suit}${t.rank}`).join(' '),
            legalDiscards: this.discardValidator.getLegalDiscards(state, actor).map(t => `${t.suit}${t.rank}`).join(' '),
            phase: state.phase,
            turn: state.turn,
          };

          error('='.repeat(80));
          error('[VALIDATION ERROR] Invalid discard detected!');
          error('Player:', errorDetails.player);
          error('Reason:', errorDetails.reason);
          error('='.repeat(80));

          // 记录到游戏日志
          gameLogger.logStateChange(state, `VALIDATION ERROR: ${actor} attempted invalid discard ${errorDetails.attemptedTile} - ${validation.reason}`);

          // 停止游戏
          this.stop();

          // 在 UI 上显示错误（非训练模式）
          if (!testConfig.trainingMode) {
            const errorMessage = `❌ VALIDATION ERROR\n\nPlayer: ${actor}\nAttempted: ${errorDetails.attemptedTile}\n\nReason: ${validation.reason}\n\nLegal discards: ${errorDetails.legalDiscards}\n\nGame stopped. Check console for details.`;
            safeAlert(errorMessage);
          }

          // 抛出异常
          throw new Error(`Validation failed: ${actor} attempted to discard ${errorDetails.attemptedTile}. ${validation.reason}. Legal discards: ${errorDetails.legalDiscards}`);
        }

        log(`[Validator] ✅ ${actor} discard validated`);
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
        this.setLastLegalActions(pid, legal);
        if (legal.length === 0) return null;
        if (legal.length === 1 && legal[0].type === 'PASS') {
          gameLogger.logAction(state, pid, legal[0], undefined);
          return null;
        }
        const action = await this.decideAction(pid, state, legal);
        const aiDecision = (globalThis as any).__aiDecision;
        gameLogger.logAction(state, pid, action, aiDecision);
        (globalThis as any).__aiDecision = undefined;
        if (action.type === 'PASS') return null;
        return { playerId: pid, action };
      });

    const decided = (await Promise.all(tasks)).filter(Boolean) as Array<{ playerId: PlayerId; action: Action }>;
    return this.rulePack.resolveReactions(state, decided);
  }

  private buildRecoveryAction(state: GameState, actor: PlayerId): Action | null {
    const hand = state.hands[actor];
    const meldCount = state.melds[actor].length;
    const base = 13 - meldCount * 3;

    if (hand.length === base) {
      if (state.wall.length === 0) {
        console.error('[DeadlockGuard] Wall empty during DRAW recovery');
        return null;
      }
      return { type: 'DRAW' };
    }

    if (hand.length === base + 1) {
      let candidates = [...hand];

      // If we just ponged a tile, remove it from discard candidates
      const lastMeld = state.melds[actor]?.[state.melds[actor].length - 1];
      if (lastMeld?.type === 'PENG') {
        candidates = candidates.filter(tile =>
          !(tile.suit === lastMeld.tile.suit && tile.rank === lastMeld.tile.rank)
        );
      }

      if (this.discardValidator) {
        const legalTiles = this.discardValidator.getLegalDiscards(state, actor);
        if (legalTiles.length > 0) {
          // Filter out the ponged tile from legal tiles as well
          if (lastMeld?.type === 'PENG') {
            candidates = legalTiles.filter(tile =>
              !(tile.suit === lastMeld.tile.suit && tile.rank === lastMeld.tile.rank)
            );
            // If we filtered out all legal tiles, fall back to the original legal tiles
            if (candidates.length === 0) {
              candidates = legalTiles;
            }
          } else {
            candidates = legalTiles;
          }
        }
      }

      const tile = candidates[0];
      if (!tile) {
        console.error('[DeadlockGuard] No tiles available to discard during recovery');
        return null;
      }
      return { type: 'DISCARD', tile };
    }

    console.error('[DeadlockGuard] Unexpected hand size during recovery:', hand.length, 'base:', base);
    return null;
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
      return this.pickAlgoAction(state, actor, legal, 'high', ctx);
    }

    // P0 AI 模式或其他 AI 玩家 - 直接使用算法选择，无延迟
    if (actor === 'P0' && this.ss.p0IsAI) {
      // P0 AI 模式：直接使用算法决策，快速执行
      return this.pickAlgoAction(state, actor, legal, 'high', ctx);
    }

    // 其他 AI 玩家 (P1-P3)
    // 如果 P0 不是 AI（即人类玩家），添加 2 秒延迟让游戏更自然
    // 但如果P0已经胡牌，跳过延迟快速结束游戏
    if (!this.ss.p0IsAI && (actor === 'P1' || actor === 'P2' || actor === 'P3')) {
      if (!state.declaredHu.P0) {
        await timers.sleep(2000);
      }
    }

    return await this.agents[actor].decide(state, actor, legal, ctx);
  }

  /**
   * 保存游戏记录到历史存储
   */
  private async saveGameToHistory(finalState: GameState, result: 'HU' | 'LOSE' | 'DRAW'): Promise<void> {
    try {
      const chengduState = finalState as any;
      const p0Score = chengduState.roundScores?.P0 || 0;

      // 计算游戏时长（秒）
      const duration = Math.floor((Date.now() - this.gameStartTime) / 1000);

      // 从 gameStore 获取事件
      const events = this.gs.events;

      // 计算统计数据
      const dealInCount = events.filter(
        (e: GameEvent) => e.type === 'HU' && (e as any).from === 'P0' && e.playerId !== 'P0'
      ).length;

      const meldCount = finalState.melds.P0.length;

      // 计算最终向听数
      const finalShanten = finalState.declaredHu.P0
        ? 0
        : shantenWithMelds(finalState.hands.P0, meldCount);

      // 找到胡牌回合（如果胡牌）
      const winEvent = events.find((e: GameEvent) => e.type === 'HU' && e.playerId === 'P0');
      const winTurn = winEvent?.turn || null;

      const gameRecord: GameRecord = {
        gameId: this.currentGameId,
        timestamp: new Date(this.gameStartTime),
        duration,
        result: result === 'HU' ? 'win' : result === 'LOSE' ? 'lose' : 'draw',
        score: p0Score,
        replay: {
          initialState: this.state!,
          events: events.map((ev: GameEvent) => ({
            turn: ev.turn,
            playerId: ev.playerId || 'P0',
            action: { type: ev.type } as Action,
            state: finalState,
          })),
          finalState,
        },
        stats: {
          winTurn,
          dealInCount,
          meldCount,
          finalShanten,
        },
      };

      await historyStorage.saveGame(gameRecord);
      console.log('[GameOrchestrator] Game saved to history:', this.currentGameId);
    } catch (error: any) {
      console.error('[GameOrchestrator] Failed to save game:', error);
      throw error;
    }
  }
}

export const gameOrchestrator = new GameOrchestrator();
