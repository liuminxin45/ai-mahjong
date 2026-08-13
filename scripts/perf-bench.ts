/**
 * 性能基准套件（Phase 6 打磨 / 性能剖析）
 *
 * 目的：为 neo-mahjong 的 AI 热路径提供**可复现、可对比**的量化基线，
 * 避免"我觉得快了"式的主观结论。所有场景固定 seed，单进程内串行执行。
 *
 * 用法：
 *   npx tsx scripts/perf-bench.ts                 # 默认全部场景
 *   npx tsx scripts/perf-bench.ts --games 20      # 自博弈局数
 *   npx tsx scripts/perf-bench.ts --json out.json # 额外输出 JSON（便于 before/after diff）
 *   npx tsx scripts/perf-bench.ts --only S1,S4    # 只跑指定场景
 *
 * 场景：
 *   S1  shantenWithMelds  冷缓存吞吐（每次调用前清缓存 → 纯算法成本）
 *   S2  shantenWithMelds  热缓存吞吐（重复局面 → 缓存命中成本）
 *   S3  ukeireTilesWithMelds 吞吐（每次调用内部触发 ~27 次向听计算）
 *   S4  decideHigh 单步决策延迟（真实中盘局面，p50/p95/max）
 *   S5  自博弈端到端（driveOneGame，全 high 档，含发牌/换三张/定缺/血战到底/结算）
 *
 * 注意：S1/S3 每轮清空全局缓存以测量"最坏情况"；S2/S4/S5 保留缓存以贴近真实会话。
 */
import type { Action } from '../src/core/model/action';
import type { GameState } from '../src/core/model/state';
import type { PlayerId } from '../src/core/model/types';
import type { Tile } from '../src/core/model/tile';
import {
  shantenWithMelds,
  ukeireTilesWithMelds,
  clearShantenCache,
  getShantenCacheStats,
} from '../src/agents/algo/shanten';
import { decideHigh } from '../src/agents/algo/policy_high';
import { makeAgentStyleContext } from '../src/agents/algo/style';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { driveOneGame, uniformDifficulty, PLAYERS } from '../tests/playtestHarness';

// ── CLI ────────────────────────────────────────────────

const argv = process.argv.slice(2);
function flag(name: string, dflt?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return !v || v.startsWith('--') ? 'true' : v;
}

