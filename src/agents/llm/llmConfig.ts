export type LlmConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export function readLlmConfig(): LlmConfig {
  const provider = import.meta.env.VITE_LLM_PROVIDER || 'openai';
  const baseUrl = import.meta.env.VITE_LLM_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = import.meta.env.VITE_LLM_API_KEY || '';
  const model = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini';
  const timeoutMs = parseInt(import.meta.env.VITE_LLM_TIMEOUT_MS || '12000', 10);

  return {
    provider,
    baseUrl,
    apiKey,
    model,
    timeoutMs,
  };
}
