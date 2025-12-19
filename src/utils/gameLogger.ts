/**
 * 游戏日志记录器
 * 用于记录完整的游戏过程，便于分析和调试
 */

import type { Action } from '../core/model/action';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { Tile } from '../core/model/tile';
import { gameLogStore } from '../store/gameLogStore';

interface GameLogEntry {
  turn: number;
  phase: string;
  actor: PlayerId;
  action: Action;
  handSizes: Record<PlayerId, number>;
  // 所有玩家的完整数据（用于 AI 分析）
  allHands: Record<PlayerId, string[]>;
  allMelds: Record<PlayerId, Array<{ type: string; tile: string; from: PlayerId }>>;
  allDiscards: Record<PlayerId, string[]>;
  // 换三张阶段数据
  exchangeData?: {
    selectedTiles?: Partial<Record<PlayerId, string[]>>;
    receivedTiles?: Partial<Record<PlayerId, string[]>>;
  };
  lastDiscard?: { tile: string; from: PlayerId } | null;
  dingQueSelection?: Partial<Record<PlayerId, 'W' | 'B' | 'T' | undefined>>;
  legalActionTypes?: string[];
  // AI 决策过程（仅当 actor 是 AI 时记录）
  aiDecision?: {
    candidateActions: Array<{
      action: string;
      shanten: number;
      ukeire: number;
      dangerScore: number;
      expectedValue: number;
      winProbability?: number;
      expectedScore?: number;
    }>;
    selectedAction: string;
    selectedEV: number;
    reasoning?: string;
  };
  timestamp: number;
}

class GameLogger {
  private logs: GameLogEntry[] = [];
  private gameStartTime: number = 0;
  private gameId: string = '';

