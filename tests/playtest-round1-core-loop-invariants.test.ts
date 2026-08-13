/**
 * Playtest 轮次 1：核心循环一致性与不变量守卫
 *
 * 目标：发牌 → 换三张 → 定缺 → 出牌/碰/杠/胡 → 血战到底 → 结算 全链路可跑通，
 * 且过程中不违反牌张守恒、手牌张数、定缺约束、分数零和等硬不变量。
 *
 * 复现：pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  PLAYERS,
  driveOneGame,
  uniformDifficulty,
  withSilencedConsole,
  type GameTrace,
} from './playtestHarness';

const SEEDS = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012];

function runBatch(seeds: number[]): { traces: GameTrace[]; logCalls: number } {
  const { result, counts } = withSilencedConsole(() =>
    seeds.map((seed) => driveOneGame({ seed, difficulty: uniformDifficulty('high') })),
  );
  return { traces: result, logCalls: counts.log };
}

describe('Playtest R1 - 核心循环与不变量', () => {
  const { traces, logCalls } = runBatch(SEEDS);

  it('R1-1 每局都能在步数上限内自然终局（不卡死）', () => {
    const stuck = traces.filter((t) => t.endReason === 'STEP_LIMIT');
    const detail = stuck.map((t) => `seed=${t.seed} steps=${t.steps} phase=${t.endPhase}`);
    expect(detail).toEqual([]);
    expect(traces.every((t) => t.steps > 0)).toBe(true);
  });

  it('R1-2 阶段顺序必须为 EXCHANGE → DING_QUE → PLAYING（→ END）', () => {
    for (const t of traces) {
      const head = t.phaseOrder.slice(0, 3);
      expect(head, `seed=${t.seed} phaseOrder=${t.phaseOrder.join('>')}`).toEqual([
        'EXCHANGE',
        'DING_QUE',
        'PLAYING',
      ]);
      // 阶段不得回退
      const idx = t.phaseOrder.map((p) => ['EXCHANGE', 'DING_QUE', 'PLAYING', 'END'].indexOf(p));
      const sorted = [...idx].sort((a, b) => a - b);
      expect(idx, `seed=${t.seed} 阶段发生回退`).toEqual(sorted);
    }
  });

  it('R1-3 全程牌张守恒（108 张）且每种牌不超过 4 张', () => {
    const bad = traces.flatMap((t) =>
      t.violations
        .filter((v) => v.startsWith('[TILE_CONSERVATION]') || v.startsWith('[TILE_KIND_OVERFLOW]'))
        .map((v) => `seed=${t.seed} ${v}`),
    );
    expect(bad).toEqual([]);
  });

  it('R1-4 手牌张数始终满足 13-3*副露数 (+1)', () => {
    const bad = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[HAND_SIZE]')).map((v) => `seed=${t.seed} ${v}`),
    );
    expect(bad).toEqual([]);
  });

  it('R1-5 定缺约束：手上仍有缺门牌时只能打缺门牌', () => {
    const bad = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[DINGQUE_DISCARD]')).map((v) => `seed=${t.seed} ${v}`),
    );
    expect(bad).toEqual([]);
  });

  it('R1-6 胡牌必须已完成缺一门（手牌+副露无定缺花色）', () => {
    const bad = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[HU_WITHOUT_QUE]')).map((v) => `seed=${t.seed} ${v}`),
    );
    expect(bad).toEqual([]);
  });

  it('R1-7 每位玩家都完成了定缺，且定缺值合法', () => {
    for (const t of traces) {
      for (const p of PLAYERS) {
        expect(['W', 'B', 'T'], `seed=${t.seed} ${p} dingQue=${t.dingQue[p]}`).toContain(t.dingQue[p]);
      }
    }
  });

  it('R1-8 血战到底：终局条件为「3 家胡牌」或「牌墙摸完」', () => {
    for (const t of traces) {
      expect(['THREE_HU', 'WALL_EMPTY', 'PHASE_END'], `seed=${t.seed}`).toContain(t.endReason);
      if (t.endReason === 'THREE_HU') {
        expect(t.huCount, `seed=${t.seed}`).toBeGreaterThanOrEqual(3);
      }
      // 血战到底：绝不允许 4 家全胡
      expect(t.huCount, `seed=${t.seed} huCount=${t.huCount}`).toBeLessThanOrEqual(3);
    }
  });

  it('R1-9 结算分数零和（Σ = 0）', () => {
    const bad = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[SCORE_NOT_ZERO_SUM]')).map((v) => `seed=${t.seed} ${v}`),
    );
    expect(bad).toEqual([]);
  });

  /**
   * 【回归门禁 QA-P0-002】getLegalActions 不得提供 applyAction 会拒绝的动作。
   * 修复前：`getLegalActions` 把 `DISCARD:lastPengTile` 列合法，applyAction 静默
   * 返回原 state（空转 → 活锁）。修复后 getLegalActions 先行过滤 lastPengTile。
   * 本测试在 harness 严格模式（__chengduStrictApply=true）下运行：任何被静默拒绝的
   * 动作都会抛 IllegalActionError，因此"无空转"即契约成立的正向证明。
   */
  it('R1-10 [回归门禁] getLegalActions 与 applyAction 契约一致：无任何空转动作', () => {
    const noops = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[ACTION_NOOP]')).map((v) => `seed=${t.seed} ${v}`),
    );
    expect(noops, '出现 applyAction 空转 → QA-P0-002 回归，请检查 lastPengTile 过滤').toEqual([]);
    // 兜底必须能恢复，绝不允许出现无法恢复的死局
    const dead = traces.flatMap((t) =>
      t.violations.filter((v) => v.startsWith('[UNRECOVERABLE]') || v.startsWith('[NO_LEGAL_ACTION]')),
    );
    expect(dead, 'DeadlockGuard 未能恢复').toEqual([]);
  });

  it('R1-11 汇总：打印本轮对局画像（作为报告证据）', () => {
    const lines = traces.map(
      (t) =>
        `seed=${t.seed} steps=${t.steps} turn=${t.turn} end=${t.endReason} hu=${t.huCount} ` +
        `wallLeft=${t.wallLeft} melds=${PLAYERS.map((p) => t.meldCounts[p]).join('/')} ` +
        `gang=${PLAYERS.map((p) => t.gangCounts[p]).join('/')} ` +
        `guard=${t.guardFires} ` +
        `scores=${PLAYERS.map((p) => t.scores[p]).join('/')}`,
    );
    const totalGuard = traces.reduce((a, t) => a + t.guardFires, 0);
    const gamesWithGuard = traces.filter((t) => t.guardFires > 0).length;
    // 用 console.info 输出，vitest 会原样展示，便于写入报告
    console.info('\n[R1 对局画像]\n' + lines.join('\n'));
    console.info(
      `\n[R1 DeadlockGuard 兜底统计] ${gamesWithGuard}/${SEEDS.length} 局依赖兜底才能推进，` +
        `共触发 ${totalGuard} 次`,
    );
    const sampleReasons = traces
      .filter((t) => t.guardReasons.length > 0)
      .slice(0, 4)
      .flatMap((t) => t.guardReasons.slice(0, 3).map((r) => `seed=${t.seed} ${r}`));
    if (sampleReasons.length) {
      console.info('\n[R1 兜底触发上下文样本]\n' + sampleReasons.join('\n'));
    }
    console.info(
      `\n[R1 热路径日志噪声] ${SEEDS.length} 局共触发 console.log ${logCalls} 次 ` +
        `(平均 ${(logCalls / SEEDS.length).toFixed(0)} 次/局)`,
    );
    expect(lines.length).toBe(SEEDS.length);
  });

  /**
   * 【回归门禁 QA-P0-001】剥离 DeadlockGuard 兜底后，纯规则层必须能自行闭环。
   * 修复前：加杠后规则层无人可推进（当前行动者只剩 PASS、抢杠胡窗口未开启），
   * 状态签名循环 → 活锁。修复后加杠落地生成"待抢杠"窗口，由 resolveReactions
   * 统一结算并补摸。本测试用 4 个曾活锁的 seed（deadlockGuard=false）做硬门禁。
   */
  it('R1-14 [回归门禁] 关闭 DeadlockGuard 后纯规则层也能自行闭环（加杠后不再活锁）', () => {
    const badSeeds = [1008, 1010, 1011, 1012];
    const { result: raw } = withSilencedConsole(() =>
      badSeeds.map((seed) =>
        driveOneGame({
          seed,
          difficulty: uniformDifficulty('high'),
          deadlockGuard: false,
          maxSteps: 600,
          trace: false,
        }),
      ),
    );
    const stalled = raw.filter((t) => t.endReason === 'STEP_LIMIT' || t.violations.length > 0);
    console.info(
      '\n[R1-14 纯规则层闭环验证（deadlockGuard=false）]\n' +
        raw
          .map(
            (t) =>
              `seed=${t.seed} end=${t.endReason} steps=${t.steps} hu=${t.huCount} wallLeft=${t.wallLeft} ` +
              `firstViolation=${t.violations[0] ?? '-'}`,
          )
          .join('\n'),
    );
    expect(
      stalled,
      '纯规则层仍活锁 → QA-P0-001 回归，请检查加杠后 getLegalActions/resolveReactions 推进',
    ).toEqual([]);
    expect(raw.every((t) => t.endReason !== 'STEP_LIMIT'), '仍有 seed 卡死').toBe(true);
  });

  it('R1-12 至少有一局出现碰或杠（副露路径被真实覆盖）', () => {
    const totalMelds = traces.reduce(
      (a, t) => a + PLAYERS.reduce((b, p) => b + t.meldCounts[p], 0),
      0,
    );
    expect(totalMelds, '12 局内未出现任何副露，说明碰/杠路径未被覆盖').toBeGreaterThan(0);
  });

  it('R1-13 至少有一局出现胡牌（胡牌路径被真实覆盖）', () => {
    const totalHu = traces.reduce((a, t) => a + t.huCount, 0);
    expect(totalHu, '12 局内无人胡牌，说明胡牌路径未被覆盖').toBeGreaterThan(0);
  });
});
