import type { Tile } from '../core/model/tile';
import { tileToString } from '../core/model/tile';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import {
  handToCounts,
  shantenWithMelds,
  ukeireTilesWithMelds,
} from '../agents/algo/shanten';
import type { DangerLevel } from '../agents/algo/danger';
import { evaluateTileDanger } from '../agents/algo/danger';
import type { GameStyle } from '../agents/algo/style';
import { styleBadgeText } from '../agents/algo/style';

export type DiscardRecommendation = {
  discard: string;
  shantenBefore: number;
  shantenAfter: number;
  ukeireTotal: number;
  ukeireTop: string[];
  dangerLevel: DangerLevel;
  dangerReasons: string[];
  style: GameStyle;
  styleReasons: string[];
};

export type ReactionRecommendation = {
  action: string;
  shantenBefore: number;
  shantenAfter: number;
  ukeireBefore?: number;
  ukeireAfter?: number;
};

function pairKinds(hand13: Tile[]): number {
  const c = handToCounts(hand13);
  let n = 0;
  for (const x of c) if (x >= 2) n++;
  return n;
}

export class HeuristicAnalyzer {
  recommendDiscards(
    hand14: Tile[],
    meldCount = 0,
    ctx?: { state: GameState; playerId: PlayerId; style?: { style: GameStyle; reasons: string[] } },
  ): DiscardRecommendation[] {
    if (hand14.length !== 14) return [];
    const style: GameStyle = ctx?.style?.style ?? 'BALANCED';
    const styleReasons: string[] = ctx?.style?.reasons ?? [];
    const shantenBefore = shantenWithMelds(hand14, meldCount);

    type Cand = { idx: number; rec: DiscardRecommendation; pairKinds: number };
    const cands: Cand[] = [];
    for (let i = 0; i < hand14.length; i++) {
      const hand13 = hand14.slice(0, i).concat(hand14.slice(i + 1));
      const shantenAfter = shantenWithMelds(hand13, meldCount);
      const u = ukeireTilesWithMelds(hand13, meldCount);
      const ukeireTop = u.byTile
        .slice(0, 6)
        .map((x) => `${tileToString(x.tile)} x${x.count}`);

      const danger = ctx
        ? evaluateTileDanger(ctx.state, ctx.playerId, hand14[i])
        : { level: 'MEDIUM' as const, reasons: [] as string[] };

      cands.push({
        idx: i,
        pairKinds: pairKinds(hand13),
        rec: {
          discard: tileToString(hand14[i]),
          shantenBefore,
          shantenAfter,
          ukeireTotal: u.total,
          ukeireTop,
          dangerLevel: danger.level,
          dangerReasons: danger.reasons,
          style,
          styleReasons,
        },
      });
    }

    cands.sort((a, b) => {
      if (a.rec.shantenAfter !== b.rec.shantenAfter) return a.rec.shantenAfter - b.rec.shantenAfter;
      if (a.rec.ukeireTotal !== b.rec.ukeireTotal) return b.rec.ukeireTotal - a.rec.ukeireTotal;
      if (a.pairKinds !== b.pairKinds) return b.pairKinds - a.pairKinds;
      return a.idx - b.idx;
    });

    return cands.slice(0, 3).map((x) => x.rec);
  }

