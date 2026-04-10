import type { UiCtx } from '../context';
import { renderDebugMode } from '../renderers/matchDebugRenderer';
import { renderTableMode } from '../renderers/matchTableRenderer';
import { languageStore } from '../../store/languageStore';
import { renderAIParamsButton, renderAIParamsPanel } from '../components/AIParamsPanel';
import { renderProfileButton } from '../components/UserProfilePanel';
import { renderHistoryButton } from '../components/GameHistoryPanel';
import { renderLLMSettingsButton } from '../components/LLMSettingsPanel';

export function renderMatch(root: HTMLElement, ctx: UiCtx): () => void {
  root.innerHTML = '';

  const lastLlmState = {
    key: null as string | null,
    text: null as string | null,
    inFlight: false,
  };

  const t = languageStore.t();

  // --- Page container ---
  const page = document.createElement('div');
  page.style.cssText = `
    display: flex; flex-direction: column; height: 100dvh;
    overflow: hidden; background: var(--bg-base);
  `;

  // --- Header bar ---
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--sp-2) var(--sp-4); min-height: 48px;
    background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0; gap: var(--sp-2);
  `;

  // Left: back + title
  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = 'display: flex; align-items: center; gap: var(--sp-3);';

  const back = document.createElement('button');
  back.className = 'btn btn-ghost btn-sm';
  back.textContent = '← ' + t.common.back;
  back.onclick = () => ctx.navigate('#/');

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: var(--fs-base); font-weight: var(--fw-semibold);
    color: var(--text-primary);
  `;
  title.textContent = t.game.phasePlaying;

  headerLeft.appendChild(back);
  headerLeft.appendChild(title);

  // Right: controls
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; align-items: center; gap: var(--sp-2);';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-ghost btn-sm';
  exportBtn.textContent = t.game.copyLog;
  exportBtn.onclick = () => {
    ctx.orchestrator.exportReplay();
    ctx.navigate('#/replay');
  };

  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn btn-ghost btn-sm';
  stopBtn.textContent = t.common.close;
  stopBtn.onclick = () => ctx.orchestrator.stop();

  const switchBtn = document.createElement('button');
  switchBtn.className = 'btn btn-ghost btn-sm';

  // AI params button
  const aiParamsBtn = renderAIParamsButton();

  // LLM buttons (human mode only)
  const llmBtnGroup = document.createElement('div');
  llmBtnGroup.style.cssText = 'display: flex; gap: var(--sp-1);';

  if (!ctx.settingsStore.p0IsAI) {
    llmBtnGroup.appendChild(renderProfileButton());
    llmBtnGroup.appendChild(renderHistoryButton());
    llmBtnGroup.appendChild(renderLLMSettingsButton());
  }

  controls.appendChild(exportBtn);
  controls.appendChild(stopBtn);
  controls.appendChild(aiParamsBtn);
  controls.appendChild(llmBtnGroup);
  controls.appendChild(switchBtn);

  header.appendChild(headerLeft);
  header.appendChild(controls);

  // --- Content area ---
  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'flex: 1; overflow: hidden; min-height: 0;';

  page.appendChild(header);
  page.appendChild(contentArea);
  root.appendChild(page);

  // AI params panel
  const aiPanel = renderAIParamsPanel();
  root.appendChild(aiPanel);

  const render = () => {
    const currentMode = ctx.settingsStore.uiMode;
    switchBtn.textContent = currentMode === 'DEBUG' ? t.settings.uiModeTable : t.settings.uiModeDebug;
    switchBtn.onclick = () => {
      const newMode = currentMode === 'DEBUG' ? 'TABLE' : 'DEBUG';
      ctx.settingsStore.setUiMode(newMode);
    };

    contentArea.innerHTML = '';

    if (currentMode === 'DEBUG') {
      renderDebugMode(contentArea, ctx, lastLlmState);
    } else {
      renderTableMode(contentArea, ctx);
    }
  };

  render();
  const unsub = ctx.gameStore.subscribe(render);
  const unsubSettings = ctx.settingsStore.subscribe(render);

  return () => {
    unsub();
    unsubSettings();
  };
}
