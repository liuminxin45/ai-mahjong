import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SETTINGS_STORAGE_KEY = 'ai-mahjong:settings';

describe('settingsStore persistence', () => {
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

    it('loads saved settings and persists subsequent changes', async () => {
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({
            ruleId: 'placeholder',
            llmEnabled: false,
            timeoutMs: 45000,
            p0IsAI: true,
            trainingGames: 222,
            trainingBlocking: true,
            trainingVerbose: true,
            uiScale: 1.2,
            hudSafeZonePercent: 6,
        }));

        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        expect(store.ruleId).toBe('placeholder');
        expect(store.llmEnabled).toBe(false);
        expect(store.timeoutMs).toBe(45000);
        expect(store.p0IsAI).toBe(true);
        expect(store.trainingGames).toBe(222);
        expect(store.trainingBlocking).toBe(true);
        expect(store.trainingVerbose).toBe(true);
        expect(store.uiScale).toBe(1.2);
        expect(store.hudSafeZonePercent).toBe(6);

        store.setUiMode('DEBUG');
        store.setTrainingGames(333);
        store.setTrainingBlocking(false);
        store.setTrainingVerbose(false);
        store.setUiScale(1.3);
        store.setHudSafeZonePercent(7);

        const saved = JSON.parse(storage.get(SETTINGS_STORAGE_KEY) || '{}');
        expect(saved.uiMode).toBe('DEBUG');
        expect(saved.trainingGames).toBe(333);
        expect(saved.trainingBlocking).toBe(false);
        expect(saved.trainingVerbose).toBe(false);
        expect(saved.uiScale).toBe(1.3);
        expect(saved.hudSafeZonePercent).toBe(7);
    });

    it('sanitizes display settings bounds', async () => {
        storage.set(SETTINGS_STORAGE_KEY, JSON.stringify({
            uiScale: 9,
            hudSafeZonePercent: -20,
        }));

        const mod = await import('../src/store/settingsStore');
        const store = mod.settingsStore;

        expect(store.uiScale).toBe(1.35);
        expect(store.hudSafeZonePercent).toBe(0);

        store.setUiScale(0.1);
        store.setHudSafeZonePercent(99);

        const saved = JSON.parse(storage.get(SETTINGS_STORAGE_KEY) || '{}');
        expect(saved.uiScale).toBe(0.85);
        expect(saved.hudSafeZonePercent).toBe(8);
    });
});
