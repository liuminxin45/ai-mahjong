/**
 * Playtest 驱动器（Phase 6 打磨 / QA）
 *
 * 目的：在 Node 环境下无 DOM 地驱动 chengduRulePack 走完整对局，
 * 复刻 GameOrchestrator.loop() 的推进语义，用于：
 *   1. 核心循环一致性（发牌→换三张→定缺→碰杠胡→血战到底→结算）
 *   2. 不变量守卫（牌张守恒 / 手牌张数 / 定缺约束 / 分数零和）
 *   3. 难度梯度实测（high / mid / low 对抗）
 *
 * 该文件为工具模块（非 *.test.ts），不会被 vitest 当作测试用例收集。
 */
import type { Action } from '../src/core/model/action';
import type { GameState, Meld } from '../src/core/model/state';
import type { PlayerId } from '../src/core/model/types';
import type { Tile } from '../src/core/model/tile';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { decideHigh, decideMid, decideLow } from '../src/agents/algo/policy_high';
import { makeAgentStyleContext } from '../src/agents/algo/style';

export const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
export const TOTAL_TILES = 108;

export type PlaytestDifficulty = 'high' | 'mid' | 'low';

const POLICIES = {
  high: decideHigh,
  mid: decideMid,
  low: decideLow,
} as const;

export interface DriveOptions {
  seed: number;
  /** 每个座位使用的难度策略 */
  difficulty: Record<PlayerId, PlaytestDifficulty>;
  /** 步数上限，防止死循环挂住 CI */
  maxSteps?: number;
  /** 是否收集精简事件轨迹（默认 true） */
  trace?: boolean;
  /**
   * 是否复刻 GameOrchestrator 的 DeadlockGuard 兜底（默认 true）。
   * 设为 false 可暴露纯规则层的活锁（用于 BUG 复现）。
   */
  deadlockGuard?: boolean;
  /**
   * 是否执行逐步不变量检查（默认 true）。
   * 大样本难度对抗测试可设为 false 以提速（不变量已由轮次 1 覆盖）。
   */
  invariants?: boolean;
}

export interface HuRecord {
  playerId: PlayerId;
  from: PlayerId;
  tile: string;
  selfDraw: boolean;
  turn: number;
  yaku?: string[];
  score?: number;
}

export interface GameTrace {
  seed: number;
  steps: number;
  endPhase: GameState['phase'];
  endReason: 'THREE_HU' | 'WALL_EMPTY' | 'STEP_LIMIT' | 'PHASE_END';
  wallLeft: number;
  turn: number;
  huCount: number;
  declaredHu: Record<PlayerId, boolean>;
  dingQue: Record<PlayerId, 'W' | 'B' | 'T' | undefined>;
  meldCounts: Record<PlayerId, number>;
  gangCounts: Record<PlayerId, number>;
  scores: Record<PlayerId, number>;
  huRecords: HuRecord[];
  /**
   * P0 首次弃牌进入「反应结算」时的 state.turn。
   * 地胡判定（chengdu/index.ts:1131）读取的正是这一时点的 turn，
   * 与事件轨迹里 applyAction 之前的 turn 标签不同，故单独采集。
   */
  firstP0DiscardReactionTurn?: number;
  /** DeadlockGuard 兜底触发次数（>0 说明规则层无法自行推进） */
  guardFires: number;
  /** 触发兜底时的上下文快照，用于定位根因 */
  guardReasons: string[];
  /** 不变量违规（空数组 = 全部通过） */
  violations: string[];
  /** 精简事件轨迹，便于人工复现 */
  events: string[];
  /** 每阶段进入的先后顺序 */
  phaseOrder: string[];
  finalState: GameState;
}

function t(tile: Tile): string {
  return `${tile.suit}${tile.rank}`;
}

/** 一个副露实际从「手牌」中吃掉的张数（第 4/第 3 张来自弃牌堆，不计入） */
export function meldTilesFromHand(meld: Meld, owner: PlayerId): number {
  if (meld.type === 'PENG') return 2;
  // GANG：暗杠 from === 自己（4 张全来自手牌）；明杠/加杠 from === 放杠者（3 张来自手牌）
  return meld.from === owner ? 4 : 3;
}

