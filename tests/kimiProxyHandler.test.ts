import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/llm/kimi/messages';

describe('Kimi proxy handler', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        delete process.env.KIMI_API_KEY;

        fetchMock.mockResolvedValue({
            status: 200,
            text: async () => JSON.stringify({ ok: true }),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        delete process.env.KIMI_API_KEY;
    });

    it('forwards the client provided Kimi key when no server key is configured', async () => {
        const req = {
            method: 'POST',
            headers: {
                'x-api-key': 'client-kimi-key',
            },
            body: {
                model: 'kimi-k2-thinking',
                max_tokens: 88,
                messages: [{ role: 'user', content: 'ping' }],
            },
        };

        const res = createMockRes();

        await handler(req, res);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const options = fetchMock.mock.calls[0]?.[1];
        expect(options?.headers?.['x-api-key']).toBe('client-kimi-key');
        expect(JSON.parse(options?.body)).toMatchObject({
            model: 'kimi-k2-thinking',
            max_tokens: 88,
        });
        expect(res.statusCode).toBe(200);
    });
});

function createMockRes() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.body = payload;
            return this;
        },
        setHeader(name: string, value: string) {
            this.headers[name] = value;
            return this;
        },
        send(payload: unknown) {
            this.body = payload;
            return this;
        },
    };
}
