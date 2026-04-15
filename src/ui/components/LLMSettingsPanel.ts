import {
  createDefaultProfile,
  getActiveLLMProfile,
  getLLMProfiles,
  persistLLMStore,
} from '../../llm/browserConfig';
import type { LLMProfile, LLMProfileKind, LLMProfileStore } from '../../llm/types';
import { getAiText } from '../aiLocale';
import {
  createPixelButton,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

function normalizeOpenAICompatibleUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function normalizeAnthropicUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/messages')) return trimmed;
  return `${trimmed}/messages`;
}

function isLocalBrowserDev(): boolean {
  const { hostname, protocol } = window.location;
  return protocol.startsWith('http') && (hostname === 'localhost' || hostname === '127.0.0.1');
}

function mapProfileUrlForLocalDev(profile: LLMProfile, url: string): string {
  if (!isLocalBrowserDev()) return url;
  if (url.startsWith('/')) return url;

  try {
    const parsed = new URL(url);
    const origin = window.location.origin;

    if (profile.kind === 'kimi_coding_anthropic' && parsed.hostname === 'api.kimi.com') {
      return `${origin}/api/llm/kimi/messages`;
    }

    if (profile.kind === 'openai_compatible' && parsed.hostname === 'api.openai.com') {
      return `${origin}/api/llm/openai/chat/completions`;
    }
  } catch {
    return url;
  }

  return url;
}

