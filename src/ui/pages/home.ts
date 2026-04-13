import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';
import { createPixelButton } from '../components/pixelFrame';

export function renderHome(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const t = languageStore.t();
  const page = document.createElement('div');
  page.className = 'pixel-app-page';

  const shell = document.createElement('section');
  shell.className = 'pixel-page-shell pixel-page-shell--compact';

  const body = document.createElement('div');
  body.className = 'pixel-home-panel';

  const title = document.createElement('div');
  title.className = 'pixel-home-title';
  title.textContent = t.home.title || 'Neo Mahjong';

  const subtitle = document.createElement('div');
  subtitle.className = 'pixel-home-subtitle';
  subtitle.textContent = languageStore.getLanguage() === 'zh'
    ? 'CHENGDU MAHJONG / PIXEL TABLE'
    : 'CHENGDU MAHJONG / PIXEL TABLE';

  const copy = document.createElement('div');
  copy.className = 'pixel-home-copy';
  copy.textContent = languageStore.getLanguage() === 'zh'
    ? '血战到底，像素化平面牌桌。开始新局、调整设置、查看回放。'
    : 'Blood battle mahjong on a flat pixel table. Start, configure, and replay.';

  const actions = document.createElement('div');
  actions.className = 'pixel-home-actions';

  const start = createPixelButton(t.home.newGame, 'accent');
  start.onclick = () => {
    ctx.orchestrator.startNewMatch(ctx.settingsStore.ruleId);
    ctx.navigate('#/match');
  };

  const settings = createPixelButton(t.home.settings, 'neutral');
  settings.onclick = () => ctx.navigate('#/settings');

  const replay = createPixelButton(languageStore.getLanguage() === 'zh' ? '回放' : 'Replay', 'neutral');
  replay.onclick = () => ctx.navigate('#/replay');

  actions.appendChild(start);
  actions.appendChild(settings);
  actions.appendChild(replay);

  const footer = document.createElement('div');
  footer.className = 'pixel-home-copy';
  footer.textContent = 'V1.0 / OPEN SOURCE';

  body.appendChild(title);
  body.appendChild(subtitle);
  body.appendChild(copy);
  body.appendChild(actions);
  body.appendChild(footer);
  shell.appendChild(body);
  page.appendChild(shell);
  root.appendChild(page);
}
