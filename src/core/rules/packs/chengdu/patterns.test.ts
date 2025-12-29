import { describe, expect, it } from 'vitest';
import { findWinPatterns } from './patterns';
import type { Tile } from '../../../model/tile';

describe('findWinPatterns - variable hand sizes', () => {
  it('should detect valid win with 5 tiles (W4 W4 W7 W7 W7)', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 4 },
      { suit: 'W', rank: 4 },
      { suit: 'W', rank: 7 },
      { suit: 'W', rank: 7 },
      { suit: 'W', rank: 7 },
    ];
    const patterns = findWinPatterns(hand);
    const validPattern = patterns.find(p => p.isValid);
    
    expect(validPattern).toBeTruthy();
    expect(validPattern?.isValid).toBe(true);
    expect(validPattern?.groups.length).toBe(2); // 1 pair + 1 triplet
  });

  it('should detect valid win with 2 tiles (pair only)', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 5 },
      { suit: 'W', rank: 5 },
    ];
    const patterns = findWinPatterns(hand);
    const validPattern = patterns.find(p => p.isValid);
    
    expect(validPattern).toBeTruthy();
    expect(validPattern?.groups.length).toBe(1); // just the pair
  });

  it('should detect valid win with 8 tiles (2 sets + pair)', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 2 },
      { suit: 'W', rank: 3 },
      { suit: 'B', rank: 5 },
      { suit: 'B', rank: 5 },
      { suit: 'B', rank: 5 },
      { suit: 'T', rank: 7 },
      { suit: 'T', rank: 7 },
    ];
    const patterns = findWinPatterns(hand);
    const validPattern = patterns.find(p => p.isValid);
    
    expect(validPattern).toBeTruthy();
    expect(validPattern?.groups.length).toBe(3); // 2 sets + 1 pair
  });

  it('should reject invalid hand sizes (3, 4, 6, 7, etc.)', () => {
    const hand3: Tile[] = [
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 },
    ];
    expect(findWinPatterns(hand3)[0].isValid).toBe(false);

    const hand4: Tile[] = [
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 },
    ];
    expect(findWinPatterns(hand4)[0].isValid).toBe(false);
  });

  it('should still detect 七对子 with exactly 14 tiles', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
      { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
      { suit: 'W', rank: 3 }, { suit: 'W', rank: 3 },
      { suit: 'B', rank: 4 }, { suit: 'B', rank: 4 },
      { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
      { suit: 'T', rank: 6 }, { suit: 'T', rank: 6 },
      { suit: 'T', rank: 7 }, { suit: 'T', rank: 7 },
    ];
    const patterns = findWinPatterns(hand);
    const qiDuiPattern = patterns.find(p => 
      p.isValid && p.groups.length === 7 && p.groups.every(g => g.type === 'JIANG')
    );
    
    expect(qiDuiPattern).toBeTruthy();
  });

  it('should still detect 龙七对 with exactly 14 tiles', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
      { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, // 4 of a kind
      { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
      { suit: 'W', rank: 3 }, { suit: 'W', rank: 3 },
      { suit: 'B', rank: 4 }, { suit: 'B', rank: 4 },
      { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
      { suit: 'T', rank: 6 }, { suit: 'T', rank: 6 },
    ];
    const patterns = findWinPatterns(hand);
    const longQiDuiPattern = patterns.find(p => 
      p.isValid && p.groups.length === 7 && p.groups.every(g => g.type === 'JIANG')
    );
    
    expect(longQiDuiPattern).toBeTruthy();
  });

  it('should NOT detect 七对子 with fewer than 14 tiles', () => {
    const hand: Tile[] = [
      { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
      { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
      { suit: 'W', rank: 3 }, { suit: 'W', rank: 3 },
    ];
    const patterns = findWinPatterns(hand);
    // 6 tiles = 3 pairs, but standard mahjong requires 1 pair + n triplets/sequences
    // This is NOT a valid winning hand in standard rules
    const validPattern = patterns.find(p => p.isValid);
    expect(validPattern).toBeFalsy();
  });
});
