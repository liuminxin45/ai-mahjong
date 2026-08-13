/**
 * 临时诊断脚本（QA Phase 6）：定位 PLAYING 阶段活锁根因（第二类：状态循环）。
 * 用法: pnpm tsx scripts/qa-diagnose-livelock.ts
 */
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { decideHigh } from '../src/agents/algo/policy_high';
import { makeAgentStyleContext } from '../src/agents/algo/style';
import type { Action } from '../src/core/model/action';
import type { PlayerId } from '../src/core/model/types';

const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
const origLog = console.log;
console.log = () => {};

function tstr(t: { suit: string; rank: number }) {
  return `${t.suit}${t.rank}`;
}

function diagnose(seed: number) {
  (globalThis as any).__trainingGameSeed = seed;
  let state = chengduRulePack.buildInitialState(true);
  let steps = 0;
  const seen = new Map<string, number>();
  const recent: string[] = [];

  while (steps < 400) {
    steps++;
    if (chengduRulePack.isRoundEnd(state)) {
      origLog(`seed=${seed} 正常终局 steps=${steps}`);
      return;
    }

    const cs = state as any;
    const sig = [
      state.phase,
      state.turn,
      state.currentPlayer,
      state.lastDiscard ? `LD:${tstr(state.lastDiscard.tile)}<${state.lastDiscard.from}` : 'LD:-',
      cs.lastAddedGangTile ? `AG:${tstr(cs.lastAddedGangTile.tile)}<${cs.lastAddedGangTile.from}` : 'AG:-',
      `W:${state.wall.length}`,
      PLAYERS.map((p) => state.hands[p].length).join(','),
    ].join(' | ');

    const hits = (seen.get(sig) ?? 0) + 1;
    seen.set(sig, hits);

    if (hits === 4) {
      origLog('='.repeat(78));
      origLog(`seed=${seed} 状态循环命中 step=${steps} (同一状态签名第 4 次出现)`);
      origLog(`sig = ${sig}`);
      origLog('--- 最近 12 步轨迹 ---');
      for (const r of recent.slice(-12)) origLog('  ' + r);
      origLog('--- 当前局面 ---');
      for (const p of PLAYERS) {
        origLog(
          `  ${p} hu=${state.declaredHu[p]} dq=${cs.dingQueSelection?.[p]} ` +
            `hand(${state.hands[p].length})=${state.hands[p].map(tstr).join(' ')} ` +
            `melds=${state.melds[p].map((m) => `${m.type}:${tstr(m.tile)}<${m.from}`).join(',') || '-'}`,
        );
      }
      origLog(`  passedHuPlayers=${JSON.stringify(cs.passedHuPlayers)}`);
      origLog(`  isAfterGang=${cs.isAfterGang} lastGangPlayer=${cs.lastGangPlayer} lastPengTile=${cs.lastPengTile ? tstr(cs.lastPengTile) : '-'}`);
      const actor = chengduRulePack.getCurrentActor(state);
      origLog(`  getCurrentActor=${actor}`);
      origLog(
        `  legal(${actor})=${chengduRulePack
          .getLegalActions(state, actor)
          .map((a) => `${a.type}${(a as any).tile ? ':' + tstr((a as any).tile) : ''}${(a as any).gangType ? '/' + (a as any).gangType : ''}`)
          .join(' | ')}`,
      );
      for (const p of PLAYERS) {
        if (p === actor) continue;
        const lg = chengduRulePack.getLegalActions(state, p);
        origLog(`  legal(${p})=${lg.map((a) => `${a.type}${(a as any).tile ? ':' + tstr((a as any).tile) : ''}`).join(' | ')}`);
      }
      origLog('='.repeat(78));
      return;
    }

    if (state.lastDiscard) {
      const from = state.lastDiscard.from;
      const reactions: Array<{ playerId: PlayerId; action: Action }> = [];
      for (const pid of PLAYERS) {
        if (pid === from) continue;
        if (state.declaredHu[pid]) continue;
        const legal = chengduRulePack.getLegalActions(state, pid);
        if (legal.length <= 1) continue;
        const a = decideHigh(state, pid, legal, { style: makeAgentStyleContext(state, pid) });
        if (a.type !== 'PASS') reactions.push({ playerId: pid, action: a });
      }
      recent.push(
        `step${steps} REACT to ${tstr(state.lastDiscard.tile)}<${from} => ${reactions.map((r) => `${r.playerId}:${r.action.type}`).join(',') || 'all PASS'}`,
      );
      state = chengduRulePack.resolveReactions(state, reactions).state;
      continue;
    }

    const actor = chengduRulePack.getCurrentActor(state);
    const legal = chengduRulePack.getLegalActions(state, actor);
    if (legal.length === 0) {
      recent.push(`step${steps} ${actor} NO_LEGAL`);
      origLog(`seed=${seed} step${steps} ${actor} 无合法动作 phase=${state.phase}`);
      return;
    }
    const action =
      legal.length === 1
        ? legal[0]
        : decideHigh(state, actor, legal, { style: makeAgentStyleContext(state, actor) });

    recent.push(
      `step${steps} ${actor} ${action.type}${(action as any).tile ? ':' + tstr((action as any).tile) : ''}${(action as any).gangType ? '/' + (action as any).gangType : ''}`,
    );

    const before = state;
    state = chengduRulePack.applyAction(state, action);
    if (state === before && action.type !== 'PASS') {
      recent.push(`step${steps} !! NOOP ${actor} ${action.type}`);
      origLog(`seed=${seed} step${steps} NOOP ${actor} ${action.type}`);
      return;
    }
  }
  origLog(`seed=${seed} 400 步未终局`);
}

for (const s of [1008, 1010, 1011]) diagnose(s);
console.log = origLog;
