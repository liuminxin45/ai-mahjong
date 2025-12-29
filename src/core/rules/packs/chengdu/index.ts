import type { Action } from '../../../model/action';
import type { GameEvent } from '../../../model/event';
import type { GameState, Meld } from '../../../model/state';
import type { Tile } from '../../../model/tile';
import { nextPlayerId, type PlayerId } from '../../../model/types';
import type { RulePack, RoundResult } from '../../RulePack';
import type { DiscardValidator } from '../../validation/types';
import { placeholderRulePack } from '../placeholder';
import { ruleConfig } from './rule.config';
import { findWinPatterns, detectYaku, calculateScore, hasQueYiMen } from './patterns';
import { validateExchangeTiles, performExchange, removeTilesFromHand } from './exchange';
import { selectExchangeTiles, selectDingQueSuit } from './aiStrategy';
import { sortTiles } from './sort';
import { settingsStore } from '../../../../store/settingsStore';
import { createChengduValidator } from './validator';
import { tileEq, removeNTiles, removeTile, countTile, canUpgradeToGang, isLastTileInWall } from './utils';
import { testConfig } from '../../../../config/testConfig';

// 条件日志函数 - 训练模式下禁用
const log = (...args: any[]) => {
  if (!testConfig.trainingMode) console.log(...args);
};
const warn = (...args: any[]) => {
  if (!testConfig.trainingMode) console.warn(...args);
};

const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

function isTileInMissingSuit(tile: Tile, missingSuit: 'W' | 'B' | 'T' | undefined): boolean {
  return !!missingSuit && tile.suit === missingSuit;
}

type DealInStat = { count: number; stageB: number; stageC: number };
type DealInStats = Record<PlayerId, DealInStat>;

function createZeroScores(): Record<PlayerId, number> {
  return { P0: 0, P1: 0, P2: 0, P3: 0 };
}

function inheritChengduState(prev: ChengduState, next: GameState): ChengduState {
  const nextChengdu = next as ChengduState;
  const merged: ChengduState = {
    ...nextChengdu,
    roundScores: nextChengdu.roundScores ?? prev.roundScores,
    dealInStats: nextChengdu.dealInStats ?? prev.dealInStats,
    exchangeSelections: nextChengdu.exchangeSelections ?? prev.exchangeSelections,
    exchangeConfirmed: nextChengdu.exchangeConfirmed ?? prev.exchangeConfirmed,
    dingQueSelection: nextChengdu.dingQueSelection ?? prev.dingQueSelection,
    lastGangPlayer: nextChengdu.lastGangPlayer ?? prev.lastGangPlayer,
    isAfterGang: nextChengdu.isAfterGang ?? prev.isAfterGang,
    lastAddedGangTile: nextChengdu.lastAddedGangTile ?? prev.lastAddedGangTile,
    pendingEvents: nextChengdu.pendingEvents ?? prev.pendingEvents,
    lastPengTile: nextChengdu.lastPengTile ?? prev.lastPengTile,
  };

  // 保持phase不变，包括END阶段
  merged.phase = next.phase;

  return merged;
}

function createDealInStats(): DealInStats {
  return {
    P0: { count: 0, stageB: 0, stageC: 0 },
    P1: { count: 0, stageB: 0, stageC: 0 },
    P2: { count: 0, stageB: 0, stageC: 0 },
    P3: { count: 0, stageB: 0, stageC: 0 },
  };
}

function cloneScores(scores: Record<PlayerId, number>): Record<PlayerId, number> {
  return {
    P0: scores.P0,
    P1: scores.P1,
    P2: scores.P2,
    P3: scores.P3,
  };
}

function cloneDealIns(dealIns: DealInStats): DealInStats {
  return {
    P0: { ...dealIns.P0 },
    P1: { ...dealIns.P1 },
    P2: { ...dealIns.P2 },
    P3: { ...dealIns.P3 },
  };
}

function ensureRoundTracking(state: ChengduState): void {
  if (!state.roundScores) {
    state.roundScores = createZeroScores();
  }
  if (!state.dealInStats) {
    state.dealInStats = createDealInStats();
  }
}

function addScore(state: ChengduState, playerId: PlayerId, delta: number): void {
  ensureRoundTracking(state);
  state.roundScores![playerId] += delta;
}

function applyGangRainMoney(
  state: ChengduState,
  gangPlayer: PlayerId,
  gangType: 'AN' | 'MING' | 'JIA',
  from?: PlayerId,
): void {
  ensureRoundTracking(state);

  if (gangType === 'AN') {
    // 暗杠：收所有人雨钱 10 分
    for (const pid of PLAYERS) {
      if (pid === gangPlayer) continue;
      addScore(state, gangPlayer, 10);
      addScore(state, pid, -10);
    }
    return;
  }

  if (!from) return;

  if (gangType === 'MING') {
    // 明杠：收点杠人雨钱 10 分
    addScore(state, gangPlayer, 10);
    addScore(state, from, -10);
    return;
  }

  if (gangType === 'JIA') {
    // 贴杠：收点杠人雨钱 5 分（点杠人指最初提供碰的玩家）
    addScore(state, gangPlayer, 5);
    addScore(state, from, -5);
  }
}

