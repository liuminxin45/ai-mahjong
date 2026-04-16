import { describe, it, expect } from 'vitest';
import { getStrategyContext, inferSituation, getAllModules } from '../src/llm/StrategyContext';

describe('StrategyContext', () => {
    describe('getAllModules', () => {
        it('should contain all 10 strategy modules', () => {
            const modules = getAllModules();
            const keys = Object.keys(modules);
            expect(keys).toContain('exchange');
            expect(keys).toContain('dingque');
            expect(keys).toContain('discard_quemen');
            expect(keys).toContain('discard_offense');
            expect(keys).toContain('discard_baoting');
            expect(keys).toContain('listen');
            expect(keys).toContain('gang');
            expect(keys).toContain('defense');
            expect(keys).toContain('endgame');
            expect(keys).toContain('probability');
            expect(keys.length).toBe(10);
        });

        it('each module should be a non-empty string', () => {
            const modules = getAllModules();
            for (const [key, content] of Object.entries(modules)) {
                expect(content, `module "${key}" should be non-empty`).toBeTruthy();
                expect(typeof content).toBe('string');
                expect(content.length).toBeGreaterThan(100);
            }
        });
    });

    describe('getStrategyContext', () => {
        it('EXCHANGE phase returns exchange module', () => {
            const ctx = getStrategyContext('EXCHANGE');
            expect(ctx).toContain('换三张');
            expect(ctx).toContain('定缺');
        });

        it('DING_QUE phase returns dingque module', () => {
            const ctx = getStrategyContext('DING_QUE');
            expect(ctx).toContain('定缺');
            expect(ctx).toContain('评分公式');
        });

        it('PLAYING with offense returns discard_offense module', () => {
            const ctx = getStrategyContext('PLAYING', 'offense');
            expect(ctx).toContain('向听');
            expect(ctx).toContain('进张');
        });

        it('PLAYING with quemen returns discard_quemen module', () => {
            const ctx = getStrategyContext('PLAYING', 'quemen');
            expect(ctx).toContain('缺门');
        });

        it('PLAYING with baoting returns discard_baoting module', () => {
            const ctx = getStrategyContext('PLAYING', 'baoting');
            expect(ctx).toContain('保听');
            expect(ctx).toContain('查叫');
        });

        it('PLAYING with listen returns listen module', () => {
            const ctx = getStrategyContext('PLAYING', 'listen');
            expect(ctx).toContain('听牌');
            expect(ctx).toContain('EV');
        });

        it('PLAYING with gang returns gang module', () => {
            const ctx = getStrategyContext('PLAYING', 'gang');
            expect(ctx).toContain('杠');
            expect(ctx).toContain('抢杠');
        });

        it('PLAYING with defense returns defense module', () => {
            const ctx = getStrategyContext('PLAYING', 'defense');
            expect(ctx).toContain('防守');
            expect(ctx).toContain('安全');
        });

        it('PLAYING with endgame returns endgame module', () => {
            const ctx = getStrategyContext('PLAYING', 'endgame');
            expect(ctx).toContain('尾局');
            expect(ctx).toContain('花猪');
        });

        it('END phase returns endgame module', () => {
            const ctx = getStrategyContext('END');
            expect(ctx).toContain('尾局');
        });

        it('withProbability=true appends probability module', () => {
            const without = getStrategyContext('PLAYING', 'offense', false);
            const withProb = getStrategyContext('PLAYING', 'offense', true);
            expect(withProb.length).toBeGreaterThan(without.length);
            expect(withProb).toContain('超几何');
        });

        it('PLAYING without situation defaults to offense', () => {
            const ctx = getStrategyContext('PLAYING');
            expect(ctx).toContain('向听');
            expect(ctx).toContain('进张');
        });

        it('unknown phase returns empty string', () => {
            const ctx = getStrategyContext('UNKNOWN');
            expect(ctx).toBe('');
        });
    });

    describe('inferSituation', () => {
        const baseState = {
            phase: 'PLAYING',
            hands: {
                P0: [{ suit: 'W' }, { suit: 'B' }, { suit: 'T' }],
                P1: [{ suit: 'W' }],
                P2: [{ suit: 'W' }],
                P3: [{ suit: 'W' }],
            },
            wall: new Array(50),
            melds: { P0: [], P1: [], P2: [], P3: [] },
            declaredHu: { P0: false, P1: false, P2: false, P3: false },
            dingQueSelection: { P0: 'T', P1: 'W', P2: 'B', P3: 'W' },
        };

        it('returns quemen when player has ding-que tiles in hand', () => {
            const result = inferSituation(baseState as any, 'P0');
            // P0 has a T tile and dingQue is T
            expect(result).toBe('quemen');
        });

        it('returns endgame when wall < 20', () => {
            const state = {
                ...baseState,
                hands: {
                    ...baseState.hands,
                    P0: [{ suit: 'W' }, { suit: 'B' }], // no T tile, so not quemen
                },
                wall: new Array(15),
            };
            const result = inferSituation(state as any, 'P0');
            expect(result).toBe('endgame');
        });

        it('returns defense when opponent has ≥2 melds and wall < 40', () => {
            const state = {
                ...baseState,
                hands: {
                    ...baseState.hands,
                    P0: [{ suit: 'W' }, { suit: 'B' }], // no T tile
                },
                wall: new Array(35),
                melds: { P0: [], P1: [{}, {}], P2: [], P3: [] },
            };
            const result = inferSituation(state as any, 'P0');
            expect(result).toBe('defense');
        });

        it('returns offense by default', () => {
            const state = {
                ...baseState,
                hands: {
                    ...baseState.hands,
                    P0: [{ suit: 'W' }, { suit: 'B' }], // no T tile
                },
            };
            const result = inferSituation(state as any, 'P0');
            expect(result).toBe('offense');
        });

        it('returns undefined for non-PLAYING phase', () => {
            const state = { ...baseState, phase: 'EXCHANGE' };
            const result = inferSituation(state as any, 'P0');
            expect(result).toBeUndefined();
        });
    });
});