  analyzeHand(
    hand14: Tile[],
    meldCount = 0,
    ctx?: { state: GameState; playerId: PlayerId; style?: { style: GameStyle; reasons: string[] } },
  ): string {
    const recs = this.recommendDiscards(hand14, meldCount, ctx);
    if (recs.length === 0) return '';
    const lines: string[] = [];

    const curStyle = recs[0].style;
    const curReasons = recs[0].styleReasons;
    lines.push(`当前处于【${styleBadgeText(curStyle)}】`);
    if (curReasons.length > 0) {
      lines.push(`原因：${curReasons.join('，')}。`);
    }
    if (curStyle === 'DEFENSIVE' || curStyle === 'STALLING') {
      lines.push('因此不建议追求效率，应优先选择更安全的弃牌。');
    } else if (curStyle === 'AGGRESSIVE') {
      lines.push('因此可以更积极追效率，但仍需注意极端高风险张。');
    }

    lines.push('');
    lines.push('推荐出牌 Top3');
    for (const r of recs) {
      lines.push(
        `打 ${r.discard}：向听 ${r.shantenBefore}->${r.shantenAfter}，有效牌 ${r.ukeireTotal}，风险 ${r.dangerLevel}，进张：${r.ukeireTop.join(',')}`,
      );
      if (r.dangerReasons.length > 0) {
        lines.push(`  风险原因：${r.dangerReasons.join('；')}`);
      }
    }

    const top = recs[0];
    const safest = recs.reduce((acc, cur) => {
      const rank = (lvl: DangerLevel) => (lvl === 'LOW' ? 0 : lvl === 'MEDIUM' ? 1 : 2);
      return rank(cur.dangerLevel) < rank(acc.dangerLevel) ? cur : acc;
    }, top);

    if (top.dangerLevel === 'HIGH' && safest.discard !== top.discard) {
      lines.push('');
      lines.push(`不推荐打 ${top.discard}`);
      lines.push(
        `虽然效率更高（向听 ${top.shantenBefore}->${top.shantenAfter}，有效牌 ${top.ukeireTotal}），但风险为 HIGH。`,
      );
      lines.push(
        `更保守的选择是 ${safest.discard}（风险 ${safest.dangerLevel}），在局面不利/中后巡时更合理。`,
      );
    }

    return lines.join('\n');
  }

  analyzeReactions(
    hand: Tile[],
    meldCount: number,
    legal: Array<{ type: string }>,
    discardTile: Tile,
  ): string {
    const shantenBefore = shantenWithMelds(hand, meldCount);

    const baseUkeire = ukeireTilesWithMelds(hand, meldCount).total;
    const lines: string[] = ['响应建议'];

    if (legal.some((a) => a.type === 'HU')) {
      lines.push(`可以胡：向听 ${shantenBefore}->-1，建议直接胡。`);
      return lines.join('\n');
    }

    const inHand = hand.filter((t) => t.suit === discardTile.suit && t.rank === discardTile.rank).length;

    if (legal.some((a) => a.type === 'GANG') && inHand >= 3) {
      const afterHand = this.removeNTiles(hand, discardTile, 3);
      if (afterHand) {
        const shantenAfter = shantenWithMelds(afterHand, meldCount + 1);
        const ukeireAfter = ukeireTilesWithMelds(afterHand, meldCount + 1).total;
        if (shantenAfter < shantenBefore) {
          lines.push(
            `可以杠 ${tileToString(discardTile)}：向听 ${shantenBefore}->${shantenAfter}，有效牌 ${baseUkeire}->${ukeireAfter}，建议杠。`,
          );
        } else {
          lines.push(
            `虽然可以杠 ${tileToString(discardTile)}，但杠后向听不下降（${shantenAfter}），有效牌 ${baseUkeire}->${ukeireAfter}，一般不建议杠。`,
          );
        }
      }
    }

    if (legal.some((a) => a.type === 'PENG') && inHand >= 2) {
      const afterHand = this.removeNTiles(hand, discardTile, 2);
      if (afterHand) {
        const shantenAfter = shantenWithMelds(afterHand, meldCount + 1);
        const ukeireAfter = ukeireTilesWithMelds(afterHand, meldCount + 1).total;
        if (shantenAfter < shantenBefore) {
          lines.push(
            `可以碰 ${tileToString(discardTile)}：向听 ${shantenBefore}->${shantenAfter}，有效牌 ${baseUkeire}->${ukeireAfter}，建议碰。`,
          );
        } else if (shantenAfter === shantenBefore) {
          lines.push(
            `虽然可以碰 ${tileToString(discardTile)}，但碰后向听不变（${shantenAfter}），有效牌 ${baseUkeire}->${ukeireAfter}，一般不建议碰。`,
          );
        } else {
          lines.push(
            `虽然可以碰 ${tileToString(discardTile)}，但碰后向听变差（${shantenBefore}->${shantenAfter}），不建议碰。`,
          );
        }
      }
    }

    if (lines.length === 1) {
      lines.push('无碰/杠/胡可选。');
    }

    return lines.join('\n');
  }

  private removeNTiles(hand: Tile[], tile: Tile, n: number): Tile[] | null {
    let remaining = n;
    const out: Tile[] = [];
    for (const t of hand) {
      if (remaining > 0 && t.suit === tile.suit && t.rank === tile.rank) {
        remaining--;
      } else {
        out.push(t);
      }
    }
    return remaining === 0 ? out : null;
  }
}
