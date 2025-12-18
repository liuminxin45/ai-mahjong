import { describe, expect, it } from 'vitest';
import type { Tile } from '../src/core/model/tile';
import { makeStandardTileSet } from '../src/core/model/tile';
import { shantenNormal, ukeireTiles } from '../src/agents/algo/shanten';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function takeRandomHand(n: number): Tile[] {
  const deck = shuffle(makeStandardTileSet());
  return deck.slice(0, n);
}

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
  return { suit, rank };
}

describe('shanten/ukeire (stage2)', () => {
  it('shantenNormal(random 14) should be in [-1..8] and not throw', () => {
    for (let i = 0; i < 50; i++) {
      const hand14 = takeRandomHand(14);
      const s = shantenNormal(hand14);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(8);
    }
  });

  it('ukeireTiles(random 13) should have non-negative total and per-tile count in [1..4]', () => {
    for (let i = 0; i < 50; i++) {
      const hand13 = takeRandomHand(13);
      const u = ukeireTiles(hand13);
      expect(u.total).toBeGreaterThanOrEqual(0);
      for (const x of u.byTile) {
        expect(x.count).toBeGreaterThanOrEqual(1);
        expect(x.count).toBeLessThanOrEqual(4);
      }
    }
  });

  it('a complete normal hand should have shanten = -1', () => {
    const win14: Tile[] = [
      t('W', 1),
      t('W', 2),
      t('W', 3),
      t('B', 1),
      t('B', 2),
      t('B', 3),
      t('T', 1),
      t('T', 2),
      t('T', 3),
      t('W', 4),
      t('W', 5),
      t('W', 6),
      t('B', 7),
      t('B', 7),
    ];

    expect(shantenNormal(win14)).toBe(-1);
  });
});
