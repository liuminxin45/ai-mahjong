import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';

export function renderDiscardGrid(discards: Tile[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'discard-grid';
  grid.style.display = 'grid';

  // 自适应列数：尽量维持 2~3 行，避免拥挤（中文模式牌面文字较宽）
  const cols = Math.min(12, Math.max(6, Math.ceil(discards.length / 2)));
  grid.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
  grid.style.gridAutoRows = '26px';
  grid.style.gap = '3px';
  grid.style.marginTop = '4px';

  // 当弃牌数量较多时进一步压缩尺寸
  const compact = discards.length > cols * 2;
  const size = compact ? 18 : 20;
  const fontSize = compact ? '13px' : '14px';

  for (const tile of discards) {
    const tileEl = renderTile(tile);
    tileEl.style.fontSize = fontSize;
    tileEl.style.width = `${size}px`;
    tileEl.style.height = `${size}px`;
    tileEl.style.display = 'flex';
    tileEl.style.alignItems = 'center';
    tileEl.style.justifyContent = 'center';
    grid.appendChild(tileEl);
  }

  return grid;
}