/** 牌张守恒：wall + 全部手牌 + 全部弃牌 + 副露中来自手牌的部分 === 108 */
export function countAccountedTiles(state: GameState): number {
  let n = state.wall.length;
  for (const p of PLAYERS) {
    n += state.hands[p].length;
    n += state.discards[p].length;
    for (const m of state.melds[p]) n += meldTilesFromHand(m, p);
  }
  return n;
}

/** 全局每种牌不得超过 4 张 */
export function countTileKinds(state: GameState): Map<string, number> {
  const map = new Map<string, number>();
  const bump = (tile: Tile, times: number) => {
    const k = t(tile);
    map.set(k, (map.get(k) ?? 0) + times);
  };
  for (const w of state.wall) bump(w, 1);
  for (const p of PLAYERS) {
    for (const h of state.hands[p]) bump(h, 1);
    for (const d of state.discards[p]) bump(d, 1);
    for (const m of state.melds[p]) bump(m.tile, meldTilesFromHand(m, p));
  }
  return map;
}

function expectedHandSizes(state: GameState, p: PlayerId): number[] {
  const base = 13 - state.melds[p].length * 3;
  return [base, base + 1];
}

/**
 * 复刻 GameOrchestrator.buildRecoveryAction：
 * 手牌 == base → DRAW；== base+1 → 打出一张（排除刚碰的牌 / 遵守定缺）。
 */
export function buildRecoveryAction(state: GameState, actor: PlayerId): Action | null {
  const hand = state.hands[actor];
  const base = 13 - state.melds[actor].length * 3;

  if (hand.length === base) {
    if (state.wall.length === 0) return null;
    return { type: 'DRAW' };
  }

  if (hand.length === base + 1) {
    let candidates = [...hand];

    // 定缺优先：手上仍有缺门牌时只能打缺门牌
    const dqSuit = (state as any).dingQueSelection?.[actor] as 'W' | 'B' | 'T' | undefined;
    if (dqSuit && candidates.some((x) => x.suit === dqSuit)) {
      candidates = candidates.filter((x) => x.suit === dqSuit);
    }

    // 排除刚刚碰过的牌（applyAction 会拒绝）
    const lastPeng = (state as any).lastPengTile as Tile | undefined;
    if (lastPeng) {
      const filtered = candidates.filter(
        (x) => !(x.suit === lastPeng.suit && x.rank === lastPeng.rank),
      );
      if (filtered.length > 0) candidates = filtered;
    }

    const tile = candidates[0];
    if (!tile) return null;
    return { type: 'DISCARD', tile };
  }

  return null;
}

/**
 * 驱动一局完整对局。复刻 GameOrchestrator 的推进顺序：
 *   有 lastDiscard → resolveReactions；否则当前玩家取合法动作并 applyAction。
 */
