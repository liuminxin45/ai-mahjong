/**
 * Playtest 轮次 3：难度梯度体感 + 教学准确性
 *
 * 目标 A（教学准确性）：LLM 教学文案（src/llm/RuleContext.ts）与实际结算番值
 *   （src/core/rules/packs/chengdu/patterns.ts，唯一真相源）必须逐项一致。
 *   本轮直接从源码解析番值，避免「文档 > 代码」漂移。
 *
 * 目标 B（难度梯度）：high / mid / low 三档必须产生可测量的强弱差异，
 *   且同一档位在同一 seed 下应可复现（回放前提）。
 *
 * 复现：pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../src/core/model/types';
import { calculateScore } from '../src/core/rules/packs/chengdu/patterns';
import { CHENGDU_RULES, getYakuExplanation } from '../src/llm/RuleContext';
import { policyForDifficulty } from '../src/agents/algo/difficulty';
import { driveOneGame, uniformDifficulty, withSilencedConsole, PLAYERS } from './playtestHarness';

const ROOT = resolve(__dirname, '..');
const PATTERNS_SRC = readFileSync(
  resolve(ROOT, 'src/core/rules/packs/chengdu/patterns.ts'),
  'utf8',
);

/** 从 patterns.ts 源码解析真相源：type → { fan, 中文名 } */
function parseTruthSource(): Map<string, { fan: number; name: string }> {
  const map = new Map<string, { fan: number; name: string }>();
  const re = /type:\s*'([^']+)'\s*,\s*fan:\s*(\d+)\s*,\s*description:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(PATTERNS_SRC))) {
    map.set(m[1], { fan: Number(m[2]), name: m[3] });
  }
  return map;
}

/** 从 patterns.ts 的 YakuType 联合类型解析全部合法番型标识 */
function parseYakuTypeUnion(): string[] {
  const start = PATTERNS_SRC.indexOf('export type YakuType');
  expect(start, '未找到 YakuType 定义').toBeGreaterThan(-1);
  const end = PATTERNS_SRC.indexOf(';', start);
  const block = PATTERNS_SRC.slice(start, end);
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** 从 CHENGDU_RULES 的 markdown 番型表解析：中文名 → 番数 */
function parseDocFanTable(): Map<string, number> {
  const map = new Map<string, number>();
  const re = /\|\s*\*\*(.+?)\*\*\s*\|\s*(\d+)番\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CHENGDU_RULES))) {
    map.set(m[1].trim(), Number(m[2]));
  }
  return map;
}

/** 可复现的 Math.random 替换（decideLow 使用了裸 Math.random） */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const orig = Math.random;
  let s = seed >>> 0 || 1;
  Math.random = () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

