import type { UiCtx } from '../context';
import { languageStore } from '../../store/languageStore';

export function renderHome(root: HTMLElement, ctx: UiCtx): void {
  root.innerHTML = '';

  const t = languageStore.t().home;

  const page = document.createElement('div');
  page.style.cssText = `
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100dvh; padding: var(--sp-6); gap: var(--sp-8);
  `;

  // Hero section
  const hero = document.createElement('div');
  hero.className = 'animate-fadeIn';
  hero.style.cssText = 'text-align: center;';

  // Decorative mahjong icon
  const icon = document.createElement('div');
  icon.style.cssText = `
    font-size: 64px; margin-bottom: var(--sp-4); line-height: 1;
    filter: drop-shadow(0 4px 12px rgba(212, 168, 67, 0.3));
  `;
  icon.textContent = '🀄';

  const title = document.createElement('h1');
  title.style.cssText = `
    font-size: var(--fs-3xl); font-weight: var(--fw-bold);
    color: var(--text-primary); margin-bottom: var(--sp-2);
    letter-spacing: -0.5px;
  `;
  title.textContent = 'Neo Mahjong';

  const subtitle = document.createElement('div');
  subtitle.style.cssText = `
    font-size: var(--fs-lg); color: var(--c-accent);
    font-weight: var(--fw-medium); letter-spacing: 2px;
  `;
  subtitle.textContent = '成都麻将 · 血战到底';

  const tagline = document.createElement('div');
  tagline.style.cssText = `
    font-size: var(--fs-sm); color: var(--text-muted);
    margin-top: var(--sp-3);
  `;
  tagline.textContent = languageStore.getLanguage() === 'zh'
    ? '四川血战麻将 · 智能AI对局'
    : 'Sichuan Blood Battle Mahjong · Smart AI';

  hero.appendChild(icon);
  hero.appendChild(title);
  hero.appendChild(subtitle);
  hero.appendChild(tagline);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'animate-slideUp';
  actions.style.cssText = `
    display: flex; flex-direction: column; gap: var(--sp-3);
    width: 100%; max-width: 320px;
  `;

  const start = document.createElement('button');
  start.className = 'btn btn-accent btn-lg';
  start.style.cssText = `
    width: 100%; font-size: var(--fs-md); padding: var(--sp-4) var(--sp-6);
    letter-spacing: 0.5px;
  `;
  start.textContent = t.newGame;
  start.onclick = () => {
    ctx.orchestrator.startNewMatch(ctx.settingsStore.ruleId);
    ctx.navigate('#/match');
  };

  const secondaryRow = document.createElement('div');
  secondaryRow.style.cssText = 'display: flex; gap: var(--sp-3);';

  const settings = document.createElement('button');
  settings.className = 'btn btn-ghost btn-lg';
  settings.style.cssText = 'flex: 1;';
  settings.textContent = t.settings;
  settings.onclick = () => ctx.navigate('#/settings');

  const replay = document.createElement('button');
  replay.className = 'btn btn-ghost btn-lg';
  replay.style.cssText = 'flex: 1;';
  replay.textContent = languageStore.getLanguage() === 'zh' ? '回放' : 'Replay';
  replay.onclick = () => ctx.navigate('#/replay');

  secondaryRow.appendChild(settings);
  secondaryRow.appendChild(replay);

  actions.appendChild(start);
  actions.appendChild(secondaryRow);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    font-size: var(--fs-xs); color: var(--text-muted);
    position: absolute; bottom: var(--sp-6);
  `;
  footer.textContent = 'v1.0 · Open Source';

  page.appendChild(hero);
  page.appendChild(actions);
  page.appendChild(footer);
  root.appendChild(page);
}
