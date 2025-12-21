import { languageStore } from '../../store/languageStore';

export function renderCenterStatus(
  _turn: number,
  wallRemaining: number,
  _lastAction: string
): HTMLElement {
  const t = languageStore.t().game;
  
  const center = document.createElement('div');
  center.className = 'center-status';
  center.style.textAlign = 'center';
  center.style.padding = '6px 12px';
  center.style.backgroundColor = '#f9f9f9';
  center.style.borderRadius = '4px';
  center.style.border = '1px solid #ddd';
  center.style.display = 'inline-block';

  const wallDiv = document.createElement('div');
  wallDiv.style.fontSize = '12px';
  wallDiv.style.fontWeight = '600';
  wallDiv.style.color = '#333';
  wallDiv.textContent = `${t.wallRemaining}: ${wallRemaining}`;

  center.appendChild(wallDiv);

  return center;
}
