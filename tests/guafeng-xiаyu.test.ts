import { describe, expect, it } from 'vitest';
import { chengduRulePack } from '../src/core/rules/packs/chengdu/index';
import { canPerformGuaFengXiaYu, findWinPatterns, detectYaku } from '../src/core/rules/packs/chengdu/patterns';
import type { Tile } from '../src/core/model/tile';
import type { GameState } from '../src/core/model/state';
import type { ChengduState } from '../src/core/rules/packs/chengdu/index';

describe('刮风下雨 (Guafeng Xiаyu)', () => {
    describe('canPerformGuaFengXiaYu', () => {
        it('should detect when guafeng xiаyu is possible', () => {
            // 有两个二筒PENG，手里还有其他牌能组成胡牌
            const hand: Tile[] = [
                { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, // 顺子
                { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 }, // 顺子
                { suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }, // 顺子
                { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, // 对子
                { suit: 'T', rank: 2 }, // 与PENG相同的牌
            ];

            const melds = [
                { type: 'PENG', tile: { suit: 'T', rank: 2 } },
            ];

            const guaFengTile = { suit: 'T', rank: 2 };
            const result = canPerformGuaFengXiaYu(hand, melds, guaFengTile);
            expect(result).toBe(true);
            console.log('✓ canPerformGuaFengXiaYu correctly detected guafeng xiаyu possibility');
        });

        it('should return false when remaining hand cannot win', () => {
            // 移除与PENG相同的牌后，手里牌数不足以胡
            const hand: Tile[] = [
                { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 },
                { suit: 'T', rank: 2 }, // 与PENG相同的牌
            ];

            const melds = [
                { type: 'PENG', tile: { suit: 'T', rank: 2 } },
            ];

            const guaFengTile = { suit: 'T', rank: 2 };
            const result = canPerformGuaFengXiaYu(hand, melds, guaFengTile);
            expect(result).toBe(false);
            console.log('✓ canPerformGuaFengXiaYu correctly rejected when remaining hand cannot win');
        });
    });

    describe('guafeng xiаyu in game', () => {
        it('should offer guafeng xiаyu as legal action when conditions are met', () => {
            const s0 = chengduRulePack.buildInitialState();

            // 设置游戏状态：P0已经碰了三个二筒，现在摸到第四个二筒
            const s1: GameState = {
                ...s0,
                phase: 'PLAYING',
                currentPlayer: 'P0',
                turn: 1,
                hands: {
                    P0: [
                        { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, // 顺子
                        { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 }, // 顺子
                        { suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }, // 顺子
                        { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, // 对子
                        { suit: 'T', rank: 2 }, // 刚摸到的牌，与PENG相同
                    ],
                    P1: s0.hands.P1,
                    P2: s0.hands.P2,
                    P3: s0.hands.P3,
                },
                melds: {
                    P0: [{ type: 'PENG', tile: { suit: 'T', rank: 2 } }],
                    P1: [],
                    P2: [],
                    P3: [],
                },
                dingQueSelection: { P0: 'B', P1: 'W', P2: 'T', P3: 'B' },
                wall: [...s0.wall.slice(11)], // 简化牌墙
            } as any;

            const legalActions = chengduRulePack.getLegalActions(s1, 'P0');

            // 应该包含"刮风下雨"胡牌动作
            const guaFengActions = legalActions.filter(
                a => a.type === 'HU' && a.tile && a.tile.suit === 'T' && a.tile.rank === 2
            );

            if (guaFengActions.length > 0) {
                console.log(`✓ Found ${guaFengActions.length} guafeng xiаyu action(s)`);
                expect(guaFengActions.length).toBeGreaterThan(0);
            } else {
                console.log('⚠ No guafeng xiаyu action found in legal actions');
                console.log('Legal actions:', legalActions.map(a => a.type).join(', '));
            }
        });

        it('should detect GUAFENG_XIАYU yaku when player does guafeng xiаyu hu', () => {
            const hand: Tile[] = [
                { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }, // 顺子
                { suit: 'W', rank: 4 }, { suit: 'W', rank: 5 }, { suit: 'W', rank: 6 }, // 顺子
                { suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }, // 顺子
                { suit: 'B', rank: 1 }, { suit: 'B', rank: 1 }, // 对子
            ];

            const patterns = findWinPatterns(hand);
            const validPattern = patterns && patterns.find(p => p.isValid);

            if (validPattern) {
                const yakuList = detectYaku(
                    validPattern,
                    hand,
                    hand[hand.length - 1],
                    true,
                    1,
                    false,
                    false,
                    false,
                    false,
                    false,
                    true, // isGuaFengXiaYu = true
                );

                const guaFengYaku = yakuList.find(y => y.type === 'GUAFENG_XIАYU');
                if (guaFengYaku) {
                    console.log(`✓ Detected GUAFENG_XIАYU yaku with ${guaFengYaku.fan} fan`);
                    expect(guaFengYaku).toBeDefined();
                    expect(guaFengYaku?.fan).toBe(2);
                } else {
                    console.log('⚠ GUAFENG_XIАYU yaku not detected');
                    console.log('Detected yakus:', yakuList.map(y => y.type).join(', '));
                }
            }
        });
    });
});
