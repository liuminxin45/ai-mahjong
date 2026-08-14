import { describe, expect, it } from 'vitest';
import { AudioEngine, MAX_VOICES, describeEventForAnnouncement } from '../../src/audio/AudioEngine';
import type { GameEvent } from '../../src/core/model/event';

/**
 * AudioEngine 单元测试（Node 环境无 AudioContext）。
 * 覆盖：
 * 1. 事件→SFX 路由（AUDIO_DESIGN §6.3 Must 集 + §7.2 钩点）。
 * 2. 未手势初始化时 play 静默丢弃（无自动播放合规）。
 * 3. aria-live 播报文案（§5.2 音频替代文本通道）。
 * 4. 并发预算常量（§4.3）。
 */

function ev(partial: Partial<GameEvent> & { type: GameEvent['type'] }): GameEvent {
    return { turn: 1, ts: 0, ...partial } as GameEvent;
}

describe('AudioEngine 事件路由（§7.2）', () => {
    const engine = new AudioEngine();

    it('gameplay 事件 → MVP SFX', () => {
        expect(engine.sfxForEvent(ev({ type: 'DISCARD', playerId: 'P0' }), null)).toBe('SFX_DISCARD');
        expect(engine.sfxForEvent(ev({ type: 'PENG', playerId: 'P0' }), null)).toBe('SFX_PENG');
        expect(engine.sfxForEvent(ev({ type: 'GANG', playerId: 'P1', gangType: 'MING' }), null)).toBe('SFX_GANG');
        expect(engine.sfxForEvent(ev({ type: 'HU', playerId: 'P0' }), null)).toBe('SFX_HU');
    });

    it('END 事件按 P0 结果路由结算音', () => {
        const end = ev({ type: 'END' });
        expect(engine.sfxForEvent(end, 'HU')).toBe('SFX_SETTLE_WIN');
        expect(engine.sfxForEvent(end, 'LOSE')).toBe('SFX_SETTLE_LOSE');
        expect(engine.sfxForEvent(end, 'DRAW')).toBe('SFX_FLOW_END');
        expect(engine.sfxForEvent(end, null)).toBe('SFX_FLOW_END');
    });

    it('非 MVP 事件不触发音效', () => {
        expect(engine.sfxForEvent(ev({ type: 'INIT' }), null)).toBeNull();
        expect(engine.sfxForEvent(ev({ type: 'DRAW', playerId: 'P0' }), null)).toBeNull();
        expect(engine.sfxForEvent(ev({ type: 'TURN', playerId: 'P0' }), null)).toBeNull();
    });
});

describe('AudioEngine 无自动播放合规（A11Y §1.1）', () => {
    it('未手势初始化前 isReady=false 且 play 静默丢弃不抛错', () => {
        const engine = new AudioEngine();
        expect(engine.isReady).toBe(false);
        expect(engine.contextState).toBe('idle');
        expect(() => {
            engine.play('SFX_HU');
            engine.play('SFX_UI_CLICK');
            engine.play('SFX_SETTLE_WIN');
        }).not.toThrow();
    });

    it('Node 环境无 AudioContext 时 ensureRunning 安全失败', async () => {
        const engine = new AudioEngine();
        const ok = await engine.ensureRunning();
        expect(ok).toBe(false);
        expect(engine.contextState).toBe('idle');
    });

    it('并发预算 ≤ 16 voice（§4.3）', () => {
        expect(MAX_VOICES).toBe(16);
    });
});

describe('aria-live 播报文案（§5.2 音频替代文本）', () => {
    it('P0 关键事件有第一人称文案', () => {
        const tile = { suit: 'tiao', rank: 3 } as GameEvent['tile'];
        expect(describeEventForAnnouncement(ev({ type: 'PENG', playerId: 'P0', tile }), null)).toContain('你碰了');
        expect(describeEventForAnnouncement(ev({ type: 'GANG', playerId: 'P0', tile }), null)).toContain('你杠了');
        expect(describeEventForAnnouncement(ev({ type: 'HU', playerId: 'P0', tile }), null)).toContain('你胡了');
        expect(describeEventForAnnouncement(ev({ type: 'DISCARD', playerId: 'P0', tile }), null)).toContain('你打出了');
    });

    it('对手出牌不播报（降噪），对手碰/杠/胡播报', () => {
        const tile = { suit: 'wan', rank: 5 } as GameEvent['tile'];
        expect(describeEventForAnnouncement(ev({ type: 'DISCARD', playerId: 'P1', tile }), null)).toBeNull();
        expect(describeEventForAnnouncement(ev({ type: 'PENG', playerId: 'P1', tile }), null)).toContain('P1');
        expect(describeEventForAnnouncement(ev({ type: 'HU', playerId: 'P2' }), null)).toContain('P2');
    });

    it('END 事件按结果播报结算文案', () => {
        const end = ev({ type: 'END' });
        expect(describeEventForAnnouncement(end, 'HU')).toBe('对局结束，你赢了');
        expect(describeEventForAnnouncement(end, 'LOSE')).toBe('对局结束，你输了');
        expect(describeEventForAnnouncement(end, 'DRAW')).toBe('对局结束，流局');
    });

    it('INIT/DRAW/TURN 不播报', () => {
        expect(describeEventForAnnouncement(ev({ type: 'INIT' }), null)).toBeNull();
        expect(describeEventForAnnouncement(ev({ type: 'DRAW', playerId: 'P0' }), null)).toBeNull();
        expect(describeEventForAnnouncement(ev({ type: 'TURN', playerId: 'P0' }), null)).toBeNull();
    });
});
