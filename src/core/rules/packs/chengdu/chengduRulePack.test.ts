import { describe, expect, it } from 'vitest';
import { chengduRulePack } from './index';
import { findWinPatterns, detectYaku, calculateScore } from './patterns';
import { validateExchangeTiles, performExchange } from './exchange';
import { sortTiles, groupAndSortTiles, getSortedHand } from './sort';
import type { Tile } from '../../../model/tile';
import type { GameState } from '../../../model/state';
import type { PlayerId } from '../../../model/types';

describe('chengduRulePack', () => {
  describe('basic flow', () => {
    it('reuses placeholder behavior (init/draw/discard/rotate)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const s0Playing = { ...s0, phase: 'PLAYING', currentPlayer: 'P0' } as any;
      expect(s0Playing.phase).toBe('PLAYING');
      expect(s0Playing.currentPlayer).toBe('P0');

      const s1 = chengduRulePack.applyAction(s0Playing, { type: 'DRAW' });
      expect(s1.hands.P0.length).toBe(14);

      const discard = chengduRulePack.getLegalActions(s1, 'P0').find((a) => a.type === 'DISCARD');
      expect(discard).toBeTruthy();
      const s2 = chengduRulePack.applyAction(s1, discard!);
      expect(s2.turn).toBe(1);

      const resolved = chengduRulePack.resolveReactions(s2, []);
      expect(resolved.state.currentPlayer).toBe('P1');
    });

  describe('tian hu / di hu', () => {
    it('should include tian hu (4 fan) when flagged', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];
      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], true, 0, false, false, false, true, false);
      const tianHu = yakuList.find(y => y.type === 'TIAN_HU');
      expect(tianHu).toBeTruthy();
      expect(tianHu?.fan).toBe(4);
    });

    it('should include di hu (4 fan) when flagged', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];
      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, true);
      const diHu = yakuList.find(y => y.type === 'DI_HU');
      expect(diHu).toBeTruthy();
      expect(diHu?.fan).toBe(4);
    });
  });
  });

  describe('gang mechanics', () => {
    it('should draw a tile after an gang (AN)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        phase: 'PLAYING',
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile, tile, { suit: 'W', rank: 2 }],
        },
        wall: [{ suit: 'B', rank: 5 }, ...s0.wall.slice(1)],
      };

      const initialWallLength = s1.wall.length;
      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      
      expect(s2.wall.length).toBe(initialWallLength - 1);
      expect(s2.hands.P0.length).toBe(2);
      expect(s2.melds.P0.length).toBe(1);
      expect(s2.melds.P0[0].type).toBe('GANG');

      // 雨钱：暗杠收所有人 10 分
      const cs2 = s2 as any;
      expect(cs2.roundScores.P0).toBe(30);
      expect(cs2.roundScores.P1).toBe(-10);
      expect(cs2.roundScores.P2).toBe(-10);
      expect(cs2.roundScores.P3).toBe(-10);
    });

    it('should draw a tile after jia gang (JIA)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        phase: 'PLAYING',
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, { suit: 'W', rank: 2 }],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile, from: 'P1' }],
        },
        wall: [{ suit: 'B', rank: 5 }, ...s0.wall.slice(1)],
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'JIA' });
      
      expect(s2.hands.P0.length).toBe(1);
      expect(s2.melds.P0.length).toBe(1);
      expect(s2.melds.P0[0].type).toBe('GANG');

      // 雨钱：贴杠收最初提供碰的玩家 5 分
      const cs2 = s2 as any;
      expect(cs2.roundScores.P0).toBe(5);
      expect(cs2.roundScores.P1).toBe(-5);
    });

    it('should draw a tile after ming gang (MING)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        phase: 'PLAYING',
        currentPlayer: 'P0',
        lastDiscard: { tile, from: 'P1' },
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile, { suit: 'W', rank: 2 }],
        },
        wall: [{ suit: 'B', rank: 5 }, ...s0.wall.slice(1)],
      };

      const reactions = [{ playerId: 'P0' as const, action: { type: 'GANG' as const, tile, from: 'P1' as const, gangType: 'MING' as const } }];
      const result = chengduRulePack.resolveReactions(s1, reactions);
      
      expect(result.state.hands.P0.length).toBe(2);
      expect(result.state.melds.P0.length).toBe(1);
      expect(result.state.currentPlayer).toBe('P0');

      // 雨钱：明杠收点杠人 10 分
      const cs = result.state as any;
      expect(cs.roundScores.P0).toBe(10);
      expect(cs.roundScores.P1).toBe(-10);
    });

    it('should not allow gang on missing suit tiles', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };

      const s1: GameState = {
        ...s0,
        phase: 'PLAYING',
        currentPlayer: 'P0',
        dingQueSelection: { P0: 'W', P1: undefined, P2: undefined, P3: undefined },
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile, tile, { suit: 'B', rank: 2 }],
        },
      } as any;

      const legal = chengduRulePack.getLegalActions(s1, 'P0');
      const hasGang = legal.some(a => a.type === 'GANG');
      expect(hasGang).toBe(false);

      // 即使强行执行也应无效
      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      expect(s2).toBe(s1);
    });
  });

  describe('qiang gang hu', () => {
    it('should set lastAddedGangTile when player adds gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const gangTile: Tile = { suit: 'W', rank: 5 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [gangTile, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
               { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
               { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile: gangTile, from: 'P2' }],
        },
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile: gangTile, from: 'P0', gangType: 'JIA' });
      const chengduState = s2 as any;
      
      expect(chengduState.lastAddedGangTile).toBeTruthy();
      expect(chengduState.lastAddedGangTile.tile).toEqual(gangTile);
      expect(chengduState.lastAddedGangTile.from).toBe('P0');
    });
  });

  describe('gang shang kai hua', () => {
    it('should draw tile and set isAfterGang flag after an gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const gangTile: Tile = { suit: 'W', rank: 1 };
      const drawnTile: Tile = { suit: 'B', rank: 5 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [
            gangTile, gangTile, gangTile, gangTile,
            { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
            { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
            { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }, { suit: 'T', rank: 4 }
          ],
        },
        wall: [drawnTile, ...s0.wall.slice(1)],
      };

      const initialHandSize = s1.hands.P0.length;
      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile: gangTile, from: 'P0', gangType: 'AN' });
      const chengduState = s2 as any;
      
      expect(s2.hands.P0.length).toBe(initialHandSize - 4 + 1);
      expect(chengduState.isAfterGang).toBe(true);
      expect(chengduState.lastGangPlayer).toBe('P0');
    });
  });

  describe('integration: qiang gang hu flow', () => {
    it('should allow qiang gang hu in full flow', () => {
      const s0 = chengduRulePack.buildInitialState();
      const gangTile: Tile = { suit: 'W', rank: 5 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [gangTile, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
               { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
               { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
          P1: [
            { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
            { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
            { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 },
            { suit: 'T', rank: 7 }, { suit: 'T', rank: 7 }, { suit: 'T', rank: 7 },
            { suit: 'W', rank: 9 },
          ],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile: gangTile, from: 'P2' }],
        },
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile: gangTile, from: 'P0', gangType: 'JIA' });
      const chengduState = s2 as any;
      expect(chengduState.lastAddedGangTile).toBeTruthy();
      
      const legalP1 = chengduRulePack.getLegalActions(s2, 'P1');
      const huAction = legalP1.find(a => a.type === 'HU');
      
      if (huAction) {
        const reactions = [{ playerId: 'P1' as const, action: huAction }];
        const result = chengduRulePack.resolveReactions(s2, reactions);
        expect(result.state.declaredHu.P1).toBe(true);
      }
    });
  });

  describe('win pattern detection', () => {
    it('should detect valid 4 melds + 1 pair pattern', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 5 }, { suit: 'T', rank: 5 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];

      const patterns = findWinPatterns(hand);
      expect(patterns.some(p => p.isValid)).toBe(true);
    });

    it('should detect qi dui zi (7 pairs)', () => {
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
      const qiDuiPattern = patterns.find(p => p.isValid && p.groups.length === 7);
      expect(qiDuiPattern).toBeTruthy();
    });

    it('should reject invalid hands', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 5 },
        { suit: 'W', rank: 7 }, { suit: 'W', rank: 9 },
        { suit: 'B', rank: 1 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 5 },
        { suit: 'T', rank: 2 }, { suit: 'T', rank: 4 }, { suit: 'T', rank: 6 },
        { suit: 'W', rank: 2 }, { suit: 'B', rank: 7 }, { suit: 'T', rank: 8 },
      ];

      const patterns = findWinPatterns(hand);
      expect(patterns.every(p => !p.isValid)).toBe(true);
    });
  });

  describe('yaku detection', () => {
    it('should detect ping hu', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, false);
      
      expect(yakuList.some(y => y.type === 'PING_HU')).toBe(true);
    });

    it('should detect dui dui hu (all triplets)', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
        { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
        { suit: 'B', rank: 3 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 3 },
        { suit: 'T', rank: 4 }, { suit: 'T', rank: 4 }, { suit: 'T', rank: 4 },
        { suit: 'W', rank: 5 }, { suit: 'W', rank: 5 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, false);
      
      expect(yakuList.some(y => y.type === 'DUI_DUI_HU')).toBe(true);
    });

    it('should detect qing yi se (pure suit)', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 },
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
        { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, false);
      
      expect(yakuList.some(y => y.type === 'QING_YI_SE')).toBe(true);
    });

    it('should detect zi mo', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], true, 0, false, false, false, false, false);
      
      expect(yakuList.some(y => y.type === 'ZI_MO')).toBe(true);
    });

    it('should detect gang shang kai hua', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], true, 0, true, false, false, false, false);
      
      expect(yakuList.some(y => y.type === 'GANG_SHANG_KAI_HUA')).toBe(true);
    });

    it('should detect qiang gang hu', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
        { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }, { suit: 'B', rank: 4 },
        { suit: 'T', rank: 5 }, { suit: 'T', rank: 6 }, { suit: 'T', rank: 7 },
        { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, true, false, false, false);
      
      expect(yakuList.some(y => y.type === 'QIANG_GANG_HU')).toBe(true);
    });

    it('should detect qi dui zi (7 pairs) with 2 fan', () => {
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
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, false);

      const qiDui = yakuList.find(y => y.type === 'QI_DUI_ZI');
      expect(qiDui).toBeTruthy();
      expect(qiDui?.fan).toBe(2);
      expect(yakuList.some(y => y.type === 'LONG_QI_DUI')).toBe(false);
    });

    it('should detect long qi dui (dragon seven pairs) with 3 fan when a quad exists', () => {
      const hand: Tile[] = [
        { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
        { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
        { suit: 'W', rank: 3 }, { suit: 'W', rank: 3 },
        { suit: 'B', rank: 4 }, { suit: 'B', rank: 4 },
        { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
        { suit: 'T', rank: 6 }, { suit: 'T', rank: 6 },
      ];

      const patterns = findWinPatterns(hand);
      const validPattern = patterns.find(p => p.isValid)!;
      const yakuList = detectYaku(validPattern, hand, hand[0], false, 0, false, false, false, false, false);

      const longQiDui = yakuList.find(y => y.type === 'LONG_QI_DUI');
      expect(longQiDui).toBeTruthy();
      expect(longQiDui?.fan).toBe(3);
      expect(yakuList.some(y => y.type === 'QI_DUI_ZI')).toBe(false);
    });
  });

  describe('scoring', () => {
    it('should calculate correct score for ping hu', () => {
      const yakuList = [{ type: 'PING_HU' as const, fan: 1, description: '平胡' }];
      const score = calculateScore(yakuList);
      expect(score).toBe(5);
    });

    it('should calculate correct score for qing yi se', () => {
      const yakuList = [{ type: 'QING_YI_SE' as const, fan: 6, description: '清一色' }];
      const score = calculateScore(yakuList);
      // 6 番：5 * 2^(6-1) = 160
      expect(score).toBe(160);
    });

    it('should accumulate multiple yaku', () => {
      const yakuList = [
        { type: 'ZI_MO' as const, fan: 1, description: '自摸' },
        { type: 'DUI_DUI_HU' as const, fan: 2, description: '对对胡' },
      ];
      const score = calculateScore(yakuList);
      // 1+2 = 3 番：5 * 2^(3-1) = 20
      expect(score).toBe(20);
    });
  });

  describe('improvements: event recording, state consistency, validation, defensive checks', () => {
    it('should record gang event for AN gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [
            tile, tile, tile, tile,
            { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
            { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
            { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }, { suit: 'T', rank: 4 }
          ],
        },
        wall: [{ suit: 'B', rank: 5 }, ...s0.wall.slice(1)],
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      const chengduState = s2 as any;
      
      expect(chengduState.pendingEvents).toBeDefined();
      expect(chengduState.pendingEvents.length).toBe(1);
      expect(chengduState.pendingEvents[0].type).toBe('GANG');
      expect(chengduState.pendingEvents[0].gangType).toBe('AN');
    });

    it('should record gang event for JIA gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [
            tile,
            { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
            { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
            { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }
          ],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile, from: 'P1' }],
        },
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'JIA' });
      const chengduState = s2 as any;
      
      expect(chengduState.pendingEvents).toBeDefined();
      expect(chengduState.pendingEvents.length).toBe(1);
      expect(chengduState.pendingEvents[0].type).toBe('GANG');
      expect(chengduState.pendingEvents[0].gangType).toBe('JIA');
    });

    it('should prevent AN gang when wall is empty (state consistency)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile, tile, { suit: 'W', rank: 2 }],
        },
        wall: [], // 空牌墙
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      
      // 状态应该不变
      expect(s2).toBe(s1);
      expect(s2.melds.P0.length).toBe(0);
    });

    it('should validate hand size for AN gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile], // 只有3张，手牌数量不对
        },
        wall: [{ suit: 'B', rank: 5 }],
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      
      // 状态应该不变
      expect(s2).toBe(s1);
    });

    it('should validate hand size for JIA gang', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
               { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
               { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile, from: 'P1' }],
        },
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'JIA' });
      const chengduState = s2 as any;
      
      // 验证成功执行
      expect(chengduState.pendingEvents).toBeDefined();
      expect(chengduState.melds.P0[0].type).toBe('GANG');
    });

    it('should prevent JIA gang without matching PENG (defensive check)', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      const otherTile: Tile = { suit: 'W', rank: 2 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, otherTile, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
               { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
               { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile: otherTile, from: 'P1' }], // 碰的是不同的牌
        },
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'JIA' });
      
      // 状态应该不变（没有匹配的PENG）
      expect(s2).toBe(s1);
    });

    it('should prevent discarding just ponged tile', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, { suit: 'W', rank: 2 }],
        },
        lastPengTile: tile,
      } as any;

      const s2 = chengduRulePack.applyAction(s1, { type: 'DISCARD', tile });
      
      // 状态应该不变（不允许打出刚碰的牌）
      expect(s2).toBe(s1);
    });

    it('should allow discarding different tile after peng', () => {
      const s0 = chengduRulePack.buildInitialState();
      const pengTile: Tile = { suit: 'W', rank: 1 };
      const discardTile: Tile = { suit: 'W', rank: 2 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [pengTile, discardTile, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 },
               { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
               { suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
        },
        melds: {
          ...s0.melds,
          P0: [{ type: 'PENG', tile: { suit: 'W', rank: 9 }, from: 'P1' }],
        },
        lastPengTile: pengTile,
      } as any;

      const s2 = chengduRulePack.applyAction(s1, { type: 'DISCARD', tile: discardTile });
      
      // 应该允许打出不同的牌（手牌不变因为 placeholder 不处理 DISCARD）
      expect(s2).not.toBe(s1);
      expect(s2.hands.P0.length).toBe(10);
    });

    it('should handle defensive check for invalid tile removal', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, tile, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, { suit: 'W', rank: 4 }], // 只有2张W1
        },
        wall: [{ suit: 'B', rank: 5 }],
      };

      const s2 = chengduRulePack.applyAction(s1, { type: 'GANG', tile, from: 'P0', gangType: 'AN' });
      
      // 状态应该不变（无法移除4张）
      expect(s2).toBe(s1);
    });

    it('should prevent MING gang when wall is empty', () => {
      const s0 = chengduRulePack.buildInitialState();
      const tile: Tile = { suit: 'W', rank: 1 };
      
      const s1: GameState = {
        ...s0,
        currentPlayer: 'P0',
        hands: {
          ...s0.hands,
          P0: [tile, tile, tile],
        },
        wall: [], // 空牌墙
        lastDiscard: { tile, from: 'P1' },
      };

      const reactions = [{ playerId: 'P0' as const, action: { type: 'GANG' as const, tile, from: 'P1' as const, gangType: 'MING' as const } }];
      const result = chengduRulePack.resolveReactions(s1, reactions);
      
      // 应该跳过杠，轮到下一个玩家
      expect(result.state.currentPlayer).not.toBe('P0');
      expect(result.state.melds.P0.length).toBe(0);
    });
  });

  describe('new features: que yi men, gen, jin gou diao, exchange', () => {
    describe('que yi men (missing suit)', () => {
      it('should allow win with que yi men (missing one suit)', () => {
        const s0 = chengduRulePack.buildInitialState();
        
        // 只有万和条，缺筒
        const hand: Tile[] = [
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
          { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
          { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 },
          { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
          { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
        ];
        
        const s1: GameState = {
          ...s0,
          phase: 'PLAYING',
          currentPlayer: 'P0',
          hands: { ...s0.hands, P0: hand.slice(0, 13) },
          lastDiscard: { tile: hand[13], from: 'P1' },
        };

        const actions = chengduRulePack.getLegalActions(s1, 'P0');
        const huAction = actions.find(a => a.type === 'HU');
        
        expect(huAction).toBeTruthy();
      });

      it('should prevent win without que yi men (has all three suits)', () => {
        const s0 = chengduRulePack.buildInitialState();
        
        // 有万条筒三种花色，不满足缺一门
        const hand: Tile[] = [
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
          { suit: 'B', rank: 4 }, { suit: 'B', rank: 5 }, { suit: 'B', rank: 6 },
          { suit: 'T', rank: 7 }, { suit: 'T', rank: 8 }, { suit: 'T', rank: 9 },
          { suit: 'W', rank: 5 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 5 },
          { suit: 'B', rank: 9 }, { suit: 'B', rank: 9 },
        ];
        
        const s1: GameState = {
          ...s0,
          phase: 'PLAYING',
          currentPlayer: 'P0',
          hands: { ...s0.hands, P0: hand.slice(0, 13) },
          lastDiscard: { tile: hand[13], from: 'P1' },
        };

        const actions = chengduRulePack.getLegalActions(s1, 'P0');
        const huAction = actions.find(a => a.type === 'HU');
        
        // 不应该有胡牌动作
        expect(huAction).toBeUndefined();
      });

      it('should allow qing yi se (pure suit) which satisfies que yi men', () => {
        const s0 = chengduRulePack.buildInitialState();
        
        // 清一色（只有万），满足缺一门
        const hand: Tile[] = [
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
          { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
          { suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 },
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 }, { suit: 'W', rank: 1 },
          { suit: 'W', rank: 2 }, { suit: 'W', rank: 2 },
        ];
        
        const s1: GameState = {
          ...s0,
          phase: 'PLAYING',
          currentPlayer: 'P0',
          hands: { ...s0.hands, P0: hand.slice(0, 13) },
          lastDiscard: { tile: hand[13], from: 'P1' },
        };

        const actions = chengduRulePack.getLegalActions(s1, 'P0');
        const huAction = actions.find(a => a.type === 'HU');
        
        expect(huAction).toBeTruthy();
      });
    });

    describe('jin gou diao (single wait)', () => {
      it('should detect jin gou diao when winning on pair', () => {
        const hand: Tile[] = [
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
          { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
          { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 },
          { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
          { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
        ];

        const patterns = findWinPatterns(hand);
        const validPattern = patterns.find(p => p.isValid);
        expect(validPattern).toBeTruthy();

        const winTile = { suit: 'W' as const, rank: 9 as const };
        const yakuList = detectYaku(validPattern!, hand, winTile, false, 0, false, false, false, false, false);
        
        const jinGouDiao = yakuList.find(y => y.type === 'JIN_GOU_DIAO');
        expect(jinGouDiao).toBeTruthy();
        expect(jinGouDiao?.fan).toBe(2);
      });

      it('should not detect jin gou diao when winning on sequence', () => {
        const hand: Tile[] = [
          { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
          { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 },
          { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 },
          { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 }, { suit: 'B', rank: 5 },
          { suit: 'W', rank: 9 }, { suit: 'W', rank: 9 },
        ];

        const patterns = findWinPatterns(hand);
        const validPattern = patterns.find(p => p.isValid);

        const winTile = { suit: 'W' as const, rank: 3 as const };
        const yakuList = detectYaku(validPattern!, hand, winTile, false, 0, false, false, false, false, false);
        
        const jinGouDiao = yakuList.find(y => y.type === 'JIN_GOU_DIAO');
        expect(jinGouDiao).toBeUndefined();
      });
    });

    describe('gen (gang multiplier)', () => {
      it('should calculate score with gen multiplier', () => {
        const yakuList = [
          { type: 'PING_HU' as const, fan: 1, description: '平胡' },
        ];
        
        // 无杠
        const score0 = calculateScore(yakuList, 0);
        expect(score0).toBe(5);
        
        // 1 杠（+1 番）
        const score1 = calculateScore(yakuList, 1);
        expect(score1).toBe(10);
        
        // 2 杠（+2 番）
        const score2 = calculateScore(yakuList, 2);
        expect(score2).toBe(20);
        
        // 3 杠（+3 番）
        const score3 = calculateScore(yakuList, 3);
        expect(score3).toBe(40);
      });

      it('should calculate score with high fan and gen', () => {
        const yakuList = [
          { type: 'QING_YI_SE' as const, fan: 6, description: '清一色' },
          { type: 'DUI_DUI_HU' as const, fan: 2, description: '对对胡' },
        ];
        
        // 8 番：5 * 2^(8-1) = 640
        const score0 = calculateScore(yakuList, 0);
        expect(score0).toBe(640);
        
        // 1 杠（+1 番）
        const score1 = calculateScore(yakuList, 1);
        expect(score1).toBe(1280);
      });
    });

    describe('exchange (huan san zhang)', () => {
      it('should validate same suit tiles', () => {
        
        // 同花色 - 有效
        const validTiles: Tile[] = [
          { suit: 'W', rank: 1 },
          { suit: 'W', rank: 5 },
          { suit: 'W', rank: 9 },
        ];
        expect(validateExchangeTiles(validTiles)).toBe(true);
        
        // 不同花色 - 无效
        const invalidTiles: Tile[] = [
          { suit: 'W', rank: 1 },
          { suit: 'B', rank: 5 },
          { suit: 'T', rank: 9 },
        ];
        expect(validateExchangeTiles(invalidTiles)).toBe(false);
        
        // 数量不对 - 无效
        const wrongCount: Tile[] = [
          { suit: 'W', rank: 1 },
          { suit: 'W', rank: 5 },
        ];
        expect(validateExchangeTiles(wrongCount)).toBe(false);
      });

      it('should perform clockwise exchange', () => {
        
        const selections: Record<PlayerId, Tile[]> = {
          P0: [{ suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }],
          P1: [{ suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }],
          P2: [{ suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
          P3: [{ suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }],
        };
        
        const result = performExchange(selections, 'CLOCKWISE');
        
        // P0的牌给P1，P1的牌给P2，P2的牌给P3，P3的牌给P0
        expect(result.P1).toEqual(selections.P0);
        expect(result.P2).toEqual(selections.P1);
        expect(result.P3).toEqual(selections.P2);
        expect(result.P0).toEqual(selections.P3);
      });

      it('should perform counter-clockwise exchange', () => {
        
        const selections: Record<PlayerId, Tile[]> = {
          P0: [{ suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }],
          P1: [{ suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }],
          P2: [{ suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
          P3: [{ suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }],
        };
        
        const result = performExchange(selections, 'COUNTER_CLOCKWISE');
        
        // P0的牌给P3，P3的牌给P2，P2的牌给P1，P1的牌给P0
        expect(result.P3).toEqual(selections.P0);
        expect(result.P2).toEqual(selections.P3);
        expect(result.P1).toEqual(selections.P2);
        expect(result.P0).toEqual(selections.P1);
      });

      it('should perform opposite exchange', () => {
        
        const selections: Record<PlayerId, Tile[]> = {
          P0: [{ suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }],
          P1: [{ suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }],
          P2: [{ suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
          P3: [{ suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }],
        };
        
        const result = performExchange(selections, 'OPPOSITE');
        
        // P0和P2交换，P1和P3交换
        expect(result.P2).toEqual(selections.P0);
        expect(result.P0).toEqual(selections.P2);
        expect(result.P3).toEqual(selections.P1);
        expect(result.P1).toEqual(selections.P3);
      });
    });

    describe('tile sorting', () => {
      it('should sort tiles by suit and rank', () => {
        const unsorted: Tile[] = [
          { suit: 'T', rank: 5 },
          { suit: 'W', rank: 3 },
          { suit: 'B', rank: 7 },
          { suit: 'W', rank: 1 },
          { suit: 'T', rank: 2 },
          { suit: 'B', rank: 4 },
        ];

        const sorted = sortTiles(unsorted);

        // 应该按 W < B < T，同花色按点数排序
        expect(sorted).toEqual([
          { suit: 'W', rank: 1 },
          { suit: 'W', rank: 3 },
          { suit: 'B', rank: 4 },
          { suit: 'B', rank: 7 },
          { suit: 'T', rank: 2 },
          { suit: 'T', rank: 5 },
        ]);
      });

      it('should group tiles by suit', () => {
        const tiles: Tile[] = [
          { suit: 'T', rank: 5 },
          { suit: 'W', rank: 3 },
          { suit: 'B', rank: 7 },
          { suit: 'W', rank: 1 },
          { suit: 'T', rank: 2 },
          { suit: 'B', rank: 4 },
        ];

        const grouped = groupAndSortTiles(tiles);

        expect(grouped.wan).toEqual([
          { suit: 'W', rank: 1 },
          { suit: 'W', rank: 3 },
        ]);
        expect(grouped.tiao).toEqual([
          { suit: 'B', rank: 4 },
          { suit: 'B', rank: 7 },
        ]);
        expect(grouped.tong).toEqual([
          { suit: 'T', rank: 2 },
          { suit: 'T', rank: 5 },
        ]);
      });

      it('should get sorted hand in wan-tiao-tong order', () => {
        const tiles: Tile[] = [
          { suit: 'T', rank: 9 },
          { suit: 'B', rank: 1 },
          { suit: 'W', rank: 5 },
          { suit: 'T', rank: 1 },
          { suit: 'B', rank: 9 },
          { suit: 'W', rank: 1 },
        ];

        const sorted = getSortedHand(tiles);

        // 万 → 条 → 筒
        expect(sorted[0]).toEqual({ suit: 'W', rank: 1 });
        expect(sorted[1]).toEqual({ suit: 'W', rank: 5 });
        expect(sorted[2]).toEqual({ suit: 'B', rank: 1 });
        expect(sorted[3]).toEqual({ suit: 'B', rank: 9 });
        expect(sorted[4]).toEqual({ suit: 'T', rank: 1 });
        expect(sorted[5]).toEqual({ suit: 'T', rank: 9 });
      });
    });
  });
});
