import { describe, expect, it } from 'vitest';
import type { GameState, Meld } from '../src/core/model/state';
import type { Tile } from '../src/core/model/tile';
import type { Action } from '../src/core/model/action';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';

function t(suit: Tile['suit'], rank: Tile['rank']): Tile {
    return { suit, rank };
}

/** Create a base PLAYING state with chengdu-specific fields */
function baseState(): GameState {
    const state: GameState & Record<string, unknown> = {
        wall: new Array(40).fill(t('W', 1)),
        hands: {
            P0: [],
            P1: [],
            P2: [],
            P3: [],
        },
        discards: {
            P0: [],
            P1: [],
            P2: [],
            P3: [],
        },
        melds: {
            P0: [],
            P1: [],
            P2: [],
            P3: [],
        },
        lastDiscard: null,
        declaredHu: { P0: false, P1: false, P2: false, P3: false },
        currentPlayer: 'P0',
        phase: 'PLAYING',
        turn: 5,
        // ChengduState extensions
        dingQueSelection: { P0: 'T', P1: 'T', P2: 'T', P3: 'T' },
        roundScores: { P0: 0, P1: 0, P2: 0, P3: 0 },
        dealInStats: {
            P0: { count: 0, stageB: 0, stageC: 0 },
            P1: { count: 0, stageB: 0, stageC: 0 },
            P2: { count: 0, stageB: 0, stageC: 0 },
            P3: { count: 0, stageB: 0, stageC: 0 },
        },
        passedHuPlayers: { P0: false, P1: false, P2: false, P3: false },
    };
    return state as GameState;
}

describe('碰定缺花色 blocking', () => {
    it('should NOT allow PENG on missing-suit tile', () => {
        const s = baseState();
        // P0's ding que is T (筒). P0 has two T5 in hand.
        s.hands.P0 = [t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5),
        t('W', 6), t('W', 7), t('B', 1), t('B', 2), t('B', 3),
        t('T', 5), t('T', 5), t('B', 9)];
        s.lastDiscard = { tile: t('T', 5), from: 'P1' };
        s.currentPlayer = 'P1'; // P1 just discarded

        const legal = chengduRulePack.getLegalActions(s, 'P0');
        const pengActions = legal.filter(a => a.type === 'PENG');
        // Should not be able to PENG a tile of missing suit T
        expect(pengActions.length).toBe(0);
    });

    it('should allow PENG on non-missing-suit tile', () => {
        const s = baseState();
        // P0's ding que is T. P0 has two W5 in hand (not missing suit).
        s.hands.P0 = [t('W', 5), t('W', 5), t('W', 3), t('W', 4),
        t('B', 1), t('B', 2), t('B', 3), t('B', 4), t('B', 5),
        t('B', 6), t('B', 7), t('B', 8), t('B', 9)];
        s.lastDiscard = { tile: t('W', 5), from: 'P1' };
        s.currentPlayer = 'P1';

        const legal = chengduRulePack.getLegalActions(s, 'P0');
        const pengActions = legal.filter(a => a.type === 'PENG');
        expect(pengActions.length).toBeGreaterThan(0);
    });
});

describe('暗杠雨钱 excludes 已胡 players', () => {
    it('should only charge non-hu players for AN gang', () => {
        const s = baseState();
        // P3 has already hu'd
        s.declaredHu.P3 = true;
        s.currentPlayer = 'P0';
        // P0 has 4 W1 tiles (can AN gang)
        s.hands.P0 = [t('W', 1), t('W', 1), t('W', 1), t('W', 1),
        t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6),
        t('B', 1), t('B', 2), t('B', 3), t('B', 7)];

        // Execute AN gang
        const gangAction: Action = { type: 'GANG', tile: t('W', 1), from: 'P0', gangType: 'AN' };
        const newState = chengduRulePack.applyAction(s, gangAction);
        const scores = (newState as Record<string, unknown>).roundScores as Record<string, number>;

        // P0 should get +20 (from 2 non-hu opponents: P1 and P2), NOT +30
        expect(scores.P0).toBe(20);
        // P1 and P2 each lose 10
        expect(scores.P1).toBe(-10);
        expect(scores.P2).toBe(-10);
        // P3 (already hu'd) should NOT lose anything
        expect(scores.P3).toBe(0);
    });
});

