import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(discards: Tile[]): HTMLElement {
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:2px; justify-content:center;';

  for (const tile of discards) {
    const tileEl = renderTile(tile, 'sm');
    grid.appendChild(tileEl);
  }

  return grid;
}
