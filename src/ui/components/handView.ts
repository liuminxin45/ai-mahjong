import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderHand(
  hand: Tile[],
  onClickTile?: (tile: Tile) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '6px';

  for (const t of hand) {
    const el = renderTile(t) as HTMLButtonElement;
    if (onClickTile) {
      el.addEventListener('click', () => onClickTile(t));
    } else {
      el.disabled = true;
      el.style.cursor = 'default';
      el.style.opacity = '0.7';
    }
    wrap.appendChild(el);
  }

  return wrap;
}
