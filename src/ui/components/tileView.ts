import type { Tile } from '../../core/model/tile';
import { tileToString } from '../../core/model/tile';

export function renderTile(tile: Tile): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = tileToString(tile);
  el.style.padding = '6px 8px';
  el.style.border = '1px solid #ddd';
  el.style.borderRadius = '6px';
  el.style.background = '#fff';
  el.style.cursor = 'pointer';
  return el;
}
