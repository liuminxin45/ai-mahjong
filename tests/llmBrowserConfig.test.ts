import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    LLM_CONFIG_STORAGE_KEY,
    createDefaultProfile,
    loadStoredLLMStore,
} from '../src/llm/browserConfig';

describe('browserConfig Kimi defaults', () => {
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
        vi.stubGlobal('localStorage', localStorageMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('backfills Kimi preset fields while preserving the API key', () => {
        storage.set(
            LLM_CONFIG_STORAGE_KEY,
            JSON.stringify({
                profiles: [
                    {
                        id: 'kimi-1',
                        name: 'My Kimi',
                        kind: 'kimi_coding_anthropic',
                        apiKey: 'secret-key',
                        model: '',
                        baseUrl: '',
                    },
                ],
                activeProfileId: 'kimi-1',
            }),
        );

        const preset = createDefaultProfile('kimi_coding_anthropic');
        const profile = loadStoredLLMStore().profiles[0];

        expect(profile.name).toBe('My Kimi');
        expect(profile.apiKey).toBe('secret-key');
        expect(profile.model).toBe(preset.model);
        expect(profile.baseUrl).toBe(preset.baseUrl);
        expect(profile.maxTokens).toBe(preset.maxTokens);
        expect(profile.contextWindow).toBe(preset.contextWindow);
        expect(profile.temperature).toBe(preset.temperature);
        expect(profile.timeout).toBe(preset.timeout);
    });
});
