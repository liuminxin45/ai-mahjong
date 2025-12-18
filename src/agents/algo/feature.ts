import type { Tile } from '../../core/model/tile';
import { tileToString } from '../../core/model/tile';
import { shantenNormal, ukeireTiles } from './shanten';

export function countRanks(hand: Tile[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of hand) {
    m.set(t.rank, (m.get(t.rank) ?? 0) + 1);
  }
  return m;
}

export function countTiles(hand: Tile[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of hand) {
    const key = `${t.suit}${t.rank}`;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

export type ShantenFeature = {
  shanten: number;
  ukeireTotal?: number;
  ukeireTop?: string[];
};

export function computeShantenFeature(hand: Tile[]): ShantenFeature {
  const shanten = shantenNormal(hand);
  if (hand.length !== 13) return { shanten };

  const u = ukeireTiles(hand);
  const ukeireTop = u.byTile
    .slice(0, 6)
    .map((x) => `${tileToString(x.tile)} x${x.count}`);

  return {
    shanten,
    ukeireTotal: u.total,
    ukeireTop,
  };
}
