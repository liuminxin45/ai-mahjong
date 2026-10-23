import { countsOf, TILES, type TileId } from '../engine/index.js';
import type { DecisionQuestion } from '../decision/questions.js';

export const EXPERIENCE_VERSION = 'five-hands-1';
export const challengeKinds = ['temptation', 'gap', 'entanglement', 'cost', 'adaptability'] as const;
export type ChallengeKind = typeof challengeKinds[number];
export type ChallengeProof = { kind: ChallengeKind; alternative: TileId; tiles: TileId[]; basis: string; before?: DecisionQuestion };
export type Challenge = { id: string; questionId: string; kind: ChallengeKind; proof: ChallengeProof };
export type GroupTemplate = { id: string; level: number; challenges: string[]; quoteId: string; ending: string };
export type ExperienceCatalog = { version: typeof EXPERIENCE_VERSION; challenges: Challenge[]; groups: GroupTemplate[] };
export const quotes = [
  '这一手，你愿意放下什么？', '还有别的可能吗？', '不急，先把这一手看清。',
  '答案之前，先有一次选择。', '眼前这一手，还能怎样看？', '先留一点时间，给这一手牌。',
  '你会怎样走过这五手？', '从这一手，重新开始。',
] as const;
export const reflections: Record<ChallengeKind, string> = {
  temptation: '你愿意为更大的结果，付出多少等待？',
  gap: '你等的，是还有的机会，还是记得的机会？',
  entanglement: '两条路都想留下时，你舍得放下哪一条？',
  cost: '留下它的代价，你也一起看见了吗？',
  adaptability: '条件变了，你愿意重新作一次选择吗？',
};

/** Teaching claims require arithmetic or a physical witness, never just a skill label. */
export function ordinaryProof(q: DecisionQuestion, kind: ChallengeKind): ChallengeProof | null {
  const best = q.certificate.options.find(o => o.tile === q.certificate.recommended)!;
  const worse = q.certificate.options.filter(o => BigInt(o.value.score) < BigInt(best.value.score));
  const counts = countsOf(q.context.hand), rank = (t: TileId) => Number(t[0]);
  if (kind === 'temptation') {
    const rich = worse.find(o => BigInt(o.value.wins) > 0n && BigInt(best.value.wins) > 0n && BigInt(o.value.wins) < BigInt(best.value.wins) && BigInt(o.value.score) * BigInt(best.value.wins) > BigInt(best.value.score) * BigInt(o.value.wins));
    if (rich) return { kind, alternative: rich.tile, tiles: [], basis: 'conditional-value' };
    const edge = worse.find(o => [1, 9].includes(rank(o.tile)));
    if (rank(best.tile) > 1 && rank(best.tile) < 9 && edge) return { kind, alternative: edge.tile, tiles: [best.tile, edge.tile], basis: 'keep-middle' };
  }
  if (kind === 'cost') {
    const paired = worse.find(o => counts[TILES.indexOf(o.tile)] >= 2 && q.shape.discards.find(d => d.tile === o.tile)!.shanten > q.shape.discards.find(d => d.tile === best.tile)!.shanten);
    if (paired) return { kind, alternative: paired.tile, tiles: [paired.tile], basis: 'pair-distance' };
    const different = worse.find(o => BigInt(o.value.ready) !== BigInt(best.value.ready) || BigInt(o.value.wins) !== BigInt(best.value.wins));
    if (different) return { kind, alternative: different.tile, tiles: [different.tile, best.tile], basis: 'opportunity-cost' };
  }
  if (kind === 'entanglement') {
    for (const suit of ['p', 's']) for (let n = 1; n <= 7; n++) {
      const a = [n, n + 1, n + 2].map(r => (r + suit) as TileId);
      if (!a.every(t => counts[TILES.indexOf(t)])) continue;
      for (let m = n + 1; m <= Math.min(7, n + 2); m++) {
        const b = [m, m + 1, m + 2].map(r => (r + suit) as TileId), shared = a.filter(t => b.includes(t));
        if (b.every(t => counts[TILES.indexOf(t)]) && shared.some(t => counts[TILES.indexOf(t)] === 1)) {
          const alt = worse.find(o => [...a, ...b].includes(o.tile));
          if (alt) return { kind, alternative: alt.tile, tiles: [...a, ...b], basis: 'shared-physical-tile' };
        }
      }
    }
  }
  return null;
}