export function driveOneGame(opts: DriveOptions): GameTrace {
  const { seed, difficulty } = opts;
  const maxSteps = opts.maxSteps ?? 4000;
  const wantTrace = opts.trace !== false;
  const useGuard = opts.deadlockGuard !== false;
  let guardFires = 0;
  let firstP0DiscardReactionTurn: number | undefined;
  const guardReasons: string[] = [];

  // 让 buildInitialState 使用可复现种子
  (globalThis as any).__trainingGameSeed = seed;
  // QA-P0-002 严格模式：harness 中 applyAction 遭遇非法动作直接抛错（契约破坏即失败）
  (globalThis as any).__chengduStrictApply = true;

  const violations: string[] = [];
  const events: string[] = [];
  const phaseOrder: string[] = [];
  const huRecords: HuRecord[] = [];

  const note = (s: string) => {
    if (wantTrace) events.push(s);
  };
  const violate = (s: string) => {
    if (violations.length < 40) violations.push(s);
  };

  // p0IsAI = true → 全 AI 对局，无需人类输入
  let state = chengduRulePack.buildInitialState(true);
  let lastPhase = '';
  let steps = 0;
  let endReason: GameTrace['endReason'] = 'STEP_LIMIT';

  const recordPhase = (s: GameState) => {
    if (s.phase !== lastPhase) {
      phaseOrder.push(s.phase);
      lastPhase = s.phase;
    }
  };
  recordPhase(state);

  const wantInvariants = opts.invariants !== false;
  const checkInvariants = (s: GameState, where: string) => {
    if (!wantInvariants) return;
    const accounted = countAccountedTiles(s);
    if (accounted !== TOTAL_TILES) {
      violate(`[TILE_CONSERVATION] ${where}: accounted=${accounted} != ${TOTAL_TILES}`);
    }
    for (const [kind, n] of countTileKinds(s)) {
      if (n > 4) violate(`[TILE_KIND_OVERFLOW] ${where}: ${kind} x${n}`);
    }
    if (s.phase === 'PLAYING') {
      for (const p of PLAYERS) {
        if (s.declaredHu[p]) continue;
        const allowed = expectedHandSizes(s, p);
        if (!allowed.includes(s.hands[p].length)) {
          violate(
            `[HAND_SIZE] ${where}: ${p} hand=${s.hands[p].length} melds=${s.melds[p].length} allowed=${allowed.join('/')}`,
          );
        }
      }
    }
  };
  checkInvariants(state, 'init');

  const dq = (s: GameState, p: PlayerId) =>
    (s as any).dingQueSelection?.[p] as 'W' | 'B' | 'T' | undefined;

  /** 胡牌必须已完成缺一门（手牌+副露均无定缺花色） */
  const assertQueOnHu = (s: GameState, p: PlayerId, winTile: Tile | undefined, where: string) => {
    const suit = dq(s, p);
    if (!suit) return;
    const all = [...s.hands[p], ...(winTile ? [winTile] : [])];
    for (const m of s.melds[p]) all.push(m.tile);
    if (all.some((x) => x.suit === suit)) {
      violate(`[HU_WITHOUT_QUE] ${where}: ${p} 定缺${suit} 但胡牌牌型仍含该花色`);
    }
  };

  while (steps < maxSteps) {
    steps++;

    if (chengduRulePack.isRoundEnd(state)) {
      endReason =
        Object.values(state.declaredHu).filter(Boolean).length >= 3
          ? 'THREE_HU'
          : state.wall.length === 0
            ? 'WALL_EMPTY'
            : 'PHASE_END';
      break;
    }

    // 抢杠胡反应窗口（复刻 GameOrchestrator.collectAndResolveReactions 的驱动语义）：
    // 加杠落地后 lastAddedGangTile 非空，必须先收集反应并调用 resolveReactions，
    // 否则窗口永不关闭（QA-P0-001 在 harness 侧的根因）。
    const pendingAddedGang = (state as any).lastAddedGangTile as
      | { tile: Tile; from: PlayerId }
      | undefined;
    if (pendingAddedGang && !state.lastDiscard) {
      const reactions: Array<{ playerId: PlayerId; action: Action }> = [];
      for (const pid of PLAYERS) {
        if (pid === pendingAddedGang.from) continue; // 加杠者本人不参与抢杠
        if (state.declaredHu[pid]) continue;
        const legal = chengduRulePack.getLegalActions(state, pid);
        if (legal.length === 0) continue;
        if (legal.length === 1 && legal[0].type === 'PASS') continue;
        const ctx = { style: makeAgentStyleContext(state, pid) };
        const action = POLICIES[difficulty[pid]](state, pid, legal, ctx);
        if (action.type === 'PASS') continue;
        reactions.push({ playerId: pid, action });
      }
      const resolved = chengduRulePack.resolveReactions(state, reactions);
      state = resolved.state;
      recordPhase(state);
      checkInvariants(state, `afterQiangGang@step${steps}`);
      continue;
    }

    if (state.lastDiscard) {
      const discard = state.lastDiscard;
      // 采集地胡判定时点的 turn（resolveReactions 读取的就是此刻的 state.turn）
      if (discard.from === 'P0' && firstP0DiscardReactionTurn === undefined) {
        firstP0DiscardReactionTurn = state.turn;
      }
      const reactions: Array<{ playerId: PlayerId; action: Action }> = [];
      for (const pid of PLAYERS) {
        if (pid === discard.from) continue;
        if (state.declaredHu[pid]) continue;
        const legal = chengduRulePack.getLegalActions(state, pid);
        if (legal.length === 0) continue;
        if (legal.length === 1 && legal[0].type === 'PASS') continue;
        const ctx = { style: makeAgentStyleContext(state, pid) };
        const action = POLICIES[difficulty[pid]](state, pid, legal, ctx);
        if (action.type === 'PASS') continue;
        reactions.push({ playerId: pid, action });
      }

      for (const r of reactions) {
        if (r.action.type === 'HU') {
          assertQueOnHu(state, r.playerId, discard.tile, 'ron');
          huRecords.push({
            playerId: r.playerId,
            from: discard.from,
            tile: t(discard.tile),
            selfDraw: false,
            turn: state.turn,
          });
          note(`turn${state.turn} ${r.playerId} HU(点炮) ${t(discard.tile)} from ${discard.from}`);
        } else if (r.action.type === 'PENG') {
          note(`turn${state.turn} ${r.playerId} PENG ${t(r.action.tile)}`);
        } else if (r.action.type === 'GANG') {
          note(`turn${state.turn} ${r.playerId} GANG(${r.action.gangType}) ${t(r.action.tile)}`);
        }
      }

      const resolved = chengduRulePack.resolveReactions(state, reactions);
      state = resolved.state;
      for (const ev of resolved.events) {
        if (ev.type === 'HU') {
          const meta = (ev as any).meta;
          const rec = huRecords.find((h) => h.playerId === ev.playerId && h.turn === ev.turn);
          if (rec && meta) {
            rec.yaku = (meta.yakuList ?? []).map((y: any) => `${y.type}(${y.fan})`);
            rec.score = meta.score;
          }
        }
      }
      recordPhase(state);
      checkInvariants(state, `afterReactions@step${steps}`);
      continue;
    }

    const actor = chengduRulePack.getCurrentActor(state);
    let legal = chengduRulePack.getLegalActions(state, actor);
    if (legal.length === 0) {
      violate(`[NO_LEGAL_ACTION] step${steps}: ${actor} phase=${state.phase} hand=${state.hands[actor].length}`);
      break;
    }

    // 复刻 GameOrchestrator 的 DeadlockGuard：
    // 当前行动者只剩 PASS（规则层无法推进）时，强制注入 DRAW / DISCARD 兜底
    const actionable = legal.filter((a) => a.type !== 'PASS');
    if (useGuard && !state.declaredHu[actor] && actionable.length === 0) {
      const recovery = buildRecoveryAction(state, actor);
      if (!recovery) {
        violate(`[UNRECOVERABLE] step${steps}: ${actor} 仅剩 PASS 且无法兜底`);
        break;
      }
      guardFires++;
      if (guardReasons.length < 20) {
        const cs = state as any;
        guardReasons.push(
          `step${steps} ${actor} 仅剩PASS → 兜底${recovery.type}` +
            ` | lastAddedGangTile=${cs.lastAddedGangTile ? t(cs.lastAddedGangTile.tile) + '<' + cs.lastAddedGangTile.from : '-'}` +
            ` | lastPengTile=${cs.lastPengTile ? t(cs.lastPengTile) : '-'}` +
            ` | hand=${state.hands[actor].length} melds=${state.melds[actor].length}`,
        );
      }
      legal = [recovery];
    }

    let action: Action;
    if (legal.length === 1) {
      action = legal[0];
    } else {
      const ctx = { style: makeAgentStyleContext(state, actor) };
      action = POLICIES[difficulty[actor]](state, actor, legal, ctx);
    }

    // 定缺约束守卫：手上还有定缺花色时，出牌必须是定缺花色
    if (action.type === 'DISCARD' && state.phase === 'PLAYING') {
      const suit = dq(state, actor);
      if (suit && state.hands[actor].some((x) => x.suit === suit) && action.tile.suit !== suit) {
        violate(
          `[DINGQUE_DISCARD] step${steps}: ${actor} 定缺${suit} 手上仍有缺门牌却打出 ${t(action.tile)}`,
        );
      }
    }

    if (action.type === 'HU') {
      assertQueOnHu(state, actor, undefined, 'tsumo');
      huRecords.push({
        playerId: actor,
        from: actor,
        tile: action.tile ? t(action.tile) : '?',
        selfDraw: true,
        turn: state.turn,
      });
      note(`turn${state.turn} ${actor} HU(自摸) ${action.tile ? t(action.tile) : '?'}`);
    } else if (action.type === 'DING_QUE') {
      note(`DING_QUE ${actor} -> ${action.suit}`);
    } else if (action.type === 'EXCHANGE_SELECT') {
      note(`EXCHANGE ${actor} -> ${action.tiles.map(t).join(',')}`);
    } else if (action.type === 'GANG') {
      note(`turn${state.turn} ${actor} GANG(${action.gangType}) ${t(action.tile)}`);
    } else if (action.type === 'DISCARD') {
      note(`turn${state.turn} ${actor} DISCARD ${t(action.tile)}`);
    }

    const before = state;
    state = chengduRulePack.applyAction(state, action);

    // applyAction 返回同一对象（未推进）时视为卡死信号
    if (state === before && action.type !== 'PASS') {
      violate(
        `[ACTION_NOOP] step${steps}: ${actor} ${action.type}` +
          `${(action as any).tile ? ' ' + t((action as any).tile) : ''} 未改变状态（getLegalActions 提供了 applyAction 拒绝的动作）`,
      );
      if (!useGuard) break;
      // 复刻 orchestrator：用兜底动作强行推进
      const forced = buildRecoveryAction(state, actor);
      if (!forced) break;
      guardFires++;
      state = chengduRulePack.applyAction(state, forced);
      if (state === before) break;
    }

    recordPhase(state);
    checkInvariants(state, `after${action.type}@step${steps}`);
  }

  const settled = chengduRulePack.settleRound(state);
  const scores = settled.scores as Record<PlayerId, number>;

  const sum = PLAYERS.reduce((a, p) => a + (scores?.[p] ?? 0), 0);
  if (sum !== 0) violate(`[SCORE_NOT_ZERO_SUM] Σscores=${sum} (${JSON.stringify(scores)})`);

  const meldCounts = {} as Record<PlayerId, number>;
  const gangCounts = {} as Record<PlayerId, number>;
  const dingQue = {} as Record<PlayerId, 'W' | 'B' | 'T' | undefined>;
  for (const p of PLAYERS) {
    meldCounts[p] = state.melds[p].length;
    gangCounts[p] = state.melds[p].filter((m) => m.type === 'GANG').length;
    dingQue[p] = dq(state, p);
  }

  return {
    seed,
    steps,
    endPhase: state.phase,
    endReason,
    wallLeft: state.wall.length,
    turn: state.turn,
    huCount: Object.values(state.declaredHu).filter(Boolean).length,
    declaredHu: { ...state.declaredHu },
    dingQue,
    meldCounts,
    gangCounts,
    scores,
    huRecords,
    firstP0DiscardReactionTurn,
    guardFires,
    guardReasons,
    violations,
    events,
    phaseOrder,
    finalState: state,
  };
}

export function uniformDifficulty(d: PlaytestDifficulty): Record<PlayerId, PlaytestDifficulty> {
  return { P0: d, P1: d, P2: d, P3: d };
}

/** 静音 console，同时统计各通道调用次数（用于检测热路径日志噪声） */
export function withSilencedConsole<T>(fn: () => T): { result: T; counts: Record<string, number> } {
  const counts: Record<string, number> = { log: 0, warn: 0, error: 0 };
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => { counts.log++; };
  console.warn = () => { counts.warn++; };
  console.error = () => { counts.error++; };
  try {
    const result = fn();
    return { result, counts };
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}
