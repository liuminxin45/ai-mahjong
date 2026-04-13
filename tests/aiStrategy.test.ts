import { describe, it, expect } from 'vitest';
import { selectDingQueSuit, selectExchangeTiles } from '../src/core/rules/packs/chengdu/aiStrategy';
import type { Tile } from '../src/core/model/tile';

/** Helper to create a tile */
function t(suit: 'W' | 'B' | 'T', rank: number): Tile {
    return { suit, rank } as Tile;
}

describe('selectDingQueSuit', () => {
    it('picks the suit with fewest tiles when others are strong', () => {
        // 4 Wan (sequence + pair), 5 Bamboo (nearly complete), 4 Tiao = 13
        const hand = [
            t('W', 1), t('W', 2), t('W', 3), t('W', 3),  // W: seq + pair
            t('B', 2), t('B', 3), t('B', 4), t('B', 5), t('B', 6), // B: strong
            t('T', 1), t('T', 5), t('T', 8), t('T', 9),  // T: scattered
        ];
        expect(selectDingQueSuit(hand)).toBe('T');
    });

    it('picks suit whose removal leaves lowest shanten', () => {
        // Removing W leaves B+T with good shape; removing T leaves W+B worse
        const hand = [
            t('W', 1), t('W', 9),                          // W: 2 isolated
            t('B', 2), t('B', 3), t('B', 4), t('B', 7), t('B', 8), t('B', 9), // B: two seqs
            t('T', 1), t('T', 2), t('T', 3), t('T', 5), t('T', 5), // T: seq + pair
        ];
        // W has only 2 tiles and both isolated → should be ding-que
        expect(selectDingQueSuit(hand)).toBe('W');
    });

    it('avoids eliminating suit with triplet', () => {
        const hand = [
            t('W', 5), t('W', 5), t('W', 5), t('W', 6), t('W', 7), // W: triplet + seq part
            t('B', 1), t('B', 3), t('B', 7),                          // B: 3 scattered
            t('T', 2), t('T', 3), t('T', 4), t('T', 8), t('T', 9),  // T: seq + pair-ish
        ];
        // B is weakest (3 isolated tiles); W has a triplet so should not be eliminated
        expect(selectDingQueSuit(hand)).toBe('B');
    });

    it('handles hand with one suit empty', () => {
        const hand = [
            t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6), t('W', 7),
            t('B', 1), t('B', 2), t('B', 3), t('B', 4), t('B', 5), t('B', 6),
            // No T tiles
        ];
        expect(selectDingQueSuit(hand)).toBe('T');
    });
});

describe('selectExchangeTiles', () => {
    it('exchanges 3 tiles of the same suit', () => {
        const hand = [
            t('W', 1), t('W', 2), t('W', 3), t('W', 5),
            t('B', 2), t('B', 3), t('B', 4), t('B', 5), t('B', 6),
            t('T', 1), t('T', 5), t('T', 8), t('T', 9),
        ];
        const result = selectExchangeTiles(hand);
        expect(result).toHaveLength(3);
        // All three should be same suit
        const suits = new Set(result.map(t => t.suit));
        expect(suits.size).toBe(1);
    });

    it('prefers exchanging from planned ding-que suit', () => {
        const hand = [
            t('W', 1), t('W', 5), t('W', 9),              // W: 3 isolated
            t('B', 2), t('B', 3), t('B', 4), t('B', 7), t('B', 8), t('B', 9), // B: strong
            t('T', 1), t('T', 2), t('T', 3), t('T', 7),   // T: seq + isolated
        ];
        const result = selectExchangeTiles(hand);
        expect(result).toHaveLength(3);
        // Should exchange W (weakest suit, planned ding-que)
        expect(result.every(t => t.suit === 'W')).toBe(true);
    });

    it('picks the combo that leaves lowest shanten', () => {
        // T has 4 tiles: T1 T2 T3 T9 — exchanging T9+any is suboptimal
        // exchanging 3 weak T tiles should leave T sequence intact... 
        // but since we must exchange 3 from same suit, and T has seq + isolated,
        // the best combo from T (if chosen) would dump the 3 worst
        const hand = [
            t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), // W: strong seq
            t('B', 3), t('B', 3), t('B', 3), t('B', 7),              // B: triplet + 1
            t('T', 1), t('T', 5), t('T', 8), t('T', 9),              // T: all scattered
        ];
        const result = selectExchangeTiles(hand);
        expect(result).toHaveLength(3);
        // T should be exchanged (worst tiles), or B excluding the triplet
        // Either is acceptable as long as shanten improves
        const resultSuit = result[0].suit;
        expect(['T', 'B']).toContain(resultSuit);
    });

    it('returns 3 tiles even with minimum viable hand', () => {
        // Every suit has exactly 3+ tiles
        const hand = [
            t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5),
            t('B', 1), t('B', 2), t('B', 3),
            t('T', 7), t('T', 8), t('T', 9), t('T', 1), t('T', 2),
        ];
        const result = selectExchangeTiles(hand);
        expect(result).toHaveLength(3);
    });
});
