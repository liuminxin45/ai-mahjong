import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';
import { sortTilesWithMissingSuit } from '../../core/rules/packs/chengdu/sort';

export function renderHand(
  hand: Tile[],
  onClickTile?: (tile: Tile) => void,
  missingSuit?: 'W' | 'B' | 'T',
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '6px';

  // 自动排序手牌，定缺牌放右边
  const sortedHand = sortTilesWithMissingSuit(hand, missingSuit);

  for (const t of sortedHand) {
    const el = renderTile(t) as HTMLButtonElement;
    
    // 定缺牌显示为灰色
    if (missingSuit && t.suit === missingSuit) {
      el.style.opacity = '0.5';
      el.style.filter = 'grayscale(50%)';
    }
    
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
