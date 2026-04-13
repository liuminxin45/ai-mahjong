import type { UiCtx } from '../context';
import { renderDebugMode } from '../renderers/matchDebugRenderer';
import { renderTableMode } from '../renderers/matchTableRenderer';
import { renderEventLine } from '../components/eventLogView';
import { languageStore } from '../../store/languageStore';

export function renderMatch(root: HTMLElement, ctx: UiCtx): () => void {
  root.innerHTML = '';

  const lastLlmState = {
    key: null as string | null,
    text: null as string | null,
    inFlight: false,
  };

  const page = document.createElement('div');
  page.className = 'match-page';

  const toolbar = document.createElement('div');
  toolbar.className = 'match-toolbar';

  const contentArea = document.createElement('div');
  contentArea.className = 'match-page__content';

  page.appendChild(toolbar);
  page.appendChild(contentArea);
  root.appendChild(page);

  const appendToolbarButton = (label: string, onClick: () => void, emphasis = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = emphasis ? 'match-toolbar__button match-toolbar__button--accent' : 'match-toolbar__button';
    btn.textContent = label;
    btn.onclick = onClick;
    toolbar.appendChild(btn);
  };

  const renderToolbar = () => {
    const t = languageStore.t();
    toolbar.innerHTML = '';

    appendToolbarButton(t.common.back, () => ctx.navigate('#/'));
    appendToolbarButton(t.game.copyLog, () => {
      const replay = ctx.orchestrator.exportReplay();
      const text = replay.events.map(ev => renderEventLine(ev)).join('\n');
      navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      });
    });
    appendToolbarButton(ctx.settingsStore.uiMode === 'DEBUG' ? t.settings.uiModeTable : t.settings.uiModeDebug, () => {
      ctx.settingsStore.setUiMode(ctx.settingsStore.uiMode === 'DEBUG' ? 'TABLE' : 'DEBUG');
    });

    appendToolbarButton(t.common.close, () => ctx.orchestrator.stop(), true);
  };

  const render = () => {
    renderToolbar();
    contentArea.innerHTML = '';

    if (ctx.settingsStore.uiMode === 'DEBUG') {
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
