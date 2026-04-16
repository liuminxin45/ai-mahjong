import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMService } from '../src/llm/LLMService';

describe('LLMService proxy routing', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('window', {
            location: {
                origin: 'https://ai-mahjong.vercel.app',
                hostname: 'ai-mahjong.vercel.app',
                protocol: 'https:',
            },
        });

        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [{ text: '{"ok":true}' }],
            }),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('routes Kimi anthropic requests through the same-origin proxy in production', async () => {
        const service = new LLMService({
            provider: 'anthropic',
            apiKey: 'test-key',
            model: 'kimi-k2-thinking',
            baseUrl: 'https://api.kimi.com/coding/v1/messages',
            maxTokens: 64,
            temperature: 0.4,
            timeout: 5000,
            cacheEnabled: false,
        });

        await service.query('ping', { useCache: false });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ai-mahjong.vercel.app/api/llm/kimi/messages');
    });
});
