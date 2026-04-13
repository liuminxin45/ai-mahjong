import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(
  discards: Tile[],
  direction: 'top' | 'right' | 'bottom' | 'left' = 'bottom',
  focusLast = false,
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = `discard-grid discard-grid--${direction}`;

  discards.forEach((tile, index) => {
    const isFocus = focusLast && index === discards.length - 1;
    const tileEl = renderTile(tile, 'sm', isFocus ? 'discard-focus' : 'discard');
    grid.appendChild(tileEl);
  });

  return grid;
}
