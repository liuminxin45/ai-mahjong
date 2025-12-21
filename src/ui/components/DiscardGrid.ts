import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(discards: Tile[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'discard-grid';
  grid.style.display = 'flex';
  grid.style.flexWrap = 'wrap';
  grid.style.gap = '2px';
  grid.style.justifyContent = 'center';

  // PNG图像尺寸约28x40，按比例缩小到合适大小
  const width = 24;
  const height = 34;

  for (const tile of discards) {
    const tileEl = renderTile(tile);
    tileEl.style.width = `${width}px`;
    tileEl.style.height = `${height}px`;
    tileEl.style.minWidth = `${width}px`;
    tileEl.style.minHeight = `${height}px`;
    tileEl.style.padding = '2px';
    tileEl.style.display = 'flex';
    tileEl.style.alignItems = 'center';
    tileEl.style.justifyContent = 'center';
    
    // 调整内部图片尺寸
    const img = tileEl.querySelector('img');
    if (img) {
      img.style.width = '20px';
      img.style.height = '30px';
      img.style.objectFit = 'contain';
    }
    
    grid.appendChild(tileEl);
  }

  return grid;
}