async function testProfileConnection(profile: LLMProfile): Promise<void> {
  if (!profile.apiKey?.trim()) {
    throw new Error('API key missing');
  }

  let url = profile.baseUrl.trim();
  let headers: Record<string, string>;
  let body: string;

  if (profile.kind === 'kimi_coding_anthropic') {
    url = normalizeAnthropicUrl(url);
    url = mapProfileUrlForLocalDev(profile, url);
    headers = {
      'content-type': 'application/json',
      'x-api-key': profile.apiKey.trim(),
      'anthropic-version': '2023-06-01',
    };
    body = JSON.stringify({
      model: profile.model.trim(),
      max_tokens: Math.max(32, Math.min(profile.maxTokens, 256)),
      messages: [{ role: 'user', content: 'ping' }],
    });
  } else {
    url = normalizeOpenAICompatibleUrl(url);
    url = mapProfileUrlForLocalDev(profile, url);
    headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${profile.apiKey.trim()}`,
    };
    body = JSON.stringify({
      model: profile.model.trim(),
      max_tokens: Math.max(16, Math.min(profile.maxTokens, 128)),
      messages: [{ role: 'user', content: 'ping' }],
      temperature: profile.temperature,
    });
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), Math.max(3000, profile.timeout));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function cloneProfile(profile: LLMProfile): LLMProfile {
  return { ...profile };
}

export function renderLLMSettingsPanel(onClose?: () => void): HTMLElement {
  const text = getAiText().llmSettings;
  const surface = createPixelModalSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(96vw, 720px)',
    onClose,
  });

  let store: LLMProfileStore = {
    profiles: getLLMProfiles().map(cloneProfile),
    activeProfileId: getActiveLLMProfile()?.id,
  };
  let selectedProfileId = store.activeProfileId || store.profiles[0]?.id;

  const profileSection = document.createElement('section');
  profileSection.className = 'pixel-page-section';
  const editorSection = document.createElement('section');
  editorSection.className = 'pixel-page-section';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'pixel-input';

  const kindInput = document.createElement('select');
  kindInput.className = 'pixel-select';
  for (const item of [
    { value: 'kimi_coding_anthropic', label: text.providerLabels.kimiCodingAnthropic },
    { value: 'openai_compatible', label: text.providerLabels.openaiCompatible },
  ]) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    kindInput.appendChild(option);
  }

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.className = 'pixel-input';
  apiKeyInput.placeholder = text.apiKey;

  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.className = 'pixel-input';

  const baseUrlInput = document.createElement('input');
  baseUrlInput.type = 'text';
  baseUrlInput.className = 'pixel-input';

  const maxTokensInput = document.createElement('input');
  maxTokensInput.type = 'number';
  maxTokensInput.className = 'pixel-input';
  maxTokensInput.min = '1';
  maxTokensInput.step = '1';

  const contextWindowInput = document.createElement('input');
  contextWindowInput.type = 'number';
  contextWindowInput.className = 'pixel-input';
  contextWindowInput.min = '1';
  contextWindowInput.step = '1';

  const timeoutInput = document.createElement('input');
  timeoutInput.type = 'number';
  timeoutInput.className = 'pixel-input';
  timeoutInput.min = '1000';
  timeoutInput.step = '1000';

  const temperature = document.createElement('input');
  temperature.type = 'range';
  temperature.min = '0';
  temperature.max = '1';
  temperature.step = '0.1';
  temperature.className = 'pixel-range';

  const tempValue = document.createElement('span');
  tempValue.className = 'pixel-kv__value';
  const testConnectionButton = createPixelButton(text.testConnection, 'neutral');

  function getSelectedProfile(): LLMProfile | undefined {
    return store.profiles.find((profile) => profile.id === selectedProfileId);
  }

  function applyKindDefaults(profile: LLMProfile, kind: LLMProfileKind): LLMProfile {
    const preset = createDefaultProfile(kind);
    return {
      ...profile,
      kind,
      model: preset.model,
      baseUrl: preset.baseUrl,
      maxTokens: preset.maxTokens,
      contextWindow: preset.contextWindow,
      temperature: preset.temperature,
      timeout: preset.timeout,
    };
  }

  function syncFormFromProfile(profile: LLMProfile): void {
    nameInput.value = profile.name;
    kindInput.value = profile.kind;
    apiKeyInput.value = profile.apiKey || '';
    modelInput.value = profile.model;
    baseUrlInput.value = profile.baseUrl;
    maxTokensInput.value = String(profile.maxTokens);
    contextWindowInput.value = String(profile.contextWindow ?? '');
    timeoutInput.value = String(profile.timeout);
    temperature.value = String(profile.temperature);
    tempValue.textContent = temperature.value;
  }

  function syncProfileFromForm(): void {
    const profile = getSelectedProfile();
    if (!profile) return;

    profile.name = nameInput.value.trim() || profile.name;
    profile.kind = kindInput.value as LLMProfileKind;
    profile.apiKey = apiKeyInput.value.trim();
    profile.model = modelInput.value.trim();
    profile.baseUrl = baseUrlInput.value.trim();
    profile.maxTokens = parseInt(maxTokensInput.value, 10) || profile.maxTokens;
    profile.contextWindow = parseInt(contextWindowInput.value, 10) || undefined;
    profile.timeout = parseInt(timeoutInput.value, 10) || profile.timeout;
    profile.temperature = parseFloat(temperature.value);
  }

  function renderProfileList(): void {
    profileSection.innerHTML = `
      <div class="pixel-page-section__header">
        <div class="pixel-page-section__title">${text.profiles}</div>
        <div class="pixel-page-section__subtitle">${text.active}</div>
      </div>
    `;
    const body = document.createElement('div');
    body.className = 'pixel-page-section__body';

    if (store.profiles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pixel-note';
      empty.textContent = text.noProfiles;
      body.appendChild(empty);
    } else {
      for (const profile of store.profiles) {
        const row = document.createElement('div');
        row.className = 'pixel-kv__row';
        row.style.alignItems = 'flex-start';
        row.style.gap = '10px';

        const info = document.createElement('div');
        info.style.flex = '1';
        info.style.cursor = 'pointer';
        info.onclick = () => {
          syncProfileFromForm();
          selectedProfileId = profile.id;
          syncFormFromProfile(profile);
          renderProfileList();
        };

        const title = document.createElement('div');
        title.className = 'pixel-kv__label';
        title.textContent = profile.name;
        info.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'pixel-note';
        meta.textContent = profile.kind === 'kimi_coding_anthropic'
          ? text.providerLabels.kimiCodingAnthropic
          : text.providerLabels.openaiCompatible;
        info.appendChild(meta);

        const status = document.createElement('div');
        status.className = 'pixel-note';
        status.textContent = profile.apiKey?.trim() ? text.apiKeyReady : text.apiKeyMissing;
        info.appendChild(status);

        row.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'pixel-btn-row';

        if (store.activeProfileId === profile.id) {
          const badge = document.createElement('span');
          badge.className = 'pixel-seat__badge pixel-seat__badge--accent';
          badge.textContent = text.activeBadge;
          actions.appendChild(badge);
        } else {
          const activate = createPixelButton(text.activate, 'success');
          activate.onclick = () => {
            syncProfileFromForm();
            store.activeProfileId = profile.id;
            persistLLMStore(store);
            createPixelToast(text.savedToast);
            renderProfileList();
          };
          actions.appendChild(activate);
        }

        const del = createPixelButton(text.delete, 'danger');
        del.onclick = () => {
          if (store.profiles.length <= 1) return;
          store.profiles = store.profiles.filter((item) => item.id !== profile.id);
          if (store.activeProfileId === profile.id) {
            store.activeProfileId = store.profiles[0]?.id;
          }
          if (selectedProfileId === profile.id) {
            selectedProfileId = store.profiles[0]?.id;
            if (selectedProfileId) {
              const selected = getSelectedProfile();
              if (selected) syncFormFromProfile(selected);
            }
          }
          persistLLMStore(store);
          createPixelToast(text.deletedToast);
          renderProfileList();
        };
        del.disabled = store.profiles.length <= 1;
        actions.appendChild(del);

        row.appendChild(actions);
        body.appendChild(row);
      }
    }

    const addRow = document.createElement('div');
    addRow.className = 'pixel-btn-row';

    const addKimi = createPixelButton(text.addKimi, 'neutral');
    addKimi.onclick = () => {
      syncProfileFromForm();
      const profile = createDefaultProfile('kimi_coding_anthropic');
      store.profiles.push(profile);
      selectedProfileId = profile.id;
      syncFormFromProfile(profile);
      renderProfileList();
    };

    const addOpenAI = createPixelButton(text.addOpenAICompatible, 'neutral');
    addOpenAI.onclick = () => {
      syncProfileFromForm();
      const profile = createDefaultProfile('openai_compatible');
      store.profiles.push(profile);
      selectedProfileId = profile.id;
      syncFormFromProfile(profile);
      renderProfileList();
    };

    addRow.appendChild(addKimi);
    addRow.appendChild(addOpenAI);
    body.appendChild(addRow);
    profileSection.appendChild(body);
  }

  function renderEditor(): void {
    editorSection.innerHTML = `
      <div class="pixel-page-section__header">
        <div class="pixel-page-section__title">${text.model}</div>
        <div class="pixel-page-section__subtitle">${text.subtitle}</div>
      </div>
    `;
    const body = document.createElement('div');
    body.className = 'pixel-page-section__body';

    body.appendChild(createSection(text.name, nameInput));
    body.appendChild(createSection(text.kind, kindInput));
    body.appendChild(createSection(text.apiKey, apiKeyInput));
    body.appendChild(createSection(text.model, modelInput));
    body.appendChild(createSection(text.entrypoint, baseUrlInput));
    body.appendChild(createSection(text.maxOutputTokens, maxTokensInput));
    body.appendChild(createSection(text.contextWindow, contextWindowInput));
    body.appendChild(createSection('Timeout (ms)', timeoutInput));

    const actionRow = document.createElement('div');
    actionRow.className = 'pixel-btn-row';
    actionRow.appendChild(testConnectionButton);
    body.appendChild(actionRow);

    const tempSection = document.createElement('section');
    tempSection.className = 'pixel-page-section';
    tempSection.innerHTML = `
      <div class="pixel-page-section__header">
        <div class="pixel-page-section__title">${text.temperature}</div>
        <div class="pixel-page-section__subtitle">${text.creativity}</div>
      </div>
    `;
    const tempBody = document.createElement('div');
    tempBody.className = 'pixel-page-section__body';
    const row = document.createElement('div');
    row.className = 'pixel-field__inline';
    row.appendChild(temperature);
    row.appendChild(tempValue);
    tempBody.appendChild(row);
    tempSection.appendChild(tempBody);
    body.appendChild(tempSection);

    const tips = document.createElement('div');
    tips.className = 'pixel-note-box pixel-note-box--accent';
    tips.innerHTML = `
      <div class="pixel-page-section__title" style="font-size:11px;">${text.notesTitle}</div>
      <div class="pixel-note" style="margin-top:8px;">${text.notesBody}</div>
    `;
    body.appendChild(tips);

    editorSection.appendChild(body);
  }

  kindInput.onchange = () => {
    const profile = getSelectedProfile();
    if (!profile) return;
    const next = applyKindDefaults(profile, kindInput.value as LLMProfileKind);
    Object.assign(profile, next);
    syncFormFromProfile(profile);
    renderProfileList();
  };

  temperature.oninput = () => {
    tempValue.textContent = temperature.value;
  };

  testConnectionButton.onclick = async () => {
    syncProfileFromForm();
    const profile = getSelectedProfile();
    if (!profile) return;

    const originalLabel = testConnectionButton.textContent || text.testConnection;
    testConnectionButton.disabled = true;
    testConnectionButton.textContent = text.testing;

    try {
      await testProfileConnection(profile);
      createPixelToast(text.connectionOkToast);
      renderProfileList();
    } catch (error: any) {
      createPixelToast(`${text.connectionFailedToast}: ${error?.message || 'Unknown error'}`);
    } finally {
      testConnectionButton.disabled = false;
      testConnectionButton.textContent = originalLabel;
    }
  };

  renderEditor();

  if (selectedProfileId) {
    const selected = getSelectedProfile();
    if (selected) syncFormFromProfile(selected);
  }

  renderProfileList();

  surface.body.appendChild(profileSection);
  surface.body.appendChild(editorSection);

  const cancel = createPixelButton(text.cancel, 'neutral');
  cancel.onclick = () => surface.close();

  const save = createPixelButton(text.save, 'success');
  save.onclick = () => {
    syncProfileFromForm();
    if (!store.activeProfileId && store.profiles[0]) {
      store.activeProfileId = store.profiles[0].id;
    }
    persistLLMStore(store);
    createPixelToast(text.savedToast);
    surface.close();
  };

  surface.footer.appendChild(cancel);
  surface.footer.appendChild(save);
  mountPixelSurface(surface);
  return surface.panel;
}

function createSection(label: string, control: HTMLElement, subtitle?: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${label}</div>
      ${subtitle ? `<div class="pixel-page-section__subtitle">${subtitle}</div>` : ''}
    </div>
  `;
  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';
  body.appendChild(control);
  section.appendChild(body);
  return section;
}

export function renderLLMSettingsButton(): HTMLElement {
  const btn = createPixelButton(getAiText().settings.llmSettings, 'neutral');
  btn.onclick = () => renderLLMSettingsPanel();
  return btn;
}
