import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(discards: Tile[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'discard-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(6, 28px)';
  grid.style.gap = '2px';
  grid.style.marginTop = '4px';

  for (const tile of discards) {
    const tileEl = renderTile(tile);
    tileEl.style.fontSize = '20px';
    tileEl.style.width = '28px';
    tileEl.style.height = '28px';
    tileEl.style.display = 'flex';
    tileEl.style.alignItems = 'center';
    tileEl.style.justifyContent = 'center';
    grid.appendChild(tileEl);
  }

  return grid;
}