  startGame(gameId: string) {
    this.gameId = gameId;
    this.gameStartTime = Date.now();
    this.logs = [];
    
    const startMsg = `🎮 Game Started: ${gameId}`;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[GameLogger] ${startMsg}`);
    console.log(`[GameLogger] Time: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(80)}\n`);
    
    gameLogStore.clear();
    gameLogStore.addLog(startMsg, 'phase');
    gameLogStore.addLog(`Time: ${new Date().toLocaleString()}`, 'info');
  }

  logAction(state: GameState, actor: PlayerId, action: Action, aiDecision?: GameLogEntry['aiDecision']) {
    // 记录所有玩家的完整数据
    const allHands: Record<PlayerId, string[]> = {
      P0: state.hands.P0.map((t) => this.formatTile(t)),
      P1: state.hands.P1.map((t) => this.formatTile(t)),
      P2: state.hands.P2.map((t) => this.formatTile(t)),
      P3: state.hands.P3.map((t) => this.formatTile(t)),
    };

    const allMelds: Record<PlayerId, Array<{ type: string; tile: string; from: PlayerId }>> = {
      P0: state.melds.P0.map((m) => ({ type: m.type, tile: this.formatTile(m.tile), from: m.from })),
      P1: state.melds.P1.map((m) => ({ type: m.type, tile: this.formatTile(m.tile), from: m.from })),
      P2: state.melds.P2.map((m) => ({ type: m.type, tile: this.formatTile(m.tile), from: m.from })),
      P3: state.melds.P3.map((m) => ({ type: m.type, tile: this.formatTile(m.tile), from: m.from })),
    };

    const allDiscards: Record<PlayerId, string[]> = {
      P0: state.discards.P0.map((t) => this.formatTile(t)),
      P1: state.discards.P1.map((t) => this.formatTile(t)),
      P2: state.discards.P2.map((t) => this.formatTile(t)),
      P3: state.discards.P3.map((t) => this.formatTile(t)),
    };

    const dingQueSelection = (state as any).dingQueSelection as
      | Partial<Record<PlayerId, 'W' | 'B' | 'T' | undefined>>
      | undefined;

    const legalActionTypes = (globalThis as any).__lastLegalActions?.[actor] as string[] | undefined;

    // 换三张阶段数据
    let exchangeData: GameLogEntry['exchangeData'];
    if (state.phase === 'EXCHANGE' && action.type === 'EXCHANGE_SELECT') {
      const globalExchangeData = (globalThis as any).__exchangeData || {};
      exchangeData = {
        selectedTiles: globalExchangeData.selectedTiles,
        receivedTiles: globalExchangeData.receivedTiles,
      };
    }

    const entry: GameLogEntry = {
      turn: state.turn,
      phase: state.phase,
      actor,
      action,
      handSizes: {
        P0: state.hands.P0.length,
        P1: state.hands.P1.length,
        P2: state.hands.P2.length,
        P3: state.hands.P3.length,
      },
      allHands,
      allMelds,
      allDiscards,
      exchangeData,
      lastDiscard: state.lastDiscard
        ? { tile: this.formatTile(state.lastDiscard.tile), from: state.lastDiscard.from }
        : null,
      dingQueSelection,
      legalActionTypes,
      aiDecision,
      timestamp: Date.now() - this.gameStartTime,
    };

    this.logs.push(entry);

    // 格式化输出
    const actionStr = this.formatAction(action);
    const timeStr = `[${(entry.timestamp / 1000).toFixed(1)}s]`;
    
    const logMsg = `Turn ${entry.turn} | ${entry.phase} | ${actor}: ${actionStr}`;
    console.log(`${timeStr} ${logMsg}`);
    gameLogStore.addLog(`${timeStr} ${logMsg}`, 'action');
    
    // 特殊动作的详细信息
    if (action.type === 'EXCHANGE_SELECT') {
      const detail = `  └─ Selected tiles: ${this.formatTiles(action.tiles)}`;
      console.log(detail);
      gameLogStore.addLog(detail, 'info');
    } else if (action.type === 'DING_QUE') {
      const detail = `  └─ Missing suit: ${action.suit}`;
      console.log(detail);
      gameLogStore.addLog(detail, 'info');
    } else if (action.type === 'DISCARD' && action.tile) {
      const detail = `  └─ Discarded: ${this.formatTile(action.tile)}`;
      console.log(detail);
      gameLogStore.addLog(detail, 'info');
    } else if ((action.type === 'PENG' || action.type === 'GANG') && action.tile) {
      const detail = `  └─ Tile: ${this.formatTile(action.tile)} from ${action.from}`;
      console.log(detail);
      gameLogStore.addLog(detail, 'info');
    } else if (action.type === 'HU' && action.tile) {
      const detail = `  └─ 🎉 WIN! Tile: ${this.formatTile(action.tile)} from ${action.from}`;
      console.log(detail);
      gameLogStore.addLog(detail, 'info');
    }
  }

  logStateChange(_state: GameState, description: string) {
    console.log(`  ℹ️  ${description}`);
  }

  endGame(state: GameState, result: 'HU' | 'LOSE' | 'DRAW') {
    const duration = (Date.now() - this.gameStartTime) / 1000;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[GameLogger] 🏁 Game Ended: ${this.gameId}`);
    console.log(`[GameLogger] Duration: ${duration.toFixed(1)}s`);
    console.log(`[GameLogger] Total turns: ${state.turn}`);
    console.log(`[GameLogger] Result: ${result}`);
    
    // 显示胜利者
    const winners = (['P0', 'P1', 'P2', 'P3'] as const).filter(pid => state.declaredHu[pid]);
    if (winners.length > 0) {
      console.log(`[GameLogger] Winners: ${winners.join(', ')}`);
    }
    
    // 显示最终手牌数
    console.log(`[GameLogger] Final hand sizes:`);
    for (const pid of ['P0', 'P1', 'P2', 'P3'] as const) {
      const handSize = state.hands[pid].length;
      const meldCount = state.melds[pid].length;
      console.log(`  ${pid}: ${handSize} tiles + ${meldCount} melds`);
    }
    
    console.log(`${'='.repeat(80)}\n`);
    
    // 提供导出功能
    console.log('[GameLogger] To export game log, run: exportGameLog()');
    (globalThis as any).exportGameLog = () => this.exportLog();
  }

  private formatAction(action: Action): string {
    switch (action.type) {
      case 'DRAW':
        return '🎴 Draw';
      case 'DISCARD':
        return action.tile ? `🗑️  Discard ${this.formatTile(action.tile)}` : '🗑️  Discard';
      case 'PENG':
        return action.tile ? `👊 Pong ${this.formatTile(action.tile)}` : '👊 Pong';
      case 'GANG':
        const gangType = (action as any).gangType || 'MING';
        return action.tile ? `💪 Kong(${gangType}) ${this.formatTile(action.tile)}` : `💪 Kong(${gangType})`;
      case 'HU':
        return action.tile ? `🎉 Win with ${this.formatTile(action.tile)}` : '🎉 Win';
      case 'EXCHANGE_SELECT':
        return `🔄 Exchange ${action.tiles.length} tiles`;
      case 'EXCHANGE_CONFIRM':
        return '✅ Confirm exchange';
      case 'DING_QUE':
        return `🎯 Choose missing: ${action.suit}`;
      case 'PASS':
        return '⏭️  Pass';
      default:
        return 'Unknown action';
    }
  }

  private formatTile(tile: Tile): string {
    return `${tile.suit}${tile.rank}`;
  }

  private formatTiles(tiles: Tile[]): string {
    return tiles.map(t => this.formatTile(t)).join(', ');
  }

  private exportLog() {
    const logData = {
      gameId: this.gameId,
      startTime: this.gameStartTime,
      duration: Date.now() - this.gameStartTime,
      totalActions: this.logs.length,
      logs: this.logs,
    };

    const json = JSON.stringify(logData, null, 2);
    console.log('\n=== Game Log Export ===');
    console.log(json);
    console.log('======================\n');
    
    // 复制到剪贴板（如果支持）
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => {
        console.log('✅ Log copied to clipboard!');
      }).catch(() => {
        console.log('⚠️  Could not copy to clipboard');
      });
    }
    
    return logData;
  }

  getSummary() {
    return {
      gameId: this.gameId,
      totalActions: this.logs.length,
      actionsByType: this.logs.reduce((acc, log) => {
        acc[log.action.type] = (acc[log.action.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      actionsByPlayer: this.logs.reduce((acc, log) => {
        acc[log.actor] = (acc[log.actor] || 0) + 1;
        return acc;
      }, {} as Record<PlayerId, number>),
    };
  }
}

export const gameLogger = new GameLogger();

// 全局访问
(globalThis as any).gameLogger = gameLogger;
