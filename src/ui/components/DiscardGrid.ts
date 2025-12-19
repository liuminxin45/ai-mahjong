import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(discards: Tile[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'discard-grid';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(8, 20px)'; // 增加列数，缩小尺寸
  grid.style.gap = '2px';
  grid.style.marginTop = '4px';

  for (const tile of discards) {
    const tileEl = renderTile(tile);
    tileEl.style.fontSize = '14px'; // 从 20px 减小到 14px
    tileEl.style.width = '20px'; // 从 28px 减小到 20px
    tileEl.style.height = '20px'; // 从 28px 减小到 20px
    tileEl.style.display = 'flex';
    tileEl.style.alignItems = 'center';
    tileEl.style.justifyContent = 'center';
    grid.appendChild(tileEl);
  }

  return grid;
}