function recordDealIn(state: ChengduState, playerId: PlayerId, stage: 'A' | 'B' | 'C'): void {
  ensureRoundTracking(state);
  const stats = state.dealInStats![playerId];
  stats.count += 1;
  if (stage === 'B') stats.stageB += 1;
  if (stage === 'C') stats.stageC += 1;
}

function getDealInStage(state: GameState, playerId: PlayerId): 'A' | 'B' | 'C' {
  if (state.declaredHu[playerId]) return 'C';
  const hasOtherWinners = PLAYERS.some((pid) => pid !== playerId && state.declaredHu[pid]);
  return hasOtherWinners ? 'B' : 'A';
}

function applyRonOutcome(
  state: ChengduState,
  winner: PlayerId,
  from: PlayerId,
  score: number,
  snapshot: GameState,
): void {
  if (score <= 0) return;
  addScore(state, winner, score);
  addScore(state, from, -score);
  recordDealIn(state, from, getDealInStage(snapshot, from));
}

function applySelfDrawOutcome(state: ChengduState, winner: PlayerId, score: number): void {
  if (score <= 0) return;
  ensureRoundTracking(state);
  addScore(state, winner, score);
  const losers = PLAYERS.filter((pid) => pid !== winner && !state.declaredHu[pid]);
  if (losers.length === 0) return;
  let remaining = score;
  const base = Math.floor(score / losers.length);
  for (let i = 0; i < losers.length; i++) {
    let loss = base;
    if (i === losers.length - 1) {
      loss = remaining;
    } else {
      remaining -= base;
    }
    addScore(state, losers[i], -loss);
  }
}

function evaluateSelfDrawScore(state: GameState, playerId: PlayerId, isGangShangKaiHua: boolean): number {
  const hand = state.hands[playerId];
  if (!hand || hand.length === 0) return 0;
  const winTile = hand[hand.length - 1];
  const patterns = findWinPatterns(hand);
  const validPattern = patterns && patterns.find((p) => p && p.isValid);
  if (!validPattern) return 0;
  const gangCount = state.melds[playerId].filter((m) => m.type === 'GANG').length;
  const isTianHu = playerId === 'P0' && state.turn === 0;
  const yakuList = detectYaku(
    validPattern,
    hand,
    winTile,
    true,
    state.melds[playerId].length,
    isGangShangKaiHua,
    false,
    isLastTileInWall(state),
    isTianHu,
    false,
  );
  return calculateScore(yakuList, gangCount);
}

type ChengduState = GameState & {
  lastGangPlayer?: PlayerId;
  isAfterGang?: boolean;
  lastAddedGangTile?: { tile: Tile; from: PlayerId };
  pendingEvents?: GameEvent[];
  lastPengTile?: Tile;
  roundScores?: Record<PlayerId, number>;
  dealInStats?: DealInStats;
  // 换三张相关状态
  exchangeSelections?: Record<PlayerId, Tile[]>;
  exchangeConfirmed?: Record<PlayerId, boolean>;
  // 定缺相关状态
  dingQueSelection?: Record<PlayerId, 'W' | 'B' | 'T' | undefined>;
};

function validateHandSize(hand: Tile[], meldCount: number, expectedExtra: number): boolean {
  const expectedSize = 13 - meldCount * 3 + expectedExtra;
  if (hand.length !== expectedSize) {
    warn(`[Validation] Hand size mismatch: expected ${expectedSize}, got ${hand.length}`);
  }
  return true;
}

function nextActivePlayer(state: GameState, from: PlayerId): PlayerId {
  let p = nextPlayerId(from);
  for (let i = 0; i < 4; i++) {
    if (!state.declaredHu[p]) return p;
    p = nextPlayerId(p);
  }
  return nextPlayerId(from);
}

function now(): number {
  return Date.now();
}

// 带种子的随机数生成器（用于训练）
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * 使用 crypto API 生成高质量随机数
 */
function cryptoRandomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % (max + 1);
  }
  // 降级到 Math.random
  return Math.floor(Math.random() * (max + 1));
}

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  const rng = seed !== undefined ? new SeededRandom(seed) : null;
  
  for (let i = a.length - 1; i > 0; i--) {
    // 有种子时使用伪随机（训练可复现），否则使用 crypto 高质量随机
    const j = rng ? rng.nextInt(0, i) : cryptoRandomInt(i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 全局游戏计数器，确保每次游戏种子都不一样
let gameCounter = 0;

export const chengduRulePack: RulePack = {
  ...placeholderRulePack,
  id: ruleConfig.id,
  version: ruleConfig.version,

  getDiscardValidator(): DiscardValidator {
    return createChengduValidator();
  },

  buildInitialState(): GameState {
    // 使用训练器传递的种子或生成新种子
    const trainingSeed = (globalThis as any).__trainingGameSeed;
    const seed = trainingSeed !== undefined ? trainingSeed : Date.now() + Math.random() * 1000000;
    log(`[GameInit] Game #${gameCounter}, seed: ${seed} (training: ${trainingSeed !== undefined})`);
    
    // 重新洗牌手牌
    const tiles = shuffle(this.getTileSet(), seed);
    
    const hands: Record<PlayerId, Tile[]> = {
      P0: [],
      P1: [],
      P2: [],
      P3: [],
    };

    let wall = tiles;
    for (let i = 0; i < 13; i++) {
      for (const pid of ['P0', 'P1', 'P2', 'P3'] as PlayerId[]) {
        const t = wall[0];
        if (!t) {
          break;
        }
        hands[pid] = hands[pid].concat([t]);
        wall = wall.slice(1);
      }
    }

    return {
      wall,
      hands,
      discards: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
      melds: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
      lastDiscard: null,
      declaredHu: {
        P0: false,
        P1: false,
        P2: false,
        P3: false,
      },
      currentPlayer: 'P0',
      phase: 'EXCHANGE',
      turn: 0,
      exchangeSelections: { P0: [], P1: [], P2: [], P3: [] },
      exchangeConfirmed: { P0: false, P1: false, P2: false, P3: false },
      dingQueSelection: { P0: undefined, P1: undefined, P2: undefined, P3: undefined },
      // 初始化计分和放炮统计，确保训练时能正确提取
      roundScores: createZeroScores(),
      dealInStats: createDealInStats(),
    } as ChengduState;
  },

  getLegalActions(state: GameState, player: PlayerId): Action[] {
    const chengduState = state as ChengduState;

    // 换三张阶段
    if (state.phase === 'EXCHANGE') {
      const selections = chengduState.exchangeSelections?.[player] || [];
      const confirmed = chengduState.exchangeConfirmed?.[player] || false;

      if (confirmed) {
        return [{ type: 'PASS' }];
      }

      if (selections.length === 3) {
        return [{ type: 'EXCHANGE_CONFIRM' }];
      }

      // AI 玩家（包括 P0 AI 模式）智能选择换三张的牌
      log(`[Exchange] ${player} checking AI mode: p0IsAI=${settingsStore.p0IsAI}, player=${player}`);
      
      if (player !== 'P0' || settingsStore.p0IsAI) {
        const hand = state.hands[player];
        const selectedTiles = selectExchangeTiles(hand);
        if (selectedTiles.length === 3) {
          log(`[Exchange] ${player} AI selecting tiles:`, selectedTiles.map(t => `${t.suit}${t.rank}`).join(', '));
          return [{ type: 'EXCHANGE_SELECT', tiles: selectedTiles }];
        }
      } else {
        log(`[Exchange] ${player} is human player, returning manual selection options`);
        // 人类玩家：返回所有可能的3张同花色组合
        const hand = state.hands[player];
        const legalActions: Action[] = [];
        
        const suits = ['W', 'B', 'T'] as const;
        for (const suit of suits) {
          const sameSuitTiles = hand.filter(t => t.suit === suit);
          if (sameSuitTiles.length >= 3) {
            // 为简化，只返回前3张作为一个选项
            legalActions.push({ type: 'EXCHANGE_SELECT', tiles: sameSuitTiles.slice(0, 3) });
          }
        }
        
        if (legalActions.length > 0) {
          return legalActions;
        }
      }

      return [{ type: 'PASS' }];
    }

    // 定缺阶段
    if (state.phase === 'DING_QUE') {
      const dingQue = chengduState.dingQueSelection?.[player];
      if (dingQue) {
        return [{ type: 'PASS' }];
      }
      
      // AI 玩家（包括 P0 AI 模式）智能选择定缺花色
      if (player !== 'P0' || settingsStore.p0IsAI) {
        const hand = state.hands[player];
        const selectedSuit = selectDingQueSuit(hand);
        log(`[DingQue] ${player} AI selecting missing suit: ${selectedSuit}`);
        return [{ type: 'DING_QUE', suit: selectedSuit }];
      }
      
      return [
        { type: 'DING_QUE', suit: 'W' },
        { type: 'DING_QUE', suit: 'B' },
        { type: 'DING_QUE', suit: 'T' },
      ];
    }

    if (state.phase !== 'PLAYING') return [];
    if (state.declaredHu[player]) return [{ type: 'PASS' }];

    // 抢杠胡响应窗口
    if (chengduState.lastAddedGangTile) {
      const { tile, from } = chengduState.lastAddedGangTile;
      if (player === from) return [{ type: 'PASS' }];

      const legal: Action[] = [{ type: 'PASS' }];
      const testHand = state.hands[player].concat([tile]);
      const patterns = findWinPatterns(testHand);
      const canWin = patterns && patterns.some(p => p && p.isValid);
      // 缺一门验证
      const missingSuit = chengduState.dingQueSelection?.[player];
      const hasQue = hasQueYiMen(testHand, state.melds[player], missingSuit);
      if (canWin && hasQue) legal.push({ type: 'HU', tile, from });

      return legal;
    }

    // 出牌后的响应
    if (state.lastDiscard) {
      const { tile, from } = state.lastDiscard;
      if (player === from) return [{ type: 'PASS' }];

      const legal: Action[] = [{ type: 'PASS' }];

      const testHand = state.hands[player].concat([tile]);
      const patterns = findWinPatterns(testHand);
      const canWin = patterns && patterns.some(p => p && p.isValid);
      // 缺一门验证
      const missingSuit = chengduState.dingQueSelection?.[player];
      const hasQue = hasQueYiMen(testHand, state.melds[player], missingSuit);
      if (canWin && hasQue) legal.push({ type: 'HU', tile, from });

      const inHand = countTile(state.hands[player], tile);
      if (inHand >= 3) {
        const missingSuit = chengduState.dingQueSelection?.[player];
        if (!isTileInMissingSuit(tile, missingSuit)) {
          legal.push({ type: 'GANG', tile, from, gangType: 'MING' });
        }
      }
      if (inHand >= 2) {
        legal.push({ type: 'PENG', tile, from });
      }

      return legal;
    }

    // 当前玩家的动作
    const baseActions = placeholderRulePack.getLegalActions(state, player);
    if (state.currentPlayer !== player) return baseActions;

    const hand = state.hands[player];
    const meldCount = state.melds[player].length;
    const baseHandSize = 13 - meldCount * 3;

    if (hand.length === baseHandSize + 1) {
      // 自摸胡
      const patterns = findWinPatterns(hand);
      const canWin = patterns && patterns.some(p => p && p.isValid);
      // 缺一门验证
      const missingSuit = chengduState.dingQueSelection?.[player];
      const hasQue = hasQueYiMen(hand, state.melds[player], missingSuit);
      console.log(`[自摸检测] ${player} hand.length=${hand.length}, baseHandSize=${baseHandSize}, meldCount=${meldCount}`);
      console.log(`[自摸检测] ${player} canWin=${canWin}, hasQue=${hasQue}, missingSuit=${missingSuit}`);
      if (canWin && hasQue) {
        baseActions.push({ type: 'HU', tile: hand[hand.length - 1], from: player });
        console.log(`[自摸检测] ${player} 添加自摸动作`);
      }

      // 暗杠和加杠
      const dingQueSuit = chengduState.dingQueSelection?.[player];
      console.log(`[暗杠检测] ${player} 手牌:`, hand.map(t => `${t.suit}${t.rank}`).join(' '));
      console.log(`[暗杠检测] ${player} 定缺花色:`, dingQueSuit || '未定缺');
      
      for (const tile of hand) {
        const count = countTile(hand, tile);
        if (count === 4) {
          console.log(`[暗杠检测] ${player} 检测到4张: ${tile.suit}${tile.rank}, 定缺检查:`, isTileInMissingSuit(tile, dingQueSuit) ? '是定缺花色，禁止暗杠' : '非定缺花色，允许暗杠');
          if (!isTileInMissingSuit(tile, dingQueSuit)) {
            baseActions.push({ type: 'GANG', tile, from: player, gangType: 'AN' });
            console.log(`[暗杠检测] ${player} 添加暗杠动作: ${tile.suit}${tile.rank}`);
          }
        }
        if (canUpgradeToGang(state, player, tile)) {
          if (!isTileInMissingSuit(tile, dingQueSuit)) {
            baseActions.push({ type: 'GANG', tile, from: player, gangType: 'JIA' });
          }
        }
      }
      
      // 成都规则：必须先打完缺门的牌
      if (dingQueSuit) {
        const missingSuitTiles = hand.filter(t => t.suit === dingQueSuit);
        if (missingSuitTiles.length > 0) {
          console.log(`[暗杠检测] ${player} 有缺门牌 ${dingQueSuit}，应用过滤逻辑`);
          // 有缺门的牌，只能打缺门的牌
          const discardActions = baseActions.filter(a => 
            a.type === 'DISCARD' && a.tile.suit === dingQueSuit
          );
          // 保留所有非出牌动作（胡、杠等）
          const nonDiscardActions = baseActions.filter(a => a.type !== 'DISCARD');
          console.log(`[暗杠检测] ${player} 最终动作:`, nonDiscardActions.map(a => {
            if (a.type === 'GANG') return `${a.type}:${(a as any).tile?.suit}${(a as any).tile?.rank}(${(a as any).gangType})`;
            if (a.type === 'HU') return `${a.type}:${(a as any).tile?.suit}${(a as any).tile?.rank}`;
            return a.type;
          }).join(', '));
          return [...nonDiscardActions, ...discardActions];
        }
      }
      
      console.log(`[暗杠检测] ${player} 最终动作(无过滤):`, baseActions.map(a => {
        if (a.type === 'GANG') return `${a.type}:${(a as any).tile?.suit}${(a as any).tile?.rank}(${(a as any).gangType})`;
        if (a.type === 'HU') return `${a.type}:${(a as any).tile?.suit}${(a as any).tile?.rank}`;
        return a.type;
      }).join(', '));
    }

    return baseActions;
  },

  applyAction(state: GameState, action: Action): GameState {
    const chengduState = state as ChengduState;

    // 换三张选择
    if (action.type === 'EXCHANGE_SELECT' && state.phase === 'EXCHANGE') {
      const player = state.currentPlayer;
      const tiles = action.tiles;

      log(`[EXCHANGE_SELECT] ${player} selecting tiles:`, tiles.map(t => `${t.suit}${t.rank}`).join(', '));
      log(`[EXCHANGE_SELECT] ${player} hand before:`, state.hands[player].map(t => `${t.suit}${t.rank}`).join(' '));

      if (tiles.length !== 3) {
        warn('[EXCHANGE_SELECT] Failed: Must select exactly 3 tiles, got', tiles.length);
        return state;
      }

      if (!validateExchangeTiles(tiles)) {
        warn('[EXCHANGE_SELECT] Failed: Exchange tiles must be same suit', tiles);
        return state;
      }

      log(`[EXCHANGE_SELECT] ✅ ${player} tiles saved successfully`);
      
      // 保存选择后，不切换玩家，等待当前玩家确认
      return {
        ...state,
        exchangeSelections: {
          ...chengduState.exchangeSelections,
          [player]: tiles,
        },
      } as ChengduState;
    }

    // 换三张确认
    if (action.type === 'EXCHANGE_CONFIRM' && state.phase === 'EXCHANGE') {
      const player = state.currentPlayer;
      
      log(`[EXCHANGE_CONFIRM] ${player} confirming exchange`);
      log(`[EXCHANGE_CONFIRM] ${player} selected:`, chengduState.exchangeSelections?.[player]?.map(t => `${t.suit}${t.rank}`).join(', '));
      
      const newState = {
        ...state,
        exchangeConfirmed: {
          ...chengduState.exchangeConfirmed,
          [player]: true,
        },
        // 切换到下一个玩家
        currentPlayer: nextPlayerId(player),
      } as ChengduState;

      const allConfirmed = Object.values(newState.exchangeConfirmed!).every(c => c);
      log(`[EXCHANGE_CONFIRM] Confirmed: P0=${newState.exchangeConfirmed!.P0}, P1=${newState.exchangeConfirmed!.P1}, P2=${newState.exchangeConfirmed!.P2}, P3=${newState.exchangeConfirmed!.P3}`);
      log(`[EXCHANGE_CONFIRM] All confirmed? ${allConfirmed}`);

      if (allConfirmed) {
        log('[EXCHANGE] 🔄 All players confirmed, performing exchange (CLOCKWISE)');
        
        const exchanged = performExchange(
          newState.exchangeSelections!,
          'CLOCKWISE'
        );

        const newHands = { ...newState.hands };
        for (const [pid, tiles] of Object.entries(exchanged)) {
          const playerId = pid as PlayerId;
          log(`[EXCHANGE] ${playerId} sending:`, newState.exchangeSelections![playerId].map(t => `${t.suit}${t.rank}`).join(', '));
          log(`[EXCHANGE] ${playerId} receiving:`, tiles.map(t => `${t.suit}${t.rank}`).join(', '));
          
          const remaining = removeTilesFromHand(
            newHands[playerId],
            newState.exchangeSelections![playerId]
          );
          if (remaining) {
            // 换三张后自动排序手牌
            newHands[playerId] = sortTiles([...remaining, ...tiles]);
            log(`[EXCHANGE] ${playerId} hand after:`, newHands[playerId].map(t => `${t.suit}${t.rank}`).join(' '));
          }
        }

        log('[EXCHANGE] ✅ Exchange complete, transitioning to DING_QUE phase');

        return {
          ...newState,
          hands: newHands,
          phase: 'DING_QUE',
          exchangeSelections: undefined,
          exchangeConfirmed: undefined,
          dingQueSelection: { P0: undefined, P1: undefined, P2: undefined, P3: undefined },
        } as ChengduState;
      }

      return newState;
    }

    // 定缺
    if (action.type === 'DING_QUE' && state.phase === 'DING_QUE') {
      const player = state.currentPlayer;
      
      log(`[DING_QUE] ${player} selecting missing suit: ${action.suit}`);
      log(`[DING_QUE] ${player} hand:`, state.hands[player].map(t => `${t.suit}${t.rank}`).join(' '));
      
      // 统计花色数量
      const suitCounts = { W: 0, B: 0, T: 0 };
      for (const tile of state.hands[player]) {
        if (tile.suit === 'W' || tile.suit === 'B' || tile.suit === 'T') {
          suitCounts[tile.suit]++;
        }
      }
      log(`[DING_QUE] ${player} suit counts: W=${suitCounts.W}, B=${suitCounts.B}, T=${suitCounts.T}`);
      
      const newState = {
        ...state,
        dingQueSelection: {
          ...chengduState.dingQueSelection,
          [player]: action.suit,
        },
        // 切换到下一个玩家
        currentPlayer: nextPlayerId(player),
      } as ChengduState;

      const allSelected = Object.values(newState.dingQueSelection!).every(s => s !== undefined);
      log(`[DING_QUE] Selected: P0=${newState.dingQueSelection!.P0 || 'pending'}, P1=${newState.dingQueSelection!.P1 || 'pending'}, P2=${newState.dingQueSelection!.P2 || 'pending'}, P3=${newState.dingQueSelection!.P3 || 'pending'}`);
      log(`[DING_QUE] All selected? ${allSelected}`);

      if (allSelected) {
        log('[DING_QUE] ✅ All players selected, transitioning to PLAYING phase');
        log(`[DING_QUE] Final: P0 missing ${newState.dingQueSelection!.P0}, P1 missing ${newState.dingQueSelection!.P1}, P2 missing ${newState.dingQueSelection!.P2}, P3 missing ${newState.dingQueSelection!.P3}`);
        return {
          ...newState,
          phase: 'PLAYING',
          currentPlayer: 'P0', // 重置为庄家开始
          dingQueSelection: newState.dingQueSelection,
        } as ChengduState;
      }

      return newState;
    }

    // 暗杠处理（带事件记录和验证）
    if (action.type === 'GANG' && action.gangType === 'AN' && state.currentPlayer === action.from) {
      const hand = state.hands[action.from];
      const meldCount = state.melds[action.from].length;

      // 成都规则：不能暗杠定缺花色
      const dingQueSuit = chengduState.dingQueSelection?.[action.from];
      if (isTileInMissingSuit(action.tile, dingQueSuit)) return state;
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) return state;
      
      // 状态一致性：先检查牌墙
      if (state.wall.length === 0) {
        warn('Cannot draw tile for AN gang: wall is empty');
        return state;
      }

      // 防御性检查：验证能否移除4张牌
      const nextHand = removeNTiles(hand, action.tile, 4);
      if (!nextHand) {
        warn('Failed to remove 4 tiles for AN gang');
        return state;
      }

      const drawnTile = state.wall[0];
      const newWall = state.wall.slice(1);
      const finalHand = [...nextHand, drawnTile];

      const meld: Meld = { type: 'GANG', tile: action.tile, from: action.from };
      
      // 事件记录
      const gangEvent: GameEvent = {
        type: 'GANG',
        playerId: action.from,
        tile: action.tile,
        from: action.from,
        gangType: 'AN',
        turn: state.turn,
        ts: now(),
      };

      const nextState = {
        ...state,
        wall: newWall,
        hands: { ...state.hands, [action.from]: finalHand },
        melds: { ...state.melds, [action.from]: state.melds[action.from].concat([meld]) },
        lastGangPlayer: action.from,
        isAfterGang: true,
        pendingEvents: [gangEvent],
      } as ChengduState;

      // 暗杠雨钱：收所有人 10 分
      applyGangRainMoney(nextState, action.from, 'AN');
      return nextState;
    }

    // 加杠处理（带事件记录和验证）
    if (action.type === 'GANG' && action.gangType === 'JIA' && state.currentPlayer === action.from) {
      const hand = state.hands[action.from];
      const meldCount = state.melds[action.from].length;

      // 成都规则：不能贴杠定缺花色
      const dingQueSuit = chengduState.dingQueSelection?.[action.from];
      if (isTileInMissingSuit(action.tile, dingQueSuit)) return state;
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) return state;

      // 防御性检查：验证是否有对应的碰
      const pengMeld = state.melds[action.from].find(m => m.type === 'PENG' && tileEq(m.tile, action.tile));
      const hasPeng = !!pengMeld;
      if (!hasPeng) {
        warn('Cannot upgrade to gang: no matching PENG found');
        return state;
      }

      const nextHand = removeTile(hand, action.tile);
      if (!nextHand) {
        warn('Failed to remove tile for JIA gang');
        return state;
      }

      const updatedMelds = state.melds[action.from].map(m =>
        m.type === 'PENG' && tileEq(m.tile, action.tile)
          ? { ...m, type: 'GANG' as const }
          : m
      );

      // 事件记录
      const gangEvent: GameEvent = {
        type: 'GANG',
        playerId: action.from,
        tile: action.tile,
        from: action.from,
        gangType: 'JIA',
        turn: state.turn,
        ts: now(),
      };

      const nextState = {
        ...state,
        hands: { ...state.hands, [action.from]: nextHand },
        melds: { ...state.melds, [action.from]: updatedMelds },
        lastAddedGangTile: { tile: action.tile, from: action.from },
        pendingEvents: [gangEvent],
      } as ChengduState;

      // 贴杠雨钱：收最初提供碰的玩家 5 分
      applyGangRainMoney(nextState, action.from, 'JIA', pengMeld!.from);
      return nextState;
    }

    // 出牌处理（带碰后限制）
    if (action.type === 'DISCARD') {
      const player = state.currentPlayer;
      const hand = state.hands[player];
      const meldCount = state.melds[player].length;
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) {
        warn('Hand size validation failed for discard');
      }

      // 碰后出牌限制
      if (chengduState.lastPengTile && tileEq(action.tile, chengduState.lastPengTile)) {
        warn('Cannot discard the tile just ponged');
        return state;
      }

      const baseResult = placeholderRulePack.applyAction(state, action);
      const result = inheritChengduState(chengduState, baseResult);
      return {
        ...result,
        isAfterGang: false,
        lastAddedGangTile: undefined,
        lastPengTile: undefined,
        pendingEvents: undefined,
      } as ChengduState;
    }

    // 自摸胡处理
    if (action.type === 'HU' && action.from === state.currentPlayer && !state.lastDiscard) {
      const isGangShangKaiHua = !!(
        chengduState.isAfterGang && chengduState.lastGangPlayer === action.from
      );
      const newDeclaredHu = { ...state.declaredHu, [action.from]: true };
      
      // 血战到底：计算已胡玩家数量
      const huCount = Object.values(newDeclaredHu).filter(Boolean).length;
      // 3人胡牌或牌墙空时结束
      const shouldEnd = huCount >= 3 || state.wall.length === 0;
      
      // 找下一个未胡的玩家
      const nextP = nextActivePlayer({ ...state, declaredHu: newDeclaredHu }, action.from);
      
      const next: ChengduState = {
        ...state,
        declaredHu: newDeclaredHu,
        isAfterGang: false,
        meta: { isGangShangKaiHua },
        phase: shouldEnd ? 'END' : 'PLAYING',
        lastDiscard: null,
        currentPlayer: shouldEnd ? action.from : nextP,
      } as ChengduState;
      const selfDrawScore = evaluateSelfDrawScore(next, action.from, isGangShangKaiHua);
      console.log(`[Chengdu] ${action.from} 自摸胡牌, 计算得分: ${selfDrawScore}`);
      if (selfDrawScore > 0) {
        applySelfDrawOutcome(next, action.from, selfDrawScore);
        console.log(`[Chengdu] 应用得分后 roundScores:`, next.roundScores);
      }
      return next;
    }

    if (!state.lastDiscard) {
      const baseResult = placeholderRulePack.applyAction(state, action);
      return inheritChengduState(chengduState, baseResult);
    }

    if (action.type === 'PASS') {
      const baseResult = placeholderRulePack.applyAction(state, action);
      return inheritChengduState(chengduState, baseResult);
    }
    if (action.type === 'PENG' || action.type === 'GANG' || action.type === 'HU') return state;
    return state;
  },

  collectReactions(_state: GameState, _discardAction: Action): Array<{ playerId: PlayerId; action: Action }> {
    return [];
  },

  resolveReactions(
    state: GameState,
    reactions: Array<{ playerId: PlayerId; action: Action }>,
  ): { state: GameState; events: GameEvent[] } {
    const chengduState = state as ChengduState;

    // 处理抢杠胡
    if (chengduState.lastAddedGangTile) {
      const gangTile = chengduState.lastAddedGangTile;
      const qiangGangHu = reactions.filter(
        (r) => r.action.type === 'HU' && r.action.tile && tileEq(r.action.tile, gangTile.tile),
      );

      if (qiangGangHu.length > 0) {
        const declaredHu = { ...state.declaredHu };
        const events: GameEvent[] = [];
        const baseTurn = state.turn;
        const baseTs = now();

        for (const r of qiangGangHu) {
          const snapshot = { ...state };
          declaredHu[r.playerId] = true;
          const hand = state.hands[r.playerId].concat([gangTile.tile]);
          const patterns = findWinPatterns(hand);
          const validPattern = patterns && patterns.find((p) => p && p.isValid);

          if (validPattern) {
            const gangCount = state.melds[r.playerId].filter((m) => m.type === 'GANG').length;
            const yakuList = detectYaku(
              validPattern,
              hand,
              gangTile.tile,
              false,
              state.melds[r.playerId].length,
              false,
              false,
              isLastTileInWall(state),
              false,
              false,
            );
            const score = calculateScore(yakuList, gangCount);
            applyRonOutcome(chengduState, r.playerId, gangTile.from, score, snapshot);

            events.push({
              type: 'HU',
              playerId: r.playerId,
              tile: gangTile.tile,
              from: gangTile.from,
              turn: baseTurn,
              ts: baseTs,
              meta: { yakuList, score, isQiangGang: true },
            });
          } else {
            events.push({
              type: 'HU',
              playerId: r.playerId,
              tile: gangTile.tile,
              from: gangTile.from,
              turn: baseTurn,
              ts: baseTs,
            });
          }
        }

        // 血战到底：计算已胡玩家数量
        const huCount = Object.values(declaredHu).filter(Boolean).length;
        // 3人胡牌或牌墙空时结束
        const shouldEnd = huCount >= 3 || state.wall.length === 0;
        
        const nextP = nextActivePlayer({ ...state, declaredHu }, gangTile.from);
        const next: GameState = {
          ...state,
          declaredHu,
          lastAddedGangTile: undefined,
          lastDiscard: null,
          currentPlayer: shouldEnd ? gangTile.from : nextP,
          phase: shouldEnd ? 'END' : 'PLAYING',
        } as ChengduState;

        if (!shouldEnd) {
          events.push({ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs });
        }
        return { state: next, events };
      }

      // 没有抢杠胡，杠牌玩家补牌
      if (state.wall.length > 0) {
        const drawnTile = state.wall[0];
        const newWall = state.wall.slice(1);
        const gangPlayer = gangTile.from;

        const next: GameState = {
          ...state,
          wall: newWall,
          hands: { ...state.hands, [gangPlayer]: state.hands[gangPlayer].concat([drawnTile]) },
          lastAddedGangTile: undefined,
          lastGangPlayer: gangPlayer,
          isAfterGang: true,
        } as ChengduState;

        return { state: next, events: [] };
      }

      return { state, events: [] };
    }

    if (!state.lastDiscard) return { state, events: [] };

    const discard = state.lastDiscard;
    const baseTurn = state.turn;
    const baseTs = now();

    const valid = reactions
      .filter((r) => r.playerId !== discard.from)
      .filter((r) => !state.declaredHu[r.playerId])
      .filter((r) => {
        const legal = this.getLegalActions(state, r.playerId);
        return legal.some((a) => JSON.stringify(a) === JSON.stringify(r.action));
      });

    const hu = valid.filter((r) => r.action.type === 'HU');
    if (hu.length > 0) {
      const declaredHu = { ...state.declaredHu };
      const events: GameEvent[] = [];

      for (const r of hu) {
        const snapshot = { ...state };
        declaredHu[r.playerId] = true;
        const hand = state.hands[r.playerId].concat([discard.tile]);
        const patterns = findWinPatterns(hand);
        const validPattern = patterns && patterns.find((p) => p && p.isValid);

        if (validPattern) {
          const gangCount = state.melds[r.playerId].filter((m) => m.type === 'GANG').length;
          const isDiHu = state.turn === 1 && discard.from === 'P0' && r.playerId !== 'P0';
          const yakuList = detectYaku(
            validPattern,
            hand,
            discard.tile,
            false,
            state.melds[r.playerId].length,
            false,
            false,
            isLastTileInWall(state),
            false,
            isDiHu,
          );
          const score = calculateScore(yakuList, gangCount);
          applyRonOutcome(chengduState, r.playerId, discard.from, score, snapshot);

          events.push({
            type: 'HU',
            playerId: r.playerId,
            tile: discard.tile,
            from: discard.from,
            turn: baseTurn,
            ts: baseTs,
            meta: { yakuList, score },
          });
        } else {
          events.push({
            type: 'HU',
            playerId: r.playerId,
            tile: discard.tile,
            from: discard.from,
            turn: baseTurn,
            ts: baseTs,
          });
        }
      }

      // 血战到底：计算已胡玩家数量
      const huCount = Object.values(declaredHu).filter(Boolean).length;
      // 3人胡牌或牌墙空时结束
      const shouldEnd = huCount >= 3 || state.wall.length === 0;
      
      const nextP = nextActivePlayer({ ...state, declaredHu }, discard.from);
      const next: GameState = {
        ...state,
        declaredHu,
        lastDiscard: null,
        currentPlayer: shouldEnd ? discard.from : nextP,
        phase: shouldEnd ? 'END' : 'PLAYING',
      };

      if (!shouldEnd) {
        events.push({ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs });
      }
      return { state: next, events };
    }

    const gang = valid.find((r) => r.action.type === 'GANG');
    if (gang && gang.action.type === 'GANG') {
      const pid = gang.playerId;
      const tile = gang.action.tile;
      const from = gang.action.from;

      // 成都规则：不能明杠定缺花色
      const missingSuit = chengduState.dingQueSelection?.[pid];
      if (isTileInMissingSuit(tile, missingSuit)) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      const nextHand = removeNTiles(state.hands[pid], tile, 3);
      if (!nextHand) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      if (state.wall.length === 0) {
        warn('Cannot draw tile for MING gang: wall is empty');
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      const drawnTile = state.wall[0];
      const newWall = state.wall.slice(1);
      const finalHand = [...nextHand, drawnTile];

      const meld: Meld = { type: 'GANG', tile, from };
      const next: GameState = {
        ...state,
        wall: newWall,
        hands: { ...state.hands, [pid]: finalHand },
        melds: { ...state.melds, [pid]: state.melds[pid].concat([meld]) },
        lastDiscard: null,
        currentPlayer: pid,
        lastGangPlayer: pid,
        isAfterGang: true,
      } as ChengduState;

      // 明杠雨钱：收点杠人 10 分
      applyGangRainMoney(next as ChengduState, pid, 'MING', from);

      return {
        state: next,
        events: [
          { type: 'GANG', playerId: pid, tile, from, gangType: gang.action.gangType, turn: baseTurn, ts: baseTs },
          { type: 'TURN', playerId: pid, turn: next.turn, ts: baseTs },
        ],
      };
    }

    const peng = valid.find((r) => r.action.type === 'PENG');
    if (peng && peng.action.type === 'PENG') {
      const pid = peng.playerId;
      const tile = peng.action.tile;
      const from = peng.action.from;

      const nextHand = removeNTiles(state.hands[pid], tile, 2);
      if (!nextHand) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      const meld: Meld = { type: 'PENG', tile, from };
      const next: GameState = {
        ...state,
        hands: { ...state.hands, [pid]: nextHand },
        melds: { ...state.melds, [pid]: state.melds[pid].concat([meld]) },
        lastDiscard: null,
        currentPlayer: pid,
        lastPengTile: tile,
      } as ChengduState;

      return {
        state: next,
        events: [
          { type: 'PENG', playerId: pid, tile, from, turn: baseTurn, ts: baseTs },
          { type: 'TURN', playerId: pid, turn: next.turn, ts: baseTs },
        ],
      };
    }

    const nextP = nextActivePlayer(state, discard.from);
    const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
    return {
      state: next,
      events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }],
    };
  },

  isRoundEnd(state: GameState): boolean {
    // 血战到底：牌墙空或3人胡牌时结束
    if (state.wall.length === 0 || state.phase === 'END') {
      return true;
    }
    // 计算已胡玩家数量，3人胡牌时结束
    const huCount = Object.values(state.declaredHu).filter(Boolean).length;
    return huCount >= 3;
  },

  settleRound(state: GameState): RoundResult {
    const chengduState = state as ChengduState;
    ensureRoundTracking(chengduState);
    return {
      scores: cloneScores(chengduState.roundScores!),
      dealIns: cloneDealIns(chengduState.dealInStats!),
    };
  },
};
