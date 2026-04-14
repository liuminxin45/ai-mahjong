import type { LLMConfig } from './types';
import { llmService } from './LLMService';

export const LLM_CONFIG_STORAGE_KEY = 'ai-mahjong:llm-config';

const DEFAULT_BROWSER_LLM_PRESET: Partial<LLMConfig> = {
  provider: 'custom',
  model: 'kimi-for-coding',
  baseUrl: 'https://api.kimi.com/coding/v1',
  maxTokens: 32768,
  contextWindow: 262144,
  temperature: 0.4,
  timeout: 60000,
};

function readEnvString(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readEnvNumber(name: string): number | undefined {
  const value = readEnvString(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function loadStoredLLMConfig(): Partial<LLMConfig> {
  try {
    const saved = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    return saved ? JSON.parse(saved) as Partial<LLMConfig> : {};
  } catch {
    return {};
  }
}

export function readEnvLLMConfig(): Partial<LLMConfig> {
  return {
    provider: (readEnvString('VITE_LLM_PROVIDER') as LLMConfig['provider'] | undefined),
    apiKey: readEnvString('VITE_LLM_API_KEY'),
    model: readEnvString('VITE_LLM_MODEL'),
    baseUrl: readEnvString('VITE_LLM_BASE_URL'),
    maxTokens: readEnvNumber('VITE_LLM_MAX_TOKENS'),
    contextWindow: readEnvNumber('VITE_LLM_CONTEXT_WINDOW'),
    temperature: readEnvNumber('VITE_LLM_TEMPERATURE'),
    timeout: readEnvNumber('VITE_LLM_TIMEOUT_MS'),
  };
}

export function getDefaultBrowserLLMPreset(): Partial<LLMConfig> {
  return { ...DEFAULT_BROWSER_LLM_PRESET };
}

export function getEffectiveLLMConfig(): Partial<LLMConfig> {
  return {
    ...DEFAULT_BROWSER_LLM_PRESET,
    ...readEnvLLMConfig(),
    ...loadStoredLLMConfig(),
  };
}

export function syncLegacyLLMStorage(config: Partial<LLMConfig>): void {
  const endpoint = config.baseUrl?.trim();
  const apiKey = config.apiKey?.trim();
  const model = config.model?.trim();

  if (endpoint) localStorage.setItem('LLM_ENDPOINT', endpoint);
  else localStorage.removeItem('LLM_ENDPOINT');

  if (apiKey) localStorage.setItem('LLM_API_KEY', apiKey);
  else localStorage.removeItem('LLM_API_KEY');

  if (model) localStorage.setItem('LLM_MODEL', model);
  else localStorage.removeItem('LLM_MODEL');
}

export function persistLLMConfig(config: Partial<LLMConfig>): Partial<LLMConfig> {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  syncLegacyLLMStorage(config);
  llmService.updateConfig(config);
  window.dispatchEvent(new CustomEvent('llm-config-changed'));
  return config;
}

export function initLLMConfig(): Partial<LLMConfig> {
  const config = getEffectiveLLMConfig();
  syncLegacyLLMStorage(config);
  llmService.updateConfig(config);
  return config;
}
