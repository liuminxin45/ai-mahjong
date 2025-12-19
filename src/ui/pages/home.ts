import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';

export function renderHome(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';
  
  const t = languageStore.t().home;

  const title = document.createElement('h2');
  title.textContent = t.title;

  const start = document.createElement('button');
  start.textContent = t.newGame;
  start.onclick = () => {
    ctx.orchestrator.startNewMatch(ctx.settingsStore.ruleId);
    ctx.navigate('#/match');
  };

  const settings = document.createElement('button');
  settings.textContent = t.settings;
  settings.onclick = () => {
    ctx.navigate('#/settings');
  };

  const replay = document.createElement('button');
  replay.textContent = 'Replay';
  replay.onclick = () => {
    ctx.navigate('#/replay');
  };

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '8px';

  wrap.appendChild(start);
  wrap.appendChild(settings);
  wrap.appendChild(replay);

  root.appendChild(title);
  root.appendChild(wrap);
}