describe('自摸逐家收取 (not 均摊)', () => {
    it('each non-hu player should pay full score on self-draw', () => {
        const s = baseState();
        s.currentPlayer = 'P0';
        // P0 winning hand: 123W 456W 789W 55B + 123B (last tile B3 completes sequence, not pair)
        // This avoids JIN_GOU_DIAO: winTile = B3 is in a sequence group, not the pair
        s.hands.P0 = [t('B', 5), t('B', 5), t('W', 1), t('W', 2), t('W', 3), t('W', 4),
        t('W', 5), t('W', 6), t('W', 7), t('W', 8), t('W', 9), t('B', 1),
        t('B', 2), t('B', 3)];
        s.lastDiscard = null;
        // Self-draw HU (from = currentPlayer, no lastDiscard = self-draw)
        const huAction: Action = { type: 'HU', from: 'P0' };
        const newState = chengduRulePack.applyAction(s, huAction);
        const scores = (newState as Record<string, unknown>).roundScores as Record<string, number>;

        // Self-draw: ZI_MO(1) only (PING_HU not added when ZI_MO present) = 1 fan → 5 × 2^0 = 5
        // Each of 3 losers pays 5, winner gets 15
        expect(scores.P0).toBe(15);
        expect(scores.P1).toBe(-5);
        expect(scores.P2).toBe(-5);
        expect(scores.P3).toBe(-5);
    });

    it('with one player already hu, remaining losers each pay full score', () => {
        const s = baseState();
        s.currentPlayer = 'P0';
        s.declaredHu.P3 = true;
        s.lastDiscard = null;
        // Same hand structure: pair first, winning tile (B3) completes a sequence
        s.hands.P0 = [t('B', 5), t('B', 5), t('W', 1), t('W', 2), t('W', 3), t('W', 4),
        t('W', 5), t('W', 6), t('W', 7), t('W', 8), t('W', 9), t('B', 1),
        t('B', 2), t('B', 3)];
        const huAction: Action = { type: 'HU', from: 'P0' };
        const newState = chengduRulePack.applyAction(s, huAction);
        const scores = (newState as Record<string, unknown>).roundScores as Record<string, number>;

        // ZI_MO(1) = 1 fan → score = 5
        // 2 remaining losers (P1, P2) each pay 5, winner gets 10
        expect(scores.P0).toBe(10);
        expect(scores.P1).toBe(-5);
        expect(scores.P2).toBe(-5);
        expect(scores.P3).toBe(0);
    });
});

describe('过水不能胡', () => {
    it('should suppress HU for a player who passed on HU opportunity', () => {
        const s = baseState();
        // Mark P1 as having passed on a HU opportunity
        (s as Record<string, unknown>).passedHuPlayers = { P0: false, P1: true, P2: false, P3: false };

        // P1 can form a winning hand with a discard from P2
        // 123W 456W 789W 123B + 5B waiting for pair
        s.hands.P1 = [t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6),
        t('W', 7), t('W', 8), t('W', 9), t('B', 1), t('B', 2), t('B', 3),
        t('B', 5)];
        (s as Record<string, unknown>).dingQueSelection = { P0: 'T', P1: 'T', P2: 'T', P3: 'T' };
        s.lastDiscard = { tile: t('B', 5), from: 'P2' };
        s.currentPlayer = 'P2';

        const legal = chengduRulePack.getLegalActions(s, 'P1');
        const huActions = legal.filter(a => a.type === 'HU');
        // P1 should NOT be able to HU because they are in 过水 state
        expect(huActions.length).toBe(0);
    });

    it('should clear 过水 after player completes a DISCARD', () => {
        const s = baseState();
        (s as Record<string, unknown>).passedHuPlayers = { P0: false, P1: true, P2: false, P3: false };
        s.currentPlayer = 'P1';
        // P1 has some hand and discards
        s.hands.P1 = [t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6),
        t('W', 7), t('W', 8), t('W', 9), t('B', 1), t('B', 2), t('B', 3),
        t('B', 5), t('B', 9)];

        // P1 discards a tile
        const discardAction: Action = { type: 'DISCARD', tile: t('B', 9) };
        const newState = chengduRulePack.applyAction(s, discardAction);
        const passedHu = (newState as Record<string, unknown>).passedHuPlayers as Record<string, boolean>;

        // P1's 过水 should be cleared after discard
        expect(passedHu.P1).toBe(false);
    });
});

