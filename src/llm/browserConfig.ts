import { llmService } from './LLMService';
import type { LLMConfig, LLMProfile, LLMProfileKind, LLMProfileStore } from './types';

export const LLM_CONFIG_STORAGE_KEY = 'ai-mahjong:llm-config';

function createId(): string {
  return `llm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultProfile(kind: LLMProfileKind): LLMProfile {
  if (kind === 'kimi_coding_anthropic') {
    return {
      id: createId(),
      name: 'Kimi Coding',
      kind,
      apiKey: '',
      model: 'kimi-k2-thinking',
      baseUrl: 'https://api.kimi.com/coding/v1/messages',
      maxTokens: 1024,
      contextWindow: 262144,
      temperature: 0.4,
      timeout: 60000,
    };
  }

  return {
    id: createId(),
    name: 'OpenAI Compatible',
    kind,
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    maxTokens: 4096,
    contextWindow: 128000,
    temperature: 0.4,
    timeout: 60000,
  };
}

function buildDefaultStore(): LLMProfileStore {
  const defaultProfile = createDefaultProfile('kimi_coding_anthropic');
  return {
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
  };
}

function sanitizeProfile(profile: LLMProfile): LLMProfile {
  return {
    ...profile,
    name: profile.name.trim() || 'Untitled Model',
    apiKey: profile.apiKey?.trim() || '',
    model: profile.model.trim(),
    baseUrl: profile.baseUrl.trim(),
    maxTokens: Number.isFinite(profile.maxTokens) ? profile.maxTokens : 1024,
    contextWindow: Number.isFinite(profile.contextWindow) ? profile.contextWindow : undefined,
    temperature: Number.isFinite(profile.temperature) ? profile.temperature : 0.4,
    timeout: Number.isFinite(profile.timeout) ? profile.timeout : 60000,
  };
}

function normalizeStore(store: Partial<LLMProfileStore> | undefined): LLMProfileStore {
  const fallback = buildDefaultStore();
  const rawProfiles = Array.isArray(store?.profiles) ? store!.profiles : fallback.profiles;
  const profiles = rawProfiles
    .filter((profile): profile is LLMProfile => !!profile && typeof profile.id === 'string')
    .map((profile) => sanitizeProfile(profile));

  if (profiles.length === 0) {
    return fallback;
  }

  const activeProfileId = profiles.some((profile) => profile.id === store?.activeProfileId)
    ? store?.activeProfileId
    : profiles[0].id;

  return {
    profiles,
    activeProfileId,
  };
}

function mapProfileToLLMConfig(profile: LLMProfile): Partial<LLMConfig> {
  if (profile.kind === 'kimi_coding_anthropic') {
    return {
      provider: 'anthropic',
      apiKey: profile.apiKey,
      model: profile.model,
      baseUrl: profile.baseUrl,
      maxTokens: profile.maxTokens,
      contextWindow: profile.contextWindow,
      temperature: profile.temperature,
      timeout: profile.timeout,
    };
  }

  return {
    provider: 'custom',
    apiKey: profile.apiKey,
    model: profile.model,
    baseUrl: profile.baseUrl,
    maxTokens: profile.maxTokens,
    contextWindow: profile.contextWindow,
    temperature: profile.temperature,
    timeout: profile.timeout,
  };
}

function syncLegacyLLMStorageFromProfile(profile?: LLMProfile): void {
  if (!profile) {
    localStorage.removeItem('LLM_ENDPOINT');
    localStorage.removeItem('LLM_API_KEY');
    localStorage.removeItem('LLM_MODEL');
    return;
  }

  localStorage.setItem('LLM_ENDPOINT', profile.baseUrl);
  if (profile.apiKey) localStorage.setItem('LLM_API_KEY', profile.apiKey);
  else localStorage.removeItem('LLM_API_KEY');
  localStorage.setItem('LLM_MODEL', profile.model);
}

export function loadStoredLLMStore(): LLMProfileStore {
  try {
    const saved = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    if (!saved) return buildDefaultStore();
    return normalizeStore(JSON.parse(saved) as Partial<LLMProfileStore>);
  } catch {
    return buildDefaultStore();
  }
}

export function getLLMProfiles(): LLMProfile[] {
  return loadStoredLLMStore().profiles;
}

export function getActiveLLMProfile(): LLMProfile | undefined {
  const store = loadStoredLLMStore();
  return store.profiles.find((profile) => profile.id === store.activeProfileId);
}

export function getDefaultBrowserLLMPreset(kind: LLMProfileKind = 'kimi_coding_anthropic'): LLMProfile {
  return createDefaultProfile(kind);
}

export function getEffectiveLLMConfig(): Partial<LLMConfig> {
  const active = getActiveLLMProfile();
  return active ? mapProfileToLLMConfig(active) : {};
}

export function persistLLMStore(store: LLMProfileStore): LLMProfileStore {
  const normalized = normalizeStore(store);
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(normalized));

  const active = normalized.profiles.find((profile) => profile.id === normalized.activeProfileId);
  syncLegacyLLMStorageFromProfile(active);
  llmService.updateConfig(active ? mapProfileToLLMConfig(active) : {});
  window.dispatchEvent(new CustomEvent('llm-config-changed'));

  return normalized;
}

export function persistLLMConfig(config: Partial<LLMConfig>): Partial<LLMConfig> {
  const store = loadStoredLLMStore();
  const activeId = store.activeProfileId ?? store.profiles[0]?.id;
  const profiles = store.profiles.map((profile) => {
    if (profile.id !== activeId) return profile;
    return sanitizeProfile({
      ...profile,
      apiKey: config.apiKey,
      model: config.model ?? profile.model,
      baseUrl: config.baseUrl ?? profile.baseUrl,
      maxTokens: config.maxTokens ?? profile.maxTokens,
      contextWindow: config.contextWindow ?? profile.contextWindow,
      temperature: config.temperature ?? profile.temperature,
      timeout: config.timeout ?? profile.timeout,
    });
  });
  persistLLMStore({ profiles, activeProfileId: activeId });
  return getEffectiveLLMConfig();
}

export function initLLMConfig(): Partial<LLMConfig> {
  const active = getActiveLLMProfile();
  syncLegacyLLMStorageFromProfile(active);
  llmService.updateConfig(active ? mapProfileToLLMConfig(active) : {});
  return active ? mapProfileToLLMConfig(active) : {};
}
