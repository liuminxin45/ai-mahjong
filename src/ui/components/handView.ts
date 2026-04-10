import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';
import { sortTilesWithMissingSuit } from '../../core/rules/packs/chengdu/sort';

export function renderHand(
  hand: Tile[],
  onClickTile?: (tile: Tile) => void,
  missingSuit?: 'W' | 'B' | 'T',
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-end;
    padding: var(--sp-2) 0;
  `;

  const sortedHand = sortTilesWithMissingSuit(hand, missingSuit);

  for (const t of sortedHand) {
    const el = renderTile(t, 'md') as HTMLButtonElement;

    if (missingSuit && t.suit === missingSuit) {
      el.classList.add('mj-tile--dimmed');
    }

    if (onClickTile) {
      el.classList.add('mj-tile--clickable');
      el.addEventListener('click', () => onClickTile(t));
    } else {
      el.disabled = true;
      el.style.cursor = 'default';
    }
    wrap.appendChild(el);
  }

  return wrap;
}