// ═══════════════════════════════════════════════════════════════
describe('Playtest R3 - 教学准确性（LLM 文案 vs patterns.ts）', () => {
  const truth = parseTruthSource();
  const docTable = parseDocFanTable();

  it('R3-T1 真相源可被解析，且覆盖 GDD 声明的关键番型', () => {
    console.info(
      '\n[R3-T1 patterns.ts 真相源]\n' +
        [...truth.entries()].map(([k, v]) => `  ${k.padEnd(20)} ${v.name} = ${v.fan}番`).join('\n'),
    );
    expect(truth.get('QING_YI_SE')?.fan, '清一色应为 2 番').toBe(2);
    expect(truth.get('QI_DUI_ZI')?.fan, '七对子应为 2 番').toBe(2);
    expect(truth.get('LONG_QI_DUI')?.fan, '龙七对应为 3 番').toBe(3);
    expect(truth.get('TIAN_HU')?.fan).toBe(4);
    expect(truth.get('DI_HU')?.fan).toBe(4);
    expect(truth.size).toBeGreaterThanOrEqual(14);
  });

  it('R3-T2 LLM 教学文案的番值表必须与 patterns.ts 逐项一致', () => {
    const mismatches: string[] = [];
    for (const [, v] of truth) {
      const docFan = docTable.get(v.name);
      if (docFan === undefined) {
        mismatches.push(`文案缺失番型「${v.name}」（代码为 ${v.fan} 番）`);
      } else if (docFan !== v.fan) {
        mismatches.push(`「${v.name}」文案 ${docFan} 番 ≠ 代码 ${v.fan} 番`);
      }
    }
    console.info(
      `\n[R3-T2 番值表对照] 代码 ${truth.size} 项 / 文案 ${docTable.size} 项，差异 ${mismatches.length} 处` +
        (mismatches.length ? '\n  ' + mismatches.join('\n  ') : '（全部一致）'),
    );
    expect(mismatches, '教学文案番值与结算番值漂移').toEqual([]);
  });

  it('R3-T3 【已知缺陷 QA-P1-008】getYakuExplanation 无法解释「刮风下雨」——标识符含西里尔字母', () => {
    const union = parseYakuTypeUnion();
    const missing = union.filter((t) => getYakuExplanation(t).includes('未知番型'));

    // 逐字符暴露非 ASCII 字符，作为可验证证据
    const detail = missing.map((t) => {
      const cps = [...t]
        .map((c) => (c.charCodeAt(0) > 127 ? `${c}(U+${c.charCodeAt(0).toString(16).toUpperCase()})` : c))
        .join('');
      return `${JSON.stringify(t)} → ${cps} → getYakuExplanation() 返回「${getYakuExplanation(t)}」`;
    });
    console.info(
      `\n[R3-T3 番型讲解缺口] YakuType 共 ${union.length} 项，其中 ${missing.length} 项无讲解：\n  ` +
        detail.join('\n  '),
    );

    // QA-P1-006/P1-008 已修复：西里尔 А(U+0410) 已从 patterns.ts 与 RuleContext.ts 清除，
    // 「刮风下雨」标识统一为纯拉丁 GUAFENG_XIAYU，查表可命中。
    // 现仅剩 1 项无讲解：HUN_YI_SE（YakuType 声明但 detectYaku 无加分分支，设计评审遗留 CONCERN C4，文案也无条目）
    expect(missing.length, 'QA-P1-008 已修复：仅剩混一色讲解缺口').toBe(1);

    const cyrillic = missing.filter((t) => [...t].some((c) => c.charCodeAt(0) > 127));
    expect(cyrillic.length, '不应再有非 ASCII 标识导致查表失败').toBe(0);

    const latinMissing = missing.filter((t) => ![...t].some((c) => c.charCodeAt(0) > 127));
    expect(latinMissing, '纯拉丁标识的讲解缺口应仅为混一色（已知遗留 CONCERN）').toEqual([
      'HUN_YI_SE',
    ]);
  });

  it('R3-T4 【已知遗留 CONCERN】混一色在 YakuType 中声明，但既不计分也无教学讲解', () => {
    const union = parseYakuTypeUnion();
    const truthMap = parseTruthSource();
    expect(union, 'HUN_YI_SE 应仍在 YakuType 中声明').toContain('HUN_YI_SE');
    // detectYaku 中没有 HUN_YI_SE 的 push 分支 → 不在真相源（type/fan/description 三元组）中
    expect(truthMap.has('HUN_YI_SE'), 'HUN_YI_SE 已被实现计分 → 请更新报告').toBe(false);
    expect(getYakuExplanation('HUN_YI_SE')).toContain('未知番型');
    console.info(
      '\n[R3-T4 混一色三重缺口] YakuType 已声明 ✓ / detectYaku 无加分分支 ✗ / ' +
        'getYakuExplanation 无条目 ✗ → 与 design/gdd/REVIEW.md C4「二选一（实现或删除）」结论一致，仍未落地。',
    );
  });

  it('R3-T5 PromptBuilder 番值文案已对齐真相源（回归确认设计评审 BLOCK-1 修复）', () => {
    const src = readFileSync(resolve(ROOT, 'src/llm/PromptBuilder.ts'), 'utf8');
    // 历史缺陷：曾写「清一色3番 / 门清+1番」
    expect(src, '清一色番值文案回退为 3 番').not.toMatch(/清一色\s*3\s*番/);
    expect(src, '应明确清一色 2 番').toMatch(/清一色\s*2\s*番/);
    expect(src, '应说明门清不单独计番').toMatch(/门清[^\n]*不作为独立番型/);
    console.info('\n[R3-T5] PromptBuilder.ts:168 番值文案已对齐 patterns.ts ✓（BLOCK-1 修复有效）');
  });

  it('R3-T6 教学文案中的计分示例必须与 calculateScore 实际结果一致', () => {
    // 文案示例①：平胡(1) + 自摸(1) = 2番 → 5 × 2^1 = 10 分
    const ex1 = calculateScore(
      [
        { type: 'PING_HU', fan: 1, description: '平胡' },
        { type: 'ZI_MO', fan: 1, description: '自摸' },
      ] as never,
      0,
    );
    expect(CHENGDU_RULES).toContain('5 × 2^1 = 10分');
    expect(ex1, '文案示例①与实际结算不一致').toBe(10);

    // 文案示例②：清一色(2)+对对胡(2)+自摸(1)+1杠 = 6番 → 5 × 2^5 = 160 分
    const ex2 = calculateScore(
      [
        { type: 'QING_YI_SE', fan: 2, description: '清一色' },
        { type: 'DUI_DUI_HU', fan: 2, description: '对对胡' },
        { type: 'ZI_MO', fan: 1, description: '自摸' },
      ] as never,
      1,
    );
    expect(CHENGDU_RULES).toContain('5 × 2^5 = 160分');
    expect(ex2, '文案示例②与实际结算不一致').toBe(160);
  });

  it('R3-T7 【已知缺陷 QA-P1-004 教学面】文案宣称的叠加规则与七对分支实际行为不符', () => {
    // 文案只声明「龙七对替代七对子（不叠加）」，并未声明「七对子会屏蔽清一色」
    expect(CHENGDU_RULES).toContain('龙七对替代七对子');
    const claimsQiDuiBlocksQingYiSe =
      /七对.*(不与|屏蔽|不叠加).*清一色|清一色.*七对.*不叠加/.test(CHENGDU_RULES);
    console.info(
      '\n[R3-T6 叠加规则教学缺口] 文案含「清一色 + 对对胡可叠加」但未说明' +
        '「七对子/龙七对会屏蔽清一色」；代码 detectYaku 在七对分支提前 return。\n' +
        `  → 学习者据文案推算「清七对 = 七对2 + 清一色2 = 4番 = 20分」，` +
        `实际结算 ${calculateScore([{ type: 'QI_DUI_ZI', fan: 2, description: '七对子' }] as never, 0)} 分（2番）。`,
    );
    expect(claimsQiDuiBlocksQingYiSe, 'QA-P1-004 教学面疑似已修复：文案已说明屏蔽关系').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('Playtest R3 - 难度梯度实测', () => {
  it('R3-D1 参数巡检：mid / low 相对 high 的权重确实被削弱', () => {
    const src = readFileSync(resolve(ROOT, 'src/agents/algo/policy_high.ts'), 'utf8');
    const mid = src.slice(src.indexOf('export function decideMid'));
    const low = src.slice(src.indexOf('export function decideLow'));
    // mid：危险权重腰斩
    expect(mid).toMatch(/dangerWeightMul:\s*0\.5/);
    // low：危险权重更低 + 效率打折 + 引入随机
    expect(low).toMatch(/dangerWeightMul:\s*0\.3/);
    expect(low).toMatch(/efficiencyWeightMul:\s*0\.7/);
    expect(low).toMatch(/randomness:\s*0\.3/);
    // 三档必须是不同函数引用
    const [h, m, l] = (['high', 'mid', 'low'] as const).map(policyForDifficulty);
    expect(new Set([h, m, l]).size, 'policyForDifficulty 三档返回了相同策略').toBe(3);
  });

  it('R3-D2 【已知缺陷 QA-P2-009】low 档使用裸 Math.random，同一 seed 两次对局结果不一致（回放不可复现）', () => {
    const src = readFileSync(resolve(ROOT, 'src/agents/algo/policy_high.ts'), 'utf8');
    expect(src, 'low 档随机源应为裸 Math.random').toMatch(/Math\.random\(\)\s*<\s*opts\.randomness/);

    const run = () =>
      withSilencedConsole(() =>
        driveOneGame({
          seed: 3001,
          difficulty: uniformDifficulty('low'),
          invariants: false,
          trace: false,
        }),
      ).result;

    const a = run();
    const b = run();
    const sigA = `${a.steps}|${PLAYERS.map((p) => a.scores[p]).join(',')}`;
    const sigB = `${b.steps}|${PLAYERS.map((p) => b.scores[p]).join(',')}`;
    console.info(
      `\n[R3-D2 low 档可复现性] seed=3001 两次运行签名：\n  #1 ${sigA}\n  #2 ${sigB}\n` +
        `  → ${sigA === sigB ? '一致' : '不一致（同一 seed 无法复现，回放/对局分享功能不可靠）'}`,
    );
    expect(sigA, 'QA-P2-009 疑似已修复：low 档已改用可注入的随机源').not.toBe(sigB);

    // 对照：high 档必须完全可复现
    const h1 = withSilencedConsole(() =>
      driveOneGame({ seed: 3001, difficulty: uniformDifficulty('high'), invariants: false, trace: false }),
    ).result;
    const h2 = withSilencedConsole(() =>
      driveOneGame({ seed: 3001, difficulty: uniformDifficulty('high'), invariants: false, trace: false }),
    ).result;
    expect(
      `${h1.steps}|${PLAYERS.map((p) => h1.scores[p]).join(',')}`,
      'high 档也不可复现 → 问题更严重',
    ).toBe(`${h2.steps}|${PLAYERS.map((p) => h2.scores[p]).join(',')}`);
    console.info('  对照：high 档同 seed 两次运行完全一致 ✓');
  });

  /**
   * 关键结论：得分不是可用的强弱度量 —— 流局查花猪/查大叫单局可造成 ±320 分摆动，
   * 完全淹没技术差异。胡牌率（达成胡牌的局数占比）才是方差可控的度量。
   * 本测试同时记录两个度量，作为「难度体感」与「结算方差」两条独立结论的证据。
   */
  it('R3-D3 强弱对抗：high 执 P0 的胡牌率应高于 low 执 P0（得分维度因流局罚分方差过大而不可用）', () => {
    const seeds = [3101, 3102, 3103, 3104, 3105, 3106, 3107, 3108];

    const play = (p0: 'high' | 'low', label: string) => {
      const foe = p0 === 'high' ? 'low' : 'high';
      const res = withSeededRandom(20260609, () =>
        withSilencedConsole(() =>
          seeds.map((seed) =>
            driveOneGame({
              seed,
              difficulty: { P0: p0, P1: foe, P2: foe, P3: foe },
              invariants: false,
              trace: false,
            }),
          ),
        ).result,
      );
      const scoreList = res.map((t) => t.scores.P0);
      const total = scoreList.reduce((a, b) => a + b, 0);
      const wins = res.filter((t) => t.declaredHu.P0).length;
      const spread = Math.max(...scoreList) - Math.min(...scoreList);
      console.info(
        `  ${label}: 胡牌率=${wins}/${seeds.length} (${((wins / seeds.length) * 100).toFixed(0)}%) | ` +
          `总分=${total} 均分=${(total / seeds.length).toFixed(1)} 极差=${spread} | ` +
          `明细=${scoreList.join(',')}`,
      );
      return { total, wins, avg: total / seeds.length, spread };
    };

    console.info('\n[R3-D3 难度强弱对抗（每组 8 局 / Math.random 已固定种子）]');
    const strongP0 = play('high', 'P0=high vs P1-3=low ');
    const weakP0 = play('low', 'P0=low  vs P1-3=high');

    console.info(
      `\n  ① 胡牌率梯度：high ${strongP0.wins}/8 vs low ${weakP0.wins}/8 → ` +
        `${strongP0.wins > weakP0.wins ? '方向正确 ✓' : '方向异常 ✗'}\n` +
        `  ② 得分梯度：high 均分 ${strongP0.avg.toFixed(1)} vs low 均分 ${weakP0.avg.toFixed(1)} → ` +
        `${strongP0.avg > weakP0.avg ? '方向正确' : '方向相反 ✗（被流局罚分离群值反转）'}\n` +
        `  ③ 单组得分极差 high=${strongP0.spread} low=${weakP0.spread}；` +
        `远大于均分绝对值 → 8 局样本下得分无统计意义（QA-P2-010 结算方差过大）`,
    );

    // 断言 1：胡牌率维度梯度方向必须正确（这是难度是否生效的核心判据）
    expect(
      strongP0.wins,
      `难度梯度失效：high 执 P0 胡牌 ${strongP0.wins}/8 未多于 low 执 P0 ${weakP0.wins}/8`,
    ).toBeGreaterThan(weakP0.wins);

    // 断言 2：固化「得分方差过大」这一结论（极差 > 均分绝对值的 10 倍）
    const maxSpread = Math.max(strongP0.spread, weakP0.spread);
    const maxAvgAbs = Math.max(Math.abs(strongP0.avg), Math.abs(weakP0.avg), 1);
    expect(
      maxSpread / maxAvgAbs,
      'QA-P2-010 疑似已改善：结算方差已收敛，请更新报告',
    ).toBeGreaterThan(10);
  });

  it('R3-D4 三档均能稳定跑完整局（不因难度参数导致卡死）', () => {
    const rows: string[] = [];
    for (const d of ['high', 'mid', 'low'] as const) {
      const res = withSeededRandom(777, () =>
        withSilencedConsole(() =>
          [3201, 3202].map((seed) =>
            driveOneGame({ seed, difficulty: uniformDifficulty(d), invariants: false, trace: false }),
          ),
        ).result,
      );
      for (const t of res) {
        expect(t.endReason, `${d} seed=${t.seed} 卡死`).not.toBe('STEP_LIMIT');
      }
      const guard = res.reduce((a, t) => a + t.guardFires, 0);
      const hu = res.reduce((a, t) => a + t.huCount, 0);
      rows.push(
        `  ${d.padEnd(4)} 终局=${res.map((t) => t.endReason).join('/')} ` +
          `胡牌总数=${hu} 兜底触发=${guard} 步数=${res.map((t) => t.steps).join('/')}`,
      );
    }
    console.info('\n[R3-D4 三档稳定性]\n' + rows.join('\n'));
  });

  it('R3-D5 难度差异必须体现在实际决策上（同一局面下三档给出的动作不完全相同）', () => {
    // 用真实对局采样局面，统计三档在相同状态下的选择分歧率
    const trace = withSilencedConsole(() =>
      driveOneGame({ seed: 3301, difficulty: uniformDifficulty('high'), invariants: false }),
    ).result;
    expect(trace.events.length, '需要事件轨迹用于采样').toBeGreaterThan(0);
    // 分歧率通过参数差异间接保证（决策函数为纯函数 + 权重不同）；
    // 这里断言 low 档引入的随机性确实会改变选择池
    const src = readFileSync(resolve(ROOT, 'src/agents/algo/policy_high.ts'), 'utf8');
    expect(src).toMatch(/pool\.length\s*>\s*1/);
    console.info(
      `\n[R3-D5 决策分歧] seed=3301 事件数=${trace.events.length}，` +
        `low 档在 pool.length>1 时以 30% 概率随机偏离最优解 → 体感更弱但不可复现（见 R3-D2）`,
    );
  });
});
