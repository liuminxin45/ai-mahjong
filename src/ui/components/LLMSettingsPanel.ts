import { llmService } from '../../llm';
import type { LLMConfig } from '../../llm/types';
import {
  getDefaultBrowserLLMPreset,
  getEffectiveLLMConfig,
  persistLLMConfig,
} from '../../llm/browserConfig';
import { getAiText } from '../aiLocale';
import {
  createPixelButton,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

export function renderLLMSettingsPanel(onClose?: () => void): HTMLElement {
  const text = getAiText().llmSettings;
  const surface = createPixelModalSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(94vw, 520px)',
    onClose,
  });

  const preset = getDefaultBrowserLLMPreset();
  const currentConfig = {
    ...llmService.getConfig(),
    ...getEffectiveLLMConfig(),
  };

  const provider = document.createElement('select');
  provider.className = 'pixel-select';
  for (const item of [
    { value: 'custom', label: text.providerLabels.openaiCompatible },
    { value: 'openai', label: text.providerLabels.openai },
    { value: 'anthropic', label: text.providerLabels.anthropic },
    { value: 'deepseek', label: text.providerLabels.deepseek },
    { value: 'local', label: text.providerLabels.local },
  ]) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.selected = currentConfig.provider === item.value;
    provider.appendChild(option);
  }

  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.className = 'pixel-input';
  modelInput.value = currentConfig.model;

  provider.onchange = () => {
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      deepseek: 'deepseek-chat',
      custom: preset.model || 'kimi-for-coding',
      local: '',
    };
    if (defaultModels[provider.value] !== undefined) {
      modelInput.value = defaultModels[provider.value];
    }
    if (provider.value === 'custom') {
      baseUrlInput.value = preset.baseUrl || '';
      maxTokensInput.value = String(preset.maxTokens ?? 32768);
      contextWindowInput.value = String(preset.contextWindow ?? 262144);
    } else if (provider.value === 'openai') {
      baseUrlInput.value = 'https://api.openai.com/v1/chat/completions';
    } else if (provider.value === 'deepseek') {
      baseUrlInput.value = 'https://api.deepseek.com/v1/chat/completions';
      maxTokensInput.value = '4096';
    } else if (provider.value === 'anthropic') {
      baseUrlInput.value = 'https://api.anthropic.com/v1/messages';
      maxTokensInput.value = '4096';
    } else if (provider.value === 'local') {
      baseUrlInput.value = '';
    }
  };

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.className = 'pixel-input';
  apiKeyInput.placeholder = text.apiKey;
  apiKeyInput.value = currentConfig.apiKey || '';

  const baseUrlInput = document.createElement('input');
  baseUrlInput.type = 'text';
  baseUrlInput.className = 'pixel-input';
  baseUrlInput.placeholder = text.entrypoint;
  baseUrlInput.value = currentConfig.baseUrl || '';

  const maxTokensInput = document.createElement('input');
  maxTokensInput.type = 'number';
  maxTokensInput.className = 'pixel-input';
  maxTokensInput.min = '1';
  maxTokensInput.step = '1';
  maxTokensInput.value = String(currentConfig.maxTokens ?? preset.maxTokens ?? 32768);

  const contextWindowInput = document.createElement('input');
  contextWindowInput.type = 'number';
  contextWindowInput.className = 'pixel-input';
  contextWindowInput.min = '1';
  contextWindowInput.step = '1';
  contextWindowInput.value = String(currentConfig.contextWindow ?? preset.contextWindow ?? 262144);

  const temperature = document.createElement('input');
  temperature.type = 'range';
  temperature.min = '0';
  temperature.max = '1';
  temperature.step = '0.1';
  temperature.value = String(currentConfig.temperature);
  temperature.className = 'pixel-range';

  const tempValue = document.createElement('span');
  tempValue.className = 'pixel-kv__value';
  tempValue.textContent = temperature.value;
  temperature.oninput = () => {
    tempValue.textContent = temperature.value;
  };

  surface.body.appendChild(createSection(text.provider, provider));
  surface.body.appendChild(createSection(text.apiKey, apiKeyInput));
  surface.body.appendChild(createSection(text.model, modelInput));
  surface.body.appendChild(createSection(text.entrypoint, baseUrlInput));
  surface.body.appendChild(createSection(text.maxOutputTokens, maxTokensInput));
  surface.body.appendChild(createSection(text.contextWindow, contextWindowInput));

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
  surface.body.appendChild(tempSection);

  const tips = document.createElement('div');
  tips.className = 'pixel-note-box pixel-note-box--accent';
  tips.innerHTML = `
    <div class="pixel-page-section__title" style="font-size:11px;">${text.notesTitle}</div>
    <div class="pixel-note" style="margin-top:8px;">
      ${text.notesBody}
    </div>
  `;
  surface.body.appendChild(tips);

  const cancel = createPixelButton(text.cancel, 'neutral');
  cancel.onclick = () => surface.close();
  const save = createPixelButton(text.save, 'success');
  save.onclick = () => {
    persistLLMConfig({
      provider: provider.value as LLMConfig['provider'],
      apiKey: apiKeyInput.value || undefined,
      model: modelInput.value,
      baseUrl: baseUrlInput.value || undefined,
      maxTokens: parseInt(maxTokensInput.value, 10) || (preset.maxTokens ?? 32768),
      contextWindow: parseInt(contextWindowInput.value, 10) || (preset.contextWindow ?? 262144),
      temperature: parseFloat(temperature.value),
    });
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
