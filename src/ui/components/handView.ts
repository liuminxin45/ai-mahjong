import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';
import { sortTiles } from '../../core/rules/packs/chengdu/sort';

export function renderHand(
  hand: Tile[],
  onClickTile?: (tile: Tile) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '6px';

  // 自动排序手牌
  const sortedHand = sortTiles(hand);

  for (const t of sortedHand) {
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
