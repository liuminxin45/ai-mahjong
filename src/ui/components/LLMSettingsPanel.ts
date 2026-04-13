import { llmService } from '../../llm';
import type { LLMConfig } from '../../llm/types';
import {
  createPixelButton,
  createPixelModalSurface,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

const STORAGE_KEY = 'ai-mahjong:llm-config';

function loadConfig(): Partial<LLMConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveConfig(config: Partial<LLMConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  llmService.updateConfig(config);
}

export function renderLLMSettingsPanel(onClose?: () => void): HTMLElement {
  const surface = createPixelModalSurface({
    title: 'LLM Settings',
    subtitle: 'PROVIDER / MODEL / API',
    width: 'min(94vw, 520px)',
    onClose,
  });

  const config = loadConfig();
  const currentConfig = llmService.getConfig();

  const provider = document.createElement('select');
  provider.className = 'pixel-select';
  for (const item of [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'custom', label: 'Custom API' },
    { value: 'local', label: 'Local Mode' },
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
  modelInput.value = config.model || currentConfig.model;

  provider.onchange = () => {
    config.provider = provider.value as LLMConfig['provider'];
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      deepseek: 'deepseek-chat',
      custom: '',
      local: '',
    };
    if (defaultModels[provider.value] !== undefined) {
      config.model = defaultModels[provider.value];
      modelInput.value = config.model;
    }
  };

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.className = 'pixel-input';
  apiKeyInput.placeholder = 'API KEY';
  apiKeyInput.value = config.apiKey || '';

  const baseUrlInput = document.createElement('input');
  baseUrlInput.type = 'text';
  baseUrlInput.className = 'pixel-input';
  baseUrlInput.placeholder = 'BASE URL';
  baseUrlInput.value = config.baseUrl || '';

  const temperature = document.createElement('input');
  temperature.type = 'range';
  temperature.min = '0';
  temperature.max = '1';
  temperature.step = '0.1';
  temperature.value = String(config.temperature ?? currentConfig.temperature);
  temperature.className = 'pixel-range';

  const tempValue = document.createElement('span');
  tempValue.className = 'pixel-kv__value';
  tempValue.textContent = temperature.value;
  temperature.oninput = () => {
    tempValue.textContent = temperature.value;
  };

  surface.body.appendChild(createSection('Provider', provider));
  surface.body.appendChild(createSection('API Key', apiKeyInput));
  surface.body.appendChild(createSection('Model', modelInput));
  surface.body.appendChild(createSection('Base URL', baseUrlInput, 'Optional'));

  const tempSection = document.createElement('section');
  tempSection.className = 'pixel-page-section';
  tempSection.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">TEMPERATURE</div>
      <div class="pixel-page-section__subtitle">CREATIVITY</div>
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
    <div class="pixel-page-section__title" style="font-size:11px;">NOTES</div>
    <div class="pixel-note" style="margin-top:8px;">
      API key stays in local storage only. Local Mode works without remote API. DeepSeek is cheaper but model quality varies by task.
    </div>
  `;
  surface.body.appendChild(tips);

  const cancel = createPixelButton('Cancel', 'neutral');
  cancel.onclick = () => surface.close();
  const save = createPixelButton('Save', 'success');
  save.onclick = () => {
    saveConfig({
      ...config,
      provider: provider.value as LLMConfig['provider'],
      apiKey: apiKeyInput.value || undefined,
      model: modelInput.value,
      baseUrl: baseUrlInput.value || undefined,
      temperature: parseFloat(temperature.value),
    });
    createPixelToast('SAVED');
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
  const btn = createPixelButton('LLM', 'neutral');
  btn.onclick = () => renderLLMSettingsPanel();
  return btn;
}

export function initLLMConfig(): void {
  const config = loadConfig();
  if (Object.keys(config).length > 0) {
    llmService.updateConfig(config);
  }
}
