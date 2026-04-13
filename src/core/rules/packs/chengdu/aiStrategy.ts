import type { Tile } from '../../../model/tile';
import { shantenWithMelds, ukeireTilesWithMelds } from '../../../../agents/algo/shanten';

type Suit = 'W' | 'B' | 'T';
const SUITS: readonly Suit[] = ['W', 'B', 'T'] as const;

// ─── Ding-Que ────────────────────────────────────────────────

/**
 * Shanten-aware ding-que selection.
 *
 * For each candidate suit, simulate removing ALL tiles of that suit.
 * The remaining hand (two-suit) is what we'll actually play with.
 * Pick the suit whose removal leaves the lowest shanten (strongest hand).
 * Tie-break: fewer tiles to discard in that suit (faster to clear).
 */
export function selectDingQueSuit(hand: Tile[]): Suit {
  let bestSuit: Suit = 'W';
  let bestShanten = Infinity;
  let bestCount = Infinity; // tiles of the removed suit (fewer = faster clear)
  let bestUkeire = -1;

  for (const suit of SUITS) {
    const remaining = hand.filter(t => t.suit !== suit);
    const removed = hand.length - remaining.length;

    // Shanten of the two-suit hand (meldCount=0 since pre-play)
    const s = shantenWithMelds(remaining, 0);

    if (s < bestShanten
      || (s === bestShanten && removed < bestCount)
      || (s === bestShanten && removed === bestCount)) {
      // On equal shanten+count, use ukeire as final tie-break
      if (s < bestShanten || removed < bestCount) {
        bestSuit = suit;
        bestShanten = s;
        bestCount = removed;
        bestUkeire = -1; // will compute lazily only if needed
      } else {
        // Same shanten, same count → compare ukeire (compute lazily)
        if (bestUkeire < 0) {
          const prevRemaining = hand.filter(t => t.suit !== bestSuit);
          bestUkeire = ukeireTilesWithMelds(prevRemaining, 0).total;
        }
        const ukeire = ukeireTilesWithMelds(remaining, 0).total;
        if (ukeire > bestUkeire) {
          bestSuit = suit;
          bestShanten = s;
          bestCount = removed;
          bestUkeire = ukeire;
        }
      }
    }
  }

  return bestSuit;
}

// ─── Exchange ────────────────────────────────────────────────

/**
 * Shanten-aware exchange tile selection.
 *
 * Strategy:
 * 1. Determine the best ding-que suit (the one we plan to eliminate).
 * 2. For each suit with ≥ 3 tiles, enumerate 3-tile combinations to exchange.
 *    Prefer the planned ding-que suit so that exchange & ding-que are aligned.
 * 3. Score each combo by shanten of the remaining 10 tiles → ukeire tie-break.
 * 4. Pick the combo that leaves the strongest remaining hand.
 *
 * To keep combinatorics bounded, when a suit has many tiles we limit
 * enumeration to the least-valuable tiles (max ~84 combos per suit).
 */
export function selectExchangeTiles(hand: Tile[]): Tile[] {
  const plannedDingQue = selectDingQueSuit(hand);

  let globalBest: { tiles: Tile[]; shanten: number; ukeire: number } | null = null;

  for (const suit of SUITS) {
    const suitTiles = hand.filter(t => t.suit === suit);
    if (suitTiles.length < 3) continue;

    const combos = enumerateCombos(suitTiles, 3);
    for (const combo of combos) {
      const remaining = removeTiles(hand, combo);
      const s = shantenWithMelds(remaining, 0);

      if (
        !globalBest
        || s < globalBest.shanten
        || (s === globalBest.shanten && suit === plannedDingQue && !isSuitMatch(globalBest.tiles, plannedDingQue))
      ) {
        const u = ukeireTilesWithMelds(remaining, 0).total;
        globalBest = { tiles: combo, shanten: s, ukeire: u };
      } else if (s === globalBest.shanten) {
        const u = ukeireTilesWithMelds(remaining, 0).total;
        if (u > globalBest.ukeire) {
          globalBest = { tiles: combo, shanten: s, ukeire: u };
        }
      }
    }
  }

  return globalBest?.tiles ?? hand.slice(0, 3);
}

// ─── Helpers ─────────────────────────────────────────────────

/** Check if all tiles in arr belong to the given suit */
function isSuitMatch(tiles: Tile[], suit: Suit): boolean {
  return tiles.every(t => t.suit === suit);
}

/** Remove exact tile instances from hand (by reference-safe value match) */
function removeTiles(hand: Tile[], toRemove: Tile[]): Tile[] {
  const remaining = [...hand];
  for (const t of toRemove) {
    const idx = remaining.findIndex(r => r.suit === t.suit && r.rank === t.rank);
    if (idx >= 0) remaining.splice(idx, 1);
  }
  return remaining;
}

/**
 * Enumerate all C(n, k) combinations from `tiles`.
 * When n > 9, pre-sort by simple tile value and only consider the
 * bottom 9 tiles to cap combos at C(9,3) = 84.
 */
function enumerateCombos(tiles: Tile[], k: number): Tile[][] {
  let pool = tiles;
  if (pool.length > 9) {
    // Pre-sort: isolated edge tiles first (low value), connected middle tiles last
    pool = [...pool].sort((a, b) => quickTileValue(a, tiles) - quickTileValue(b, tiles));
    pool = pool.slice(0, 9);
  }

  const results: Tile[][] = [];
  const combo: Tile[] = [];

  function dfs(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < pool.length; i++) {
      combo.push(pool[i]);
      dfs(i + 1);
      combo.pop();
    }
  }
  dfs(0);
  return results;
}

/**
 * Quick value heuristic for pre-sorting exchange candidates.
 * Lower = more expendable. Used only to limit combo enumeration.
 */
function quickTileValue(tile: Tile, hand: Tile[]): number {
  const sameCount = hand.filter(t => t.suit === tile.suit && t.rank === tile.rank).length;
  if (sameCount >= 3) return 90;
  if (sameCount >= 2) return 70;

  const { suit, rank } = tile;
  const hasAdj = (d: number) => hand.some(t => t.suit === suit && t.rank === rank + d);
  if (hasAdj(-1) && hasAdj(1)) return 80; // part of sequence
  if (hasAdj(-1) || hasAdj(1)) return 50; // partial sequence
  if (hasAdj(-2) || hasAdj(2)) return 35; // gap wait

  // Isolated: edge tiles are least useful
  if (rank === 1 || rank === 9) return 10;
  if (rank === 2 || rank === 8) return 15;
  return 25; // middle isolated
}
