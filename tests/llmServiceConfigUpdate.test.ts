import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMService } from '../src/llm/LLMService';

describe('LLMService config update', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const rawBody = typeof init?.body === 'string' ? init.body : '{}';
      const body = JSON.parse(rawBody) as { model?: string };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `model:${body.model || ''}` } }],
        }),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('clears cache when model changes so subsequent queries use the new model', async () => {
    const service = new LLMService({
      provider: 'custom',
      apiKey: 'test-key',
      model: 'model-a',
      baseUrl: 'https://example.com/v1/chat/completions',
      maxTokens: 64,
      temperature: 0.4,
      timeout: 5000,
      cacheEnabled: true,
    });

    const first = await service.query('same prompt');
    expect(first).toBe('model:model-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.updateConfig({ model: 'model-b' });

    const second = await service.query('same prompt');
    expect(second).toBe('model:model-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { model: string };
    expect(secondBody.model).toBe('model-b');
  });
});