describe('流局查花猪', () => {
    it('花猪 should be penalized in draw settlement', () => {
        const s = baseState();
        s.wall = []; // Empty wall = draw
        s.phase = 'PLAYING';
        // Nobody has hu'd
        // P0 is a 花猪: still has T (missing suit) tiles in hand
        s.hands.P0 = [t('W', 1), t('W', 2), t('W', 3), t('T', 5)]; // has T5, ding que = T → 花猪
        s.melds.P0 = [
            { type: 'PENG', tile: t('W', 4), from: 'P1' },
            { type: 'PENG', tile: t('W', 7), from: 'P2' },
            { type: 'PENG', tile: t('B', 1), from: 'P3' },
        ];

        // P1 is tenpai (listening for a tile)
        // 123W 456W 789W + 1B waiting for pair
        s.hands.P1 = [t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6),
        t('W', 7), t('W', 8), t('W', 9), t('B', 1), t('B', 2), t('B', 3),
        t('B', 5)];
        // P2 is not tenpai
        s.hands.P2 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];
        // P3 is not tenpai
        s.hands.P3 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];

        const result = chengduRulePack.settleRound(s);

        // P0 (花猪) should have negative score
        expect(result.scores.P0).toBeLessThan(0);
    });
});

describe('流局查叫', () => {
    it('non-tenpai player should pay tenpai player in draw settlement', () => {
        const s = baseState();
        s.wall = []; // Draw
        // No 花猪 - all players have completed ding que
        // P0: tenpai (listening)
        // 123W 456W 789W 12B waiting for 3B
        s.hands.P0 = [t('W', 1), t('W', 2), t('W', 3), t('W', 4), t('W', 5), t('W', 6),
        t('W', 7), t('W', 8), t('W', 9), t('B', 1), t('B', 2), t('B', 3),
        t('B', 5)];
        // P1: not tenpai
        s.hands.P1 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];
        // P2: not tenpai
        s.hands.P2 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];
        // P3: not tenpai
        s.hands.P3 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];

        const result = chengduRulePack.settleRound(s);

        // P0 (tenpai) should have positive score from 查叫
        expect(result.scores.P0).toBeGreaterThan(0);
        // Non-tenpai players should have negative scores
        expect(result.scores.P1).toBeLessThan(0);
        expect(result.scores.P2).toBeLessThan(0);
        expect(result.scores.P3).toBeLessThan(0);
    });

    it('should NOT trigger draw settlement when 3 players have hu', () => {
        const s = baseState();
        s.wall = []; // Wall also empty
        s.declaredHu = { P0: true, P1: true, P2: true, P3: false };

        // P3 hand doesn't matter much, but give a valid one
        s.hands.P3 = [t('W', 1), t('W', 3), t('W', 5), t('W', 7), t('B', 2), t('B', 4),
        t('B', 6), t('B', 8), t('W', 2), t('W', 4), t('W', 6), t('B', 1),
        t('B', 3)];

        const result = chengduRulePack.settleRound(s);

        // No draw settlement penalties: scores come only from prior play
        // P3 score should be 0 (no draw penalties applied)
        expect(result.scores.P3).toBe(0);
    });
});
