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

const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

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

  if (next.phase !== 'END') {
    merged.phase = next.phase;
  } else {
    merged.phase = prev.phase;
  }

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
  const yakuList = detectYaku(
    validPattern,
    hand,
    winTile,
    true,
    state.melds[playerId].length,
    isGangShangKaiHua,
    false,
    isLastTileInWall(state),
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
    console.warn(`[Validation] Hand size mismatch: expected ${expectedSize}, got ${hand.length}`);
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

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  const rng = seed !== undefined ? new SeededRandom(seed) : null;
  
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng ? rng.nextInt(0, i) : Math.floor(Math.random() * (i + 1));
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
    console.log(`[GameInit] Game #${gameCounter}, seed: ${seed} (training: ${trainingSeed !== undefined})`);
    
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
      console.log(`[Exchange] ${player} checking AI mode: p0IsAI=${settingsStore.p0IsAI}, player=${player}`);
      
      if (player !== 'P0' || settingsStore.p0IsAI) {
        const hand = state.hands[player];
        const selectedTiles = selectExchangeTiles(hand);
        if (selectedTiles.length === 3) {
          console.log(`[Exchange] ${player} AI selecting tiles:`, selectedTiles.map(t => `${t.suit}${t.rank}`).join(', '));
          return [{ type: 'EXCHANGE_SELECT', tiles: selectedTiles }];
        }
      } else {
        console.log(`[Exchange] ${player} is human player, returning manual selection options`);
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
        console.log(`[DingQue] ${player} AI selecting missing suit: ${selectedSuit}`);
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
        legal.push({ type: 'GANG', tile, from, gangType: 'MING' });
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
      if (canWin && hasQue) {
        baseActions.push({ type: 'HU', tile: hand[hand.length - 1], from: player });
      }

      // 暗杠和加杠
      for (const tile of hand) {
        const count = countTile(hand, tile);
        if (count === 4) {
          baseActions.push({ type: 'GANG', tile, from: player, gangType: 'AN' });
        }
        if (canUpgradeToGang(state, player, tile)) {
          baseActions.push({ type: 'GANG', tile, from: player, gangType: 'JIA' });
        }
      }
      
      // 成都规则：必须先打完缺门的牌
      const dingQueSuit = chengduState.dingQueSelection?.[player];
      if (dingQueSuit) {
        const missingSuitTiles = hand.filter(t => t.suit === dingQueSuit);
        if (missingSuitTiles.length > 0) {
          // 有缺门的牌，只能打缺门的牌
          const discardActions = baseActions.filter(a => 
            a.type === 'DISCARD' && a.tile.suit === dingQueSuit
          );
          // 保留非出牌动作（胡、杠）
          const nonDiscardActions = baseActions.filter(a => a.type !== 'DISCARD');
          return [...nonDiscardActions, ...discardActions];
        }
      }
    }

    return baseActions;
  },

  applyAction(state: GameState, action: Action): GameState {
    const chengduState = state as ChengduState;

    // 换三张选择
    if (action.type === 'EXCHANGE_SELECT' && state.phase === 'EXCHANGE') {
      const player = state.currentPlayer;
      const tiles = action.tiles;

      console.log(`[EXCHANGE_SELECT] ${player} selecting tiles:`, tiles.map(t => `${t.suit}${t.rank}`).join(', '));
      console.log(`[EXCHANGE_SELECT] ${player} hand before:`, state.hands[player].map(t => `${t.suit}${t.rank}`).join(' '));

      if (tiles.length !== 3) {
        console.warn('[EXCHANGE_SELECT] Failed: Must select exactly 3 tiles, got', tiles.length);
        return state;
      }

      if (!validateExchangeTiles(tiles)) {
        console.warn('[EXCHANGE_SELECT] Failed: Exchange tiles must be same suit', tiles);
        return state;
      }

      console.log(`[EXCHANGE_SELECT] ✅ ${player} tiles saved successfully`);
      
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
      
      console.log(`[EXCHANGE_CONFIRM] ${player} confirming exchange`);
      console.log(`[EXCHANGE_CONFIRM] ${player} selected:`, chengduState.exchangeSelections?.[player]?.map(t => `${t.suit}${t.rank}`).join(', '));
      
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
      console.log(`[EXCHANGE_CONFIRM] Confirmed: P0=${newState.exchangeConfirmed!.P0}, P1=${newState.exchangeConfirmed!.P1}, P2=${newState.exchangeConfirmed!.P2}, P3=${newState.exchangeConfirmed!.P3}`);
      console.log(`[EXCHANGE_CONFIRM] All confirmed? ${allConfirmed}`);

      if (allConfirmed) {
        console.log('[EXCHANGE] 🔄 All players confirmed, performing exchange (CLOCKWISE)');
        
        const exchanged = performExchange(
          newState.exchangeSelections!,
          'CLOCKWISE'
        );

        const newHands = { ...newState.hands };
        for (const [pid, tiles] of Object.entries(exchanged)) {
          const playerId = pid as PlayerId;
          console.log(`[EXCHANGE] ${playerId} sending:`, newState.exchangeSelections![playerId].map(t => `${t.suit}${t.rank}`).join(', '));
          console.log(`[EXCHANGE] ${playerId} receiving:`, tiles.map(t => `${t.suit}${t.rank}`).join(', '));
          
          const remaining = removeTilesFromHand(
            newHands[playerId],
            newState.exchangeSelections![playerId]
          );
          if (remaining) {
            // 换三张后自动排序手牌
            newHands[playerId] = sortTiles([...remaining, ...tiles]);
            console.log(`[EXCHANGE] ${playerId} hand after:`, newHands[playerId].map(t => `${t.suit}${t.rank}`).join(' '));
          }
        }

        console.log('[EXCHANGE] ✅ Exchange complete, transitioning to DING_QUE phase');

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
      
      console.log(`[DING_QUE] ${player} selecting missing suit: ${action.suit}`);
      console.log(`[DING_QUE] ${player} hand:`, state.hands[player].map(t => `${t.suit}${t.rank}`).join(' '));
      
      // 统计花色数量
      const suitCounts = { W: 0, B: 0, T: 0 };
      for (const tile of state.hands[player]) {
        if (tile.suit === 'W' || tile.suit === 'B' || tile.suit === 'T') {
          suitCounts[tile.suit]++;
        }
      }
      console.log(`[DING_QUE] ${player} suit counts: W=${suitCounts.W}, B=${suitCounts.B}, T=${suitCounts.T}`);
      
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
      console.log(`[DING_QUE] Selected: P0=${newState.dingQueSelection!.P0 || 'pending'}, P1=${newState.dingQueSelection!.P1 || 'pending'}, P2=${newState.dingQueSelection!.P2 || 'pending'}, P3=${newState.dingQueSelection!.P3 || 'pending'}`);
      console.log(`[DING_QUE] All selected? ${allSelected}`);

      if (allSelected) {
        console.log('[DING_QUE] ✅ All players selected, transitioning to PLAYING phase');
        console.log(`[DING_QUE] Final: P0 missing ${newState.dingQueSelection!.P0}, P1 missing ${newState.dingQueSelection!.P1}, P2 missing ${newState.dingQueSelection!.P2}, P3 missing ${newState.dingQueSelection!.P3}`);
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
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) return state;
      
      // 状态一致性：先检查牌墙
      if (state.wall.length === 0) {
        console.warn('Cannot draw tile for AN gang: wall is empty');
        return state;
      }

      // 防御性检查：验证能否移除4张牌
      const nextHand = removeNTiles(hand, action.tile, 4);
      if (!nextHand) {
        console.warn('Failed to remove 4 tiles for AN gang');
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

      return {
        ...state,
        wall: newWall,
        hands: { ...state.hands, [action.from]: finalHand },
        melds: { ...state.melds, [action.from]: state.melds[action.from].concat([meld]) },
        lastGangPlayer: action.from,
        isAfterGang: true,
        pendingEvents: [gangEvent],
      } as ChengduState;
    }

    // 加杠处理（带事件记录和验证）
    if (action.type === 'GANG' && action.gangType === 'JIA' && state.currentPlayer === action.from) {
      const hand = state.hands[action.from];
      const meldCount = state.melds[action.from].length;
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) return state;

      // 防御性检查：验证是否有对应的碰
      const hasPeng = state.melds[action.from].some(m => m.type === 'PENG' && tileEq(m.tile, action.tile));
      if (!hasPeng) {
        console.warn('Cannot upgrade to gang: no matching PENG found');
        return state;
      }

      const nextHand = removeTile(hand, action.tile);
      if (!nextHand) {
        console.warn('Failed to remove tile for JIA gang');
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

      return {
        ...state,
        hands: { ...state.hands, [action.from]: nextHand },
        melds: { ...state.melds, [action.from]: updatedMelds },
        lastAddedGangTile: { tile: action.tile, from: action.from },
        pendingEvents: [gangEvent],
      } as ChengduState;
    }

    // 出牌处理（带碰后限制）
    if (action.type === 'DISCARD') {
      const player = state.currentPlayer;
      const hand = state.hands[player];
      const meldCount = state.melds[player].length;
      
      // 手牌数量验证
      if (!validateHandSize(hand, meldCount, 1)) {
        console.warn('Hand size validation failed for discard');
      }

      // 碰后出牌限制
      if (chengduState.lastPengTile && tileEq(action.tile, chengduState.lastPengTile)) {
        console.warn('Cannot discard the tile just ponged');
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
      const next: ChengduState = {
        ...state,
        declaredHu: { ...state.declaredHu, [action.from]: true },
        isAfterGang: false,
        meta: { isGangShangKaiHua },
        phase: 'END',
        lastDiscard: null,
        currentPlayer: action.from,
      } as ChengduState;
      const selfDrawScore = evaluateSelfDrawScore(next, action.from, isGangShangKaiHua);
      if (selfDrawScore > 0) {
        applySelfDrawOutcome(next, action.from, selfDrawScore);
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
              true,
              isLastTileInWall(state),
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

        const nextP = nextActivePlayer({ ...state, declaredHu }, gangTile.from);
        const next: GameState = {
          ...state,
          declaredHu,
          lastAddedGangTile: undefined,
          lastDiscard: null,
          currentPlayer: nextP,
          phase: 'END',
        } as ChengduState;

        events.push({ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs });
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
          const yakuList = detectYaku(
            validPattern,
            hand,
            discard.tile,
            false,
            state.melds[r.playerId].length,
            false,
            false,
            isLastTileInWall(state),
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

      const nextP = nextActivePlayer({ ...state, declaredHu }, discard.from);
      const next: GameState = {
        ...state,
        declaredHu,
        lastDiscard: null,
        currentPlayer: nextP,
        phase: 'END',
      };

      if (next.phase !== 'END') {
        events.push({ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs });
      }
      return { state: next, events };
    }

    const gang = valid.find((r) => r.action.type === 'GANG');
    if (gang && gang.action.type === 'GANG') {
      const pid = gang.playerId;
      const tile = gang.action.tile;
      const from = gang.action.from;

      const nextHand = removeNTiles(state.hands[pid], tile, 3);
      if (!nextHand) {
        const nextP = nextActivePlayer({ ...state }, discard.from);
        const next: GameState = { ...state, lastDiscard: null, currentPlayer: nextP };
        return { state: next, events: [{ type: 'TURN', playerId: nextP, turn: next.turn, ts: baseTs }] };
      }

      if (state.wall.length === 0) {
        console.warn('Cannot draw tile for MING gang: wall is empty');
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
    if (state.wall.length === 0 || state.phase === 'END') {
      return true;
    }
    return Object.values(state.declaredHu).some(Boolean);
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