const GAMES = Number(flag('games', '12'));
const JSON_OUT = flag('json');
const ONLY = (flag('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const want = (id: string) => ONLY.length === 0 || ONLY.includes(id);

// ── 确定性随机（避免 Math.random 影响可复现性）─────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUITS: Tile['suit'][] = ['W', 'B', 'T'];

/** 生成 K 副互不相同的合法 13 张手牌（每种牌 ≤4） */
function randomHands(count: number, size: number, seed: number): Tile[][] {
  const rnd = mulberry32(seed);
  const out: Tile[][] = [];
  for (let n = 0; n < count; n++) {
    const wall: Tile[] = [];
    for (const suit of SUITS) {
      for (let rank = 1 as Tile['rank']; rank <= 9; rank = (rank + 1) as Tile['rank']) {
        for (let i = 0; i < 4; i++) wall.push({ suit, rank });
      }
    }
    // Fisher-Yates
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }
    out.push(wall.slice(0, size));
  }
  return out;
}

// ── 计时工具 ───────────────────────────────────────────

function ms(): number {
  return Number(process.hrtime.bigint() / 1000n) / 1000;
}

interface Stat {
  id: string;
  label: string;
  unit: string;
  n: number;
  totalMs: number;
  perOpUs?: number;
  opsPerSec?: number;
  p50Ms?: number;
  p95Ms?: number;
  maxMs?: number;
  extra?: Record<string, unknown>;
}

const results: Stat[] = [];

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function record(s: Stat): void {
  results.push(s);
  const head = `${s.id}  ${s.label}`.padEnd(52);
  if (s.p50Ms !== undefined) {
    console.log(
      `${head} n=${String(s.n).padStart(5)}  total=${s.totalMs.toFixed(1)}ms  ` +
        `p50=${s.p50Ms.toFixed(3)}ms  p95=${s.p95Ms!.toFixed(3)}ms  max=${s.maxMs!.toFixed(3)}ms`,
    );
  } else {
    console.log(
      `${head} n=${String(s.n).padStart(5)}  total=${s.totalMs.toFixed(1)}ms  ` +
        `per-op=${s.perOpUs!.toFixed(2)}µs  ops/s=${Math.round(s.opsPerSec!)}`,
    );
  }
  if (s.extra) console.log(`      ${JSON.stringify(s.extra)}`);
}

// ── S1/S2: 向听计算 ────────────────────────────────────

function benchShanten(): void {
  const hands = randomHands(300, 13, 20260101);

  if (want('S1')) {
    // 冷缓存：每次调用前清空全局缓存，测纯 DFS 成本
    let t = 0;
    let n = 0;
    for (const h of hands) {
      clearShantenCache();
      const t0 = ms();
      shantenWithMelds(h, 0);
      t += ms() - t0;
      n++;
    }
    record({
      id: 'S1',
      label: 'shantenWithMelds 冷缓存(每次清缓存)',
      unit: 'call',
      n,
      totalMs: t,
      perOpUs: (t / n) * 1000,
      opsPerSec: n / (t / 1000),
    });
  }

  if (want('S2')) {
    // 热缓存：先预热，再重复同一批局面
    clearShantenCache();
    for (const h of hands) shantenWithMelds(h, 0);
    const ROUNDS = 40;
    const t0 = ms();
    for (let r = 0; r < ROUNDS; r++) for (const h of hands) shantenWithMelds(h, 0);
    const t = ms() - t0;
    const n = ROUNDS * hands.length;
    record({
      id: 'S2',
      label: 'shantenWithMelds 热缓存(重复局面)',
      unit: 'call',
      n,
      totalMs: t,
      perOpUs: (t / n) * 1000,
      opsPerSec: n / (t / 1000),
      extra: getShantenCacheStats(),
    });
  }
}

// ── S3: 进张计算 ───────────────────────────────────────

function benchUkeire(): void {
  if (!want('S3')) return;
  const hands = randomHands(120, 13, 20260202);
  let t = 0;
  let n = 0;
  let checksum = 0;
  for (const h of hands) {
    clearShantenCache();
    const t0 = ms();
    const u = ukeireTilesWithMelds(h, 0);
    t += ms() - t0;
    checksum += u.total;
    n++;
  }
  record({
    id: 'S3',
    label: 'ukeireTilesWithMelds 冷缓存',
    unit: 'call',
    n,
    totalMs: t,
    perOpUs: (t / n) * 1000,
    opsPerSec: n / (t / 1000),
    extra: { ukeireChecksum: checksum },
  });
}

// ── S4: 单步决策延迟 ───────────────────────────────────

interface Snapshot {
  state: GameState;
  actor: PlayerId;
  legal: Action[];
}

/**
 * 采集真实中盘决策局面：驱动一局全 AI 对局，
 * 在每次「多选一」的出牌决策点快照 (state, actor, legal)。
 */
function collectDecisionSnapshots(seed: number, limit: number): Snapshot[] {
  (globalThis as any).__trainingGameSeed = seed;
  let state = chengduRulePack.buildInitialState(true);
  const snaps: Snapshot[] = [];
  let steps = 0;

  while (steps < 4000 && snaps.length < limit) {
    steps++;
    if (chengduRulePack.isRoundEnd(state)) break;

    if (state.lastDiscard) {
      const discard = state.lastDiscard;
      const reactions: Array<{ playerId: PlayerId; action: Action }> = [];
      for (const pid of PLAYERS) {
        if (pid === discard.from || state.declaredHu[pid]) continue;
        const legal = chengduRulePack.getLegalActions(state, pid);
        if (legal.length === 0) continue;
        if (legal.length === 1 && legal[0].type === 'PASS') continue;
        const action = decideHigh(state, pid, legal, { style: makeAgentStyleContext(state, pid) });
        if (action.type === 'PASS') continue;
        reactions.push({ playerId: pid, action });
      }
      state = chengduRulePack.resolveReactions(state, reactions).state;
      continue;
    }

    const actor = chengduRulePack.getCurrentActor(state);
    const legal = chengduRulePack.getLegalActions(state, actor);
    if (legal.length === 0) break;

    let action: Action;
    if (legal.length === 1) {
      action = legal[0];
    } else {
      // 只采集 PLAYING 阶段含出牌选项的决策点（EV 全量计算路径）
      if (state.phase === 'PLAYING' && legal.some((a) => a.type === 'DISCARD')) {
        snaps.push({ state: structuredClone(state), actor, legal: structuredClone(legal) });
      }
      action = decideHigh(state, actor, legal, { style: makeAgentStyleContext(state, actor) });
    }

    const before = state;
    state = chengduRulePack.applyAction(state, action);
    if (state === before && action.type !== 'PASS') break;
  }

  return snaps;
}

function benchDecision(): void {
  if (!want('S4')) return;
  const snaps = collectDecisionSnapshots(4242, 220);
  if (snaps.length === 0) {
    console.log('S4  (无法采集决策局面，跳过)');
    return;
  }

  // 预热一遍（贴近真实会话：缓存已有内容）
  for (const s of snaps.slice(0, 20)) {
    decideHigh(s.state, s.actor, s.legal, { style: makeAgentStyleContext(s.state, s.actor) });
  }

  const samples: number[] = [];
  const t0 = ms();
  for (const s of snaps) {
    const ctx = { style: makeAgentStyleContext(s.state, s.actor) };
    const a0 = ms();
    decideHigh(s.state, s.actor, s.legal, ctx);
    samples.push(ms() - a0);
  }
  const total = ms() - t0;
  const sorted = [...samples].sort((a, b) => a - b);

  record({
    id: 'S4',
    label: 'decideHigh 单步决策(真实中盘)',
    unit: 'decision',
    n: snaps.length,
    totalMs: total,
    p50Ms: pct(sorted, 50),
    p95Ms: pct(sorted, 95),
    maxMs: sorted[sorted.length - 1],
    extra: { meanMs: Number((total / snaps.length).toFixed(3)) },
  });
}

// ── S5: 自博弈端到端 ───────────────────────────────────

function benchSelfPlay(): void {
  if (!want('S5')) return;
  const diff = uniformDifficulty('high');
  const perGame: number[] = [];
  let steps = 0;
  let hu = 0;
  let violations = 0;

  // 预热一局，避免 JIT 冷启动污染
  driveOneGame({ seed: 1, difficulty: diff, trace: false, invariants: false });

  const t0 = ms();
  for (let i = 0; i < GAMES; i++) {
    const g0 = ms();
    const tr = driveOneGame({
      seed: 10_000 + i,
      difficulty: diff,
      trace: false,
      invariants: false,
    });
    perGame.push(ms() - g0);
    steps += tr.steps;
    hu += tr.huCount;
    violations += tr.violations.length;
  }
  const total = ms() - t0;
  const sorted = [...perGame].sort((a, b) => a - b);

  record({
    id: 'S5',
    label: `自博弈端到端 (high×4, ${GAMES}局)`,
    unit: 'game',
    n: GAMES,
    totalMs: total,
    p50Ms: pct(sorted, 50),
    p95Ms: pct(sorted, 95),
    maxMs: sorted[sorted.length - 1],
    extra: {
      meanMsPerGame: Number((total / GAMES).toFixed(1)),
      totalSteps: steps,
      usPerStep: Number(((total * 1000) / steps).toFixed(1)),
      huTotal: hu,
      violations,
      cache: getShantenCacheStats(),
    },
  });
}

// ── main ───────────────────────────────────────────────

console.log('='.repeat(96));
console.log(`neo-mahjong 性能基准  node=${process.version}  games=${GAMES}`);
console.log('='.repeat(96));

benchShanten();
benchUkeire();
benchDecision();
benchSelfPlay();

console.log('='.repeat(96));

if (JSON_OUT && JSON_OUT !== 'true') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    JSON_OUT,
    JSON.stringify({ node: process.version, games: GAMES, at: new Date().toISOString(), results }, null, 2),
  );
  console.log(`JSON 已写入 ${JSON_OUT}`);
}
