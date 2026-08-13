/**
 * Playtest 轮次 2：边界场景与计分正确性
 *
 * 目标：验证成都血战特有的边界规则是否正确触发与计分：
 *   流局（查花猪 / 查大叫）、金钩钓、天胡/地胡、番型叠加。
 *
 * 真相源：src/core/rules/packs/chengdu/patterns.ts（番值）
 *        src/core/rules/packs/chengdu/index.ts（流局结算）
 *
 * 复现：pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts
 *
 * 说明：本轮以「特征化测试」方式固定当前实现行为。凡标注【已知缺陷】的断言，
 *      一旦实现被修复，断言会失败 —— 这是有意为之的回归绊线，提醒同步更新
 *      本文件与 production/playtest/PLAYTEST_REPORT.md。
 */
import { describe, expect, it } from 'vitest';
import type { GameState, Meld } from '../src/core/model/state';
import type { PlayerId } from '../src/core/model/types';
import type { Tile } from '../src/core/model/tile';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import {
  calculateScore,
  detectYaku,
  findWinPatterns,
  hasQueYiMen,
} from '../src/core/rules/packs/chengdu/patterns';
import { getTenpaiTiles, isTenpai } from '../src/core/rules/packs/chengdu/tenpai';
import { PLAYERS, driveOneGame, uniformDifficulty, withSilencedConsole } from './playtestHarness';

type Suit = 'W' | 'B' | 'T';

/** 简写构牌：'W123 B99' → Tile[] */
function tiles(spec: string): Tile[] {
  const out: Tile[] = [];
  for (const group of spec.trim().split(/\s+/)) {
    const suit = group[0] as Suit;
    for (const ch of group.slice(1)) {
      out.push({ suit, rank: Number(ch) as Tile['rank'] });
    }
  }
  return out;
}

function peng(spec: string, from: PlayerId = 'P1'): Meld {
  return { type: 'PENG', tile: tiles(spec)[0], from } as Meld;
}

function yakuOf(list: Array<{ type: string; fan: number }>, type: string) {
  return list.find((y) => y.type === type);
}

function fanSum(list: Array<{ fan: number }>): number {
  return list.reduce((a, y) => a + y.fan, 0);
}

/** 构造一个「牌墙摸完、无人胡牌」的流局态，用于驱动 settleRound 的查花猪/查大叫 */
function makeDrawState(cfg: {
  hands: Record<PlayerId, Tile[]>;
  melds?: Partial<Record<PlayerId, Meld[]>>;
  dingQue: Record<PlayerId, Suit>;
}): GameState {
  const empty = { P0: [], P1: [], P2: [], P3: [] } as Record<PlayerId, never[]>;
  return {
    wall: [],
    hands: cfg.hands,
    discards: { ...empty },
    melds: {
      P0: cfg.melds?.P0 ?? [],
      P1: cfg.melds?.P1 ?? [],
      P2: cfg.melds?.P2 ?? [],
      P3: cfg.melds?.P3 ?? [],
    },
    lastDiscard: null,
    declaredHu: { P0: false, P1: false, P2: false, P3: false },
    currentPlayer: 'P0',
    phase: 'PLAYING',
    turn: 60,
    dingQueSelection: { ...cfg.dingQue },
  } as unknown as GameState;
}

