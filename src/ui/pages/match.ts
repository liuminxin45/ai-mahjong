import type { UiCtx } from '../context';
import type { Action } from '../../core/model/action';
import { renderDebugMode } from '../renderers/matchDebugRenderer';
import { renderTableMode } from '../renderers/matchTableRenderer';
import { renderEventLine } from '../components/eventLogView';
import {
  removeChatAssistantSurface,
  renderChatAssistantButton,
  syncCoachPanelContext,
} from '../components/LLMChatAssistant';
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
  let aiLauncher: HTMLElement | null = null;

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
    appendToolbarButton(t.home.settings, () => ctx.navigate('#/settings'));
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
  };

  const render = () => {
    renderToolbar();
    contentArea.innerHTML = '';

    if (ctx.settingsStore.uiMode === 'DEBUG') {
      renderDebugMode(contentArea, ctx, lastLlmState);
    } else {
      renderTableMode(contentArea, ctx);
    }

    const coachContext = ctx.gameStore.state
      ? {
        gameState: ctx.gameStore.state,
        legalActions: ctx.orchestrator.getLegalActions('P0'),
        dispatchAction: (action: Action) => ctx.orchestrator.dispatchHumanAction(action),
      }
      : {};

    syncCoachPanelContext(coachContext);

    aiLauncher?.remove();
    aiLauncher = null;
    if (ctx.settingsStore.llmEnabled && ctx.gameStore.state) {
      aiLauncher = renderChatAssistantButton(coachContext);
      page.appendChild(aiLauncher);
    } else {
      removeChatAssistantSurface();
    }
  };

  render();
  const unsub = ctx.gameStore.subscribe(render);
  const unsubSettings = ctx.settingsStore.subscribe(render);

  return () => {
    aiLauncher?.remove();
    removeChatAssistantSurface();
    unsub();
    unsubSettings();
  };
}
