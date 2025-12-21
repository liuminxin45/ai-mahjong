import type { UiCtx } from '../context';
import { renderDebugMode } from '../renderers/matchDebugRenderer';
import { renderTableMode } from '../renderers/matchTableRenderer';
import { languageStore } from '../../store/languageStore';
import { renderAIParamsButton } from '../components/AIParamsPanel';

export function renderMatch(root: HTMLElement, ctx: UiCtx): () => void {
  root.innerHTML = '';

  const lastLlmState = {
    key: null as string | null,
    text: null as string | null,
    inFlight: false,
  };

  const t = languageStore.t();
  
  const title = document.createElement('h2');
  title.textContent = t.game.phasePlaying;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '12px';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';

  const back = document.createElement('button');
  back.textContent = t.common.back;
  back.onclick = () => ctx.navigate('#/');

  const exportBtn = document.createElement('button');
  exportBtn.textContent = t.game.copyLog;
  exportBtn.onclick = () => {
    ctx.orchestrator.exportReplay();
    ctx.navigate('#/replay');
  };

  const stopBtn = document.createElement('button');
  stopBtn.textContent = t.common.close;
  stopBtn.onclick = () => ctx.orchestrator.stop();

  const switchBtn = document.createElement('button');
  switchBtn.style.marginLeft = '16px';
  switchBtn.style.padding = '6px 12px';
  switchBtn.style.backgroundColor = '#4a90e2';
  switchBtn.style.color = 'white';
  switchBtn.style.border = 'none';
  switchBtn.style.borderRadius = '4px';
  switchBtn.style.cursor = 'pointer';

  // AI参数按钮
  const aiParamsBtn = renderAIParamsButton();
  
  controls.appendChild(back);
  controls.appendChild(exportBtn);
  controls.appendChild(stopBtn);
  controls.appendChild(aiParamsBtn);
  controls.appendChild(switchBtn);

  header.appendChild(title);
  header.appendChild(controls);

  root.appendChild(header);
  root.appendChild(document.createElement('hr'));

  const contentArea = document.createElement('div');
  root.appendChild(contentArea);

  const render = () => {
    const currentMode = ctx.settingsStore.uiMode;
    switchBtn.textContent = currentMode === 'DEBUG' ? `${t.settings.uiModeTable}` : `${t.settings.uiModeDebug}`;
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