// ───────────────────────────────────────────────────────────────
describe('Playtest R2 - 边界场景与计分', () => {
  // ============ A. 听牌判定（查大叫的前置） ============
  describe('R2-A 听牌判定 / 查大叫前置', () => {
    it('R2-A1 门清 13 张听牌可被正确识别', () => {
      // W123 W456 W789 B11 + 听 B1(金钩钓) → 13 张
      const hand = tiles('W123456789 B11 T11');
      expect(hand.length).toBe(13);
      const waits = getTenpaiTiles(hand);
      expect(waits.length, `听牌张=${waits.map((t) => t.suit + t.rank).join(',')}`).toBeGreaterThan(0);
      expect(isTenpai(hand)).toBe(true);
    });

    it('R2-A2 【已知缺陷 QA-P1-003】有副露的玩家即使已听牌，isTenpai 一律返回 false', () => {
      // 1 副碰 → 手牌 10 张。W123 W456 W789 B1，明确听 B1（成牌 W123456789 B11）
      const handWithMeld = tiles('W123456789 B1');
      expect(handWithMeld.length).toBe(10);

      // 补上碰的 3 张后确实是有效胡牌型 → 证明「实质上已听牌」
      const completed = [...handWithMeld, ...tiles('B1'), ...tiles('T111')];
      expect(completed.length).toBe(14);
      expect(findWinPatterns(completed).some((p) => p.isValid)).toBe(true);

      // 但 getTenpaiTiles 因硬编码 length !== 13 直接返回空
      expect(getTenpaiTiles(handWithMeld), 'QA-P1-003 疑似已修复，请更新报告').toEqual([]);
      expect(isTenpai(handWithMeld), 'QA-P1-003 疑似已修复，请更新报告').toBe(false);
    });

    it('R2-A3 【已知缺陷 QA-P1-003 影响面】流局时听牌的副露玩家被误判为「大叫」并遭罚分', () => {
      // 全员定缺 T 且手上/副露均无 T → 无人是花猪，从而隔离出「查大叫」单一变量
      const p0Hand = tiles('W123456789 B1122'); // 13 张门清听牌（听 B1/B2）
      const p1Hand = tiles('W123456789 B1'); //   10 张 + 1 副碰，实质听 B1
      const p2Hand = tiles('W1379 B24689 B1357');
      const p3Hand = tiles('W2468 B13579 B2468');
      expect(p0Hand.length).toBe(13);
      expect(p1Hand.length).toBe(10);
      expect(p2Hand.length).toBe(13);
      expect(p3Hand.length).toBe(13);

      // 前提校验：P0 真听牌；P2/P3 真未听牌
      expect(isTenpai(p0Hand), 'P0 应为听牌').toBe(true);
      expect(isTenpai(p2Hand), 'P2 应为未听牌').toBe(false);
      expect(isTenpai(p3Hand), 'P3 应为未听牌').toBe(false);
      // P1 实质听牌：补上碰的 3 张 + 听牌张后成立
      expect(
        findWinPatterns([...p1Hand, ...tiles('B1')]).some((p) => p.isValid),
        'P1 应为实质听牌（11 张构型成立）',
      ).toBe(true);

      const state = makeDrawState({
        hands: { P0: p0Hand, P1: p1Hand, P2: p2Hand, P3: p3Hand },
        melds: { P1: [peng('B999')] }, // 副露也不含定缺花色 T
        dingQue: { P0: 'T', P1: 'T', P2: 'T', P3: 'T' },
      });

      const result = chengduRulePack.settleRound(state);
      const scores = result.scores as Record<PlayerId, number>;
      const sum = PLAYERS.reduce((a, p) => a + scores[p], 0);

      console.info(
        `\n[R2-A3 流局查大叫结算] scores=${PLAYERS.map((p) => `${p}:${scores[p]}`).join(' ')} Σ=${sum}` +
          `\n  P0 门清听牌 → 受偿；P1 副露实质听牌却被当作「大叫」赔付；P2/P3 真未听牌赔付`,
      );
      expect(sum, '流局结算必须零和').toBe(0);
      expect(scores.P0, 'P0 门清听牌应受偿').toBeGreaterThan(0);
      // QA-P1-003 已修复：isTenpai 传入副露数，副露听牌玩家不再被误判大叫而受罚
      expect(scores.P1, '副露听牌玩家应受偿而非被罚').toBeGreaterThan(0);
    });
  });

  // ============ B. 番型叠加正确性 ============
  describe('R2-B 番型叠加（对照 patterns.ts）', () => {
    it('R2-B1 基准：清一色 = 2 番，七对子 = 2 番，龙七对 = 3 番（与 GDD 一致）', () => {
      // 清一色（顺子型，非七对）：W111 + W234 + W567 + W999 + W88 = 14 张
      const qys = tiles('W111 W234 W567 W999 W88');
      expect(qys.length).toBe(14);
      const p1 = findWinPatterns(qys).find((p) => p.isValid);
      expect(p1, '清一色测试牌型不成立').toBeTruthy();
      const y1 = detectYaku(p1!, qys, tiles('W2')[0], false, 0, false, false, false, false, false);
      expect(yakuOf(y1, 'QING_YI_SE')?.fan).toBe(2);

      // 七对子（三色混合，避免触发清一色）
      const qdz = tiles('W1122 B3344 T5566 T77');
      expect(qdz.length).toBe(14);
      const p2 = findWinPatterns(qdz).find((p) => p.isValid);
      const y2 = detectYaku(p2!, qdz, tiles('T7')[0], false, 0, false, false, false, false, false);
      expect(yakuOf(y2, 'QI_DUI_ZI')?.fan).toBe(2);

      // 龙七对（含 4 张同牌）
      const lqd = tiles('W1111 B3344 T5566 T77');
      expect(lqd.length).toBe(14);
      const p3 = findWinPatterns(lqd).find((p) => p.isValid);
      const y3 = detectYaku(p3!, lqd, tiles('T7')[0], false, 0, false, false, false, false, false);
      expect(yakuOf(y3, 'LONG_QI_DUI')?.fan).toBe(3);
      expect(yakuOf(y3, 'QI_DUI_ZI')).toBeUndefined();
    });

    it('R2-B2 【已知缺陷 QA-P1-004】清七对（七对子+清一色）只算 2 番，清一色未叠加', () => {
      // 全万字七对 → 线下成都麻将口径应为 七对子2 + 清一色2 = 4 番
      const hand = tiles('W1122334455667 7');
      const clean = tiles('W11223344556677');
      expect(clean.length).toBe(14);
      expect(new Set(clean.map((t) => t.suit)).size, '应为纯一色').toBe(1);
      void hand;

      const p = findWinPatterns(clean).find((p) => p.isValid);
      expect(p).toBeTruthy();
      const y = detectYaku(p!, clean, tiles('W7')[0], false, 0, false, false, false, false, false);

      console.info(
        `\n[R2-B2 清七对番型] ${y.map((x) => `${x.type}(${x.fan})`).join(' + ')} = ${fanSum(y)} 番，` +
          `底分结算=${calculateScore(y as any, 0)}`,
      );
      expect(yakuOf(y, 'QI_DUI_ZI')?.fan).toBe(2);
      // QA-P1-004 已修复（方案 A）：七对不再提前 return，清一色正确叠加
      expect(yakuOf(y, 'QING_YI_SE')?.fan).toBe(2);
      expect(fanSum(y), '清七对=七对2+清一色2=4番').toBe(4);
    });

    it('R2-B3 【已知缺陷 QA-P1-004】清龙七对只算 3 番（应为 龙七对3 + 清一色2 = 5 番）', () => {
      const hand = tiles('W11112233445566');
      expect(hand.length).toBe(14);
      const p = findWinPatterns(hand).find((p) => p.isValid);
      expect(p).toBeTruthy();
      const y = detectYaku(p!, hand, tiles('W6')[0], false, 0, false, false, false, false, false);
      console.info(
        `\n[R2-B3 清龙七对番型] ${y.map((x) => `${x.type}(${x.fan})`).join(' + ')} = ${fanSum(y)} 番`,
      );
      expect(yakuOf(y, 'LONG_QI_DUI')?.fan).toBe(3);
      // QA-P1-004 已修复（方案 A）：龙七对不再提前 return，清一色正确叠加
      expect(yakuOf(y, 'QING_YI_SE')?.fan).toBe(2);
      expect(fanSum(y), '清龙七对=龙七对3+清一色2=5番').toBe(5);
    });

    it('R2-B4 【已知缺陷 QA-P1-005】清一色只看手牌不看副露 → 副露异色时产生「假清一色」', () => {
      // 真实代码路径：evaluateSelfDrawScore 传入 state.hands[playerId]（不含副露）。
      // 1 副碰 → 手牌 11 张，findWinPatterns 接受 3n+2，故 11 张构型合法。
      const handAllW = tiles('W111 W234 W567 W99'); // 11 张，全万
      expect(handAllW.length).toBe(11);
      const pat = findWinPatterns(handAllW).find((pp) => pp.isValid);
      expect(pat, '11 张构型应成立（findWinPatterns 接受 3n+2）').toBeTruthy();

      // 该玩家实际碰了 T111（条子）→ 完整牌型是 万+条 混色，绝非清一色
      const actualMeld = peng('T111');
      expect(actualMeld.tile.suit).toBe('T');

      // 但 detectYaku 签名里没有 melds，suits 集合只由 hand 计算
      const y = detectYaku(pat!, handAllW, tiles('W9')[0], true, 1, false, false, false, false, false);
      expect(
        yakuOf(y, 'QING_YI_SE'),
        'QA-P1-005 疑似已修复：detectYaku 已考虑副露花色',
      ).toBeTruthy();
      console.info(
        `\n[R2-B4 假清一色] 手牌 11 张全万 + 碰 T111 → detectYaku(meldCount=1) 仍判 ` +
          `${y.map((x) => `${x.type}(${x.fan})`).join(' + ')}；` +
          `清一色 +2 番为误判（detectYaku 签名中无 melds 参数）`,
      );
    });

    it('R2-B5 计分公式：底分 5 × 2^(总番+杠数-1)', () => {
      const ping = [{ type: 'PING_HU' as const, fan: 1, description: '平胡' }];
      expect(calculateScore(ping, 0)).toBe(5); // 5 * 2^0
      expect(calculateScore(ping, 1)).toBe(10); // 每杠 +1 番
      expect(calculateScore(ping, 2)).toBe(20);
      const qys = [{ type: 'QING_YI_SE' as const, fan: 2, description: '清一色' }];
      expect(calculateScore(qys, 0)).toBe(10); // 5 * 2^1
      const lqd = [{ type: 'LONG_QI_DUI' as const, fan: 3, description: '龙七对' }];
      expect(calculateScore(lqd, 0)).toBe(20); // 5 * 2^2
      // 极端：龙七对 + 双杠 = 5 番 → 80；这是 R1 中出现 ±320 巨额分差的来源
      expect(calculateScore(lqd, 2)).toBe(80);
    });
  });

  // ============ C. 天胡 / 地胡 / 金钩钓 ============
  describe('R2-C 特殊胡牌', () => {
    it('R2-C1 天胡 4 番、地胡 4 番按参数正确注入', () => {
      const hand = tiles('W1122 B3344 T5566 T77');
      const p = findWinPatterns(hand).find((pp) => pp.isValid)!;
      const tian = detectYaku(p, hand, tiles('T7')[0], true, 0, false, false, false, true, false);
      expect(yakuOf(tian, 'TIAN_HU')?.fan).toBe(4);
      const di = detectYaku(p, hand, tiles('T7')[0], false, 0, false, false, false, false, true);
      expect(yakuOf(di, 'DI_HU')?.fan).toBe(4);
    });

    it('R2-C2 【规则口径风险 QA-P2-006】金钩钓仅判「胡牌张在将牌组」，不要求全副露', () => {
      // 门清 14 张、4 副面子 + 1 将，胡的是将牌 → 当前实现给 2 番金钩钓
      const hand = tiles('W123 W456 B111 B555 W99');
      expect(hand.length).toBe(14);
      const p = findWinPatterns(hand).find((pp) => pp.isValid);
      expect(p, '构型不成立').toBeTruthy();
      const y = detectYaku(p!, hand, tiles('W9')[0], false, 0, false, false, false, false, false);
      expect(yakuOf(y, 'JIN_GOU_DIAO')?.fan, '口径若改为「须全副露」则此处会失败').toBe(2);
      console.info(
        '\n[R2-C2 金钩钓口径] 门清（meldCount=0）胡将牌即得 2 番。' +
          '线下成都麻将通常要求「全部副露、仅剩单吊将」。文档/LLM/代码三处口径一致（自定义口径），' +
          '但与线下规则不一致 → 教学平台需在 UI 明示。',
      );
    });

    it('R2-C3 天胡触发条件依赖 playerId === P0 && turn === 0（座位硬编码）', () => {
      // 这是实现细节巡检：天胡只可能发生在 P0，且 turn 必须为 0
      const src = chengduRulePack.buildInitialState(true);
      expect(src.turn).toBe(0);
      expect(src.currentPlayer).toBe('P0');
      // P0 起手 14 张（庄家多摸一张）→ 天胡窗口成立
      expect(src.hands.P0.length).toBe(14);
      for (const p of ['P1', 'P2', 'P3'] as PlayerId[]) {
        expect(src.hands[p].length).toBe(13);
      }
    });

    it('R2-C4 地胡触发窗口可达：P0 的首次弃牌确实发生在 state.turn === 1', () => {
      // 地胡条件（index.ts:1131）：turn === 1 && discard.from === 'P0' && 胡牌者 !== 'P0'
      // 若 P0 首弃发生在 turn !== 1，该分支即为不可达代码 → 地胡永不生效。
      const trace = withSilencedConsole(() =>
        driveOneGame({ seed: 1001, difficulty: uniformDifficulty('high'), invariants: false }),
      ).result;

      // 注意：必须取「反应结算时点」的 turn（resolveReactions 读取的值），
      // 而不是事件轨迹里 applyAction 之前的 turn 标签 —— 两者相差 1。
      const reactionTurn = trace.firstP0DiscardReactionTurn;
      const eventLabel = trace.events.find((e) => /^turn\d+ P0 DISCARD/.test(e));
      expect(reactionTurn, '未采集到 P0 弃牌的反应结算时点').toBeDefined();
      console.info(
        `\n[R2-C4 地胡窗口可达性] 事件标签（applyAction 前）=「${eventLabel}」；` +
          `反应结算时点 state.turn=${reactionTurn}\n` +
          `  地胡条件要求 turn===1 → ${reactionTurn === 1 ? '窗口可达 ✓' : '窗口不可达 ✗（地胡为死代码）'}`,
      );
      expect(reactionTurn, '地胡触发窗口不可达 → 地胡为死代码').toBe(1);
    });
  });

  // ============ D. 流局：查花猪 ============
  describe('R2-D 流局查花猪', () => {
    it('R2-D1 花猪（未完成缺一门）向非花猪玩家赔付，且结算零和', () => {
      // P0 定缺 T 但手上仍有 T → 花猪；P1 听牌；P2/P3 未听牌
      const state = makeDrawState({
        hands: {
          P0: tiles('W123456789 T111 T1'),
          P1: tiles('W123456789 B1122'),
          P2: tiles('W1379 B24689 B1357'),
          P3: tiles('W2468 B13579 B2468'),
        },
        dingQue: { P0: 'T', P1: 'T', P2: 'T', P3: 'T' },
      });

      const result = chengduRulePack.settleRound(state);
      const scores = result.scores as Record<PlayerId, number>;
      const sum = PLAYERS.reduce((a, p) => a + scores[p], 0);
      console.info(
        `\n[R2-D1 查花猪+查大叫叠加结算] scores=${PLAYERS.map((p) => `${p}:${scores[p]}`).join(' ')} Σ=${sum}` +
          `\n  P0 花猪向 P1/P2/P3 各赔付；随后 P2/P3（未听牌）又向 P1（听牌）赔付查大叫 →` +
          `\n  P2/P3 两笔相抵后可能净额为 0，玩家在结算界面上会看到「花猪没赔我钱」的错觉（QA-P2-007 体验问题）`,
      );
      expect(sum, '查花猪结算必须零和').toBe(0);
      expect(scores.P0, '花猪必须被罚分').toBeLessThan(0);
      expect(scores.P1, '听牌且非花猪应受偿').toBeGreaterThan(0);
      // 记录 P2/P3 净额（查花猪受偿与查大叫赔付相抵）
      console.info(
        `  P2 净额=${scores.P2} P3 净额=${scores.P3}（查花猪 +N 与查大叫 -N 相抵）`,
      );
    });

    it('R2-D2 三人胡牌（非流局）时不触发查花猪/查大叫', () => {
      const state = makeDrawState({
        hands: {
          P0: tiles('W123456789 T111 T1'), // 花猪牌型
          P1: tiles('W123456789 B1122'),
          P2: tiles('W1379 B2468 B13579'),
          P3: tiles('W2468 B1379 B24689'),
        },
        dingQue: { P0: 'T', P1: 'T', P2: 'T', P3: 'T' },
      });
      (state as any).declaredHu = { P0: false, P1: true, P2: true, P3: true };
      const result = chengduRulePack.settleRound(state);
      const scores = result.scores as Record<PlayerId, number>;
      console.info(
        `\n[R2-D2 三家胡牌不查花猪] scores=${PLAYERS.map((p) => `${p}:${scores[p]}`).join(' ')}`,
      );
      // 3 家已胡 → isDrawEnd=false → 不应追加任何罚分
      expect(PLAYERS.every((p) => scores[p] === 0), '非流局不应触发流局罚分').toBe(true);
    });

    it('R2-D3 hasQueYiMen：手牌+副露均无定缺花色才算完成缺一门', () => {
      // 手牌无 T，但碰了 T111 → 未完成缺一门
      expect(hasQueYiMen(tiles('W123 B456'), [peng('T111')], 'T')).toBe(false);
      // 手牌与副露都无 T → 完成
      expect(hasQueYiMen(tiles('W123 B456'), [peng('B999')], 'T')).toBe(true);
      // 手牌含 T → 未完成
      expect(hasQueYiMen(tiles('W123 T1'), [], 'T')).toBe(false);
    });
  });
});
