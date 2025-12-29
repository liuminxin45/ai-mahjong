/**
 * LLM设置面板组件
 * 用于配置LLM API密钥和参数
 */

import { llmService } from '../../llm';
import type { LLMConfig } from '../../llm/types';

const STORAGE_KEY = 'ai-mahjong:llm-config';

/**
 * 从本地存储加载配置
 */
function loadConfig(): Partial<LLMConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * 保存配置到本地存储
 */
function saveConfig(config: Partial<LLMConfig>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  llmService.updateConfig(config);
}

/**
 * 渲染LLM设置面板
 */
export function renderLLMSettingsPanel(onClose?: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'llm-settings-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 450px;
    max-height: 80vh;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    overflow: hidden;
    z-index: 2000;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // 背景遮罩
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1999;
  `;
  overlay.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  // 头部
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  `;

  const title = document.createElement('div');
  title.innerHTML = '<div style="font-size: 18px; font-weight: 600;">⚙️ LLM设置</div>';

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
  `;
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // 内容
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 24px;
    max-height: calc(80vh - 100px);
    overflow-y: auto;
    overflow-x: hidden;
  `;

  const config = loadConfig();
  const currentConfig = llmService.getConfig();

  // Provider选择
  const providerGroup = createFormGroup('AI服务提供商', () => {
    const select = document.createElement('select');
    select.style.cssText = inputStyle;
    
    const providers = [
      { value: 'openai', label: 'OpenAI (GPT-4)' },
      { value: 'anthropic', label: 'Anthropic (Claude)' },
      { value: 'deepseek', label: 'DeepSeek' },
      { value: 'custom', label: '自定义API' },
      { value: 'local', label: '本地模式（无需API）' },
    ];
    
    for (const p of providers) {
      const option = document.createElement('option');
      option.value = p.value;
      option.textContent = p.label;
      option.selected = currentConfig.provider === p.value;
      select.appendChild(option);
    }
    
    select.onchange = () => {
      config.provider = select.value as any;
      // 根据provider更新默认model
      const defaultModels: Record<string, string> = {
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-haiku-20240307',
        deepseek: 'deepseek-chat',
        custom: '',
        local: '',
      };
      if (defaultModels[select.value]) {
        config.model = defaultModels[select.value];
        (modelInput as HTMLInputElement).value = config.model;
      }
    };
    
    return select;
  });
  content.appendChild(providerGroup);

  // API Key
  const apiKeyGroup = createFormGroup('API Key', () => {
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = '输入你的API密钥';
    input.value = config.apiKey || '';
    input.style.cssText = inputStyle;
    input.onchange = () => config.apiKey = input.value;
    
    // 显示/隐藏按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = '👁';
    toggleBtn.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
    `;
    toggleBtn.onclick = () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    };
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.appendChild(input);
    wrapper.appendChild(toggleBtn);
    return wrapper;
  });
  content.appendChild(apiKeyGroup);

  // Model
  let modelInput: HTMLElement;
  const modelGroup = createFormGroup('模型名称', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'gpt-4o-mini';
    input.value = config.model || currentConfig.model;
    input.style.cssText = inputStyle;
    input.onchange = () => config.model = input.value;
    modelInput = input;
    return input;
  });
  content.appendChild(modelGroup);

  // Base URL (可选)
  const urlGroup = createFormGroup('API地址（可选）', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '使用默认地址';
    input.value = config.baseUrl || '';
    input.style.cssText = inputStyle;
    input.onchange = () => config.baseUrl = input.value || undefined;
    return input;
  });
  content.appendChild(urlGroup);

  // Temperature
  const tempGroup = createFormGroup('创造性 (Temperature)', () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '12px';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.1';
    slider.value = String(config.temperature ?? currentConfig.temperature);
    slider.style.cssText = 'flex: 1;';
    
    const value = document.createElement('span');
    value.style.cssText = 'width: 40px; text-align: center; font-weight: 600;';
    value.textContent = slider.value;
    
    slider.oninput = () => {
      value.textContent = slider.value;
      config.temperature = parseFloat(slider.value);
    };
    
    container.appendChild(slider);
    container.appendChild(value);
    return container;
  });
  content.appendChild(tempGroup);

  // 提示信息
  const tips = document.createElement('div');
  tips.style.cssText = `
    margin-top: 16px;
    padding: 12px;
    background: #f0f7ff;
    border-radius: 8px;
    font-size: 12px;
    color: #1976d2;
    line-height: 1.6;
  `;
  tips.innerHTML = `
    <strong>💡 提示：</strong><br>
    • API密钥仅保存在本地浏览器中<br>
    • 选择"本地模式"可在无API时使用基础功能<br>
    • DeepSeek提供较便宜的API价格
  `;
  content.appendChild(tips);

  panel.appendChild(content);

  // 底部按钮
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    background: #f5f5f5;
    border-top: 1px solid #eee;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
  `;
  cancelBtn.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存设置';
  saveBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  `;
  saveBtn.onclick = () => {
    saveConfig(config);
    overlay.remove();
    panel.remove();
    onClose?.();
    
    // 显示保存成功提示
    showToast('设置已保存');
  };

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  panel.appendChild(footer);

  // 添加遮罩
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  return panel;
}

const inputStyle = `
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
`;

/**
 * 创建表单组
 */
function createFormGroup(
  label: string,
  inputFactory: () => HTMLElement
): HTMLElement {
  const group = document.createElement('div');
  group.style.marginBottom = '20px';

  const labelEl = document.createElement('label');
  labelEl.style.cssText = `
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #333;
  `;
  labelEl.textContent = label;

  group.appendChild(labelEl);
  group.appendChild(inputFactory());

  return group;
}

/**
 * 显示Toast提示
 */
function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 3000;
    animation: fadeInOut 2s ease-in-out;
  `;
  toast.textContent = message;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
      20% { opacity: 1; transform: translateX(-50%) translateY(0); }
      80% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
  `;

  document.body.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    style.remove();
  }, 2000);
}

/**
 * 渲染LLM设置按钮
 */
export function renderLLMSettingsButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = `
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  btn.innerHTML = '🤖 <span>LLM设置</span>';
  btn.onclick = () => renderLLMSettingsPanel();
  
  return btn;
}

/**
 * 初始化LLM配置（从本地存储加载）
 */
export function initLLMConfig(): void {
  const config = loadConfig();
  if (Object.keys(config).length > 0) {
    llmService.updateConfig(config);
  }
}
