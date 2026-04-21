export type LlmConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export function readLlmConfig(): LlmConfig {
  const provider = 'custom';
  const baseUrl = '/api/llm/kimi/messages';
  const apiKey = '';
  const model = 'kimi-k2';
  const timeoutMs = 12000;

  return {
    provider,
    baseUrl,
    apiKey,
    model,
    timeoutMs,
  };
}
