import { languageStore } from '../../store/languageStore';

export function renderCenterStatus(
  _turn: number,
  wallRemaining: number,
  _lastAction: string
): HTMLElement {
  const t = languageStore.t().game;

  const center = document.createElement('div');
  center.style.cssText = `
    text-align:center; padding:var(--sp-2) var(--sp-3);
    background:var(--bg-surface); border-radius:var(--r-md);
    border:1px solid var(--border-default); display:inline-block;
  `;

  const wallDiv = document.createElement('div');
  wallDiv.style.cssText = 'font-size:var(--fs-sm); font-weight:var(--fw-semibold); color:var(--text-secondary);';
  wallDiv.textContent = `${t.wallRemaining}: ${wallRemaining}`;

  center.appendChild(wallDiv);
  return center;
}
