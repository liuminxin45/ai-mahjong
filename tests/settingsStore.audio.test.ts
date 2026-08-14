import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SETTINGS_STORAGE_KEY = 'ai-mahjong:settings';

describe('settingsStore audio settings (AUDIO_DESIGN §4.5)', () => {
    const storage = new Map<string, string>();

    const localStorageMock = {
        getItem(key: string) {
            return storage.has(key) ? storage.get(key)! : null;
        },
        setItem(key: string, value: string) {
            storage.set(key, value);
        },
        removeItem(key: string) {
            storage.delete(key);
        },
        clear() {
            storage.clear();
        },
    };

    beforeEach(() => {
        storage.clear();
        vi.resetModules();
        vi.stubGlobal('localStorage', localStorageMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('defaults: enabled, sfx 0.8, bgm 0.35, voice 1.0, reduceIntensity false', async () => {
        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        expect(store.audioEnabled).toBe(true);
        expect(store.sfxVolume).toBe(0.8);
        expect(store.bgmVolume).toBe(0.35);
        expect(store.voiceVolume).toBe(1);
        expect(store.reduceAudioIntensity).toBe(false);
    });

    it('persists audio settings and tolerates legacy saves without audio key', async () => {
        // 旧存档：无 audio 字段 → 必须回落到默认值而不是崩溃
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({ ruleId: 'chengdu', uiScale: 1.1 }));

        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        expect(store.audioEnabled).toBe(true);
        expect(store.sfxVolume).toBe(0.8);

        store.setAudioEnabled(false);
        store.setSfxVolume(0.5);
        store.setBgmVolume(0.2);
        store.setVoiceVolume(0.6);
        store.setReduceAudioIntensity(true);

        const saved = JSON.parse(storage.get(SETTINGS_STORAGE_KEY) || '{}');
        expect(saved.audio).toEqual({
            enabled: false,
            sfxVolume: 0.5,
            bgmVolume: 0.2,
            voiceVolume: 0.6,
            reduceIntensity: true,
        });
        // 旧字段不受影响
        expect(saved.uiScale).toBe(1.1);
    });

    it('clamps volumes to 0..1 and sanitizes invalid audio payloads', async () => {
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({
            audio: { enabled: 'yes', sfxVolume: 9, bgmVolume: -1, voiceVolume: Number.NaN, reduceIntensity: 1 },
        }));

        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        expect(store.audioEnabled).toBe(true);
        expect(store.sfxVolume).toBe(1);
        expect(store.bgmVolume).toBe(0);
        expect(store.voiceVolume).toBe(1);
        expect(store.reduceAudioIntensity).toBe(false);

        store.setSfxVolume(2);
        store.setVoiceVolume(-5);
        const saved = JSON.parse(storage.get(SETTINGS_STORAGE_KEY) || '{}');
        expect(saved.audio.sfxVolume).toBe(1);
        expect(saved.audio.voiceVolume).toBe(0);
    });

    it('audio getter returns a copy (mutating it does not corrupt store state)', async () => {
        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        const snapshot = store.audio;
        snapshot.sfxVolume = 0.01;
        expect(store.sfxVolume).toBe(0.8);
    });
});
