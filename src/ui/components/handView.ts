import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';
import { sortTilesWithMissingSuit } from '../../core/rules/packs/chengdu/sort';

export function renderHand(
  hand: Tile[],
  onClickTile?: (tile: Tile) => void,
  missingSuit?: 'W' | 'B' | 'T',
  reactionTargets?: Tile[],
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'hand-dock';

  const mainRow = document.createElement('div');
  mainRow.className = 'hand-dock__main';

  const drawSlot = document.createElement('div');
  drawSlot.className = 'hand-dock__draw-slot';

  // The drawn tile is always the last element of the (unsorted) hand array,
  // because DRAW appends `wall[0]` via `hand.concat([top])`.
  const hasDrawn = hand.length % 3 === 2;
  const drawnTile = hasDrawn ? hand[hand.length - 1] : null;
  const sortedHand = [...sortTilesWithMissingSuit(hasDrawn ? hand.slice(0, -1) : hand, missingSuit)];
  const reactionTargetKeys = new Set((reactionTargets ?? []).map((tile) => `${tile.suit}${tile.rank}`));

  const appendTile = (tile: Tile, variant: 'hand' | 'drawn') => {
    const el = renderTile(tile, 'lg', variant) as HTMLButtonElement;

    if (missingSuit && tile.suit === missingSuit) {
      el.classList.add('mj-tile--dimmed');
    }

    if (reactionTargetKeys.has(`${tile.suit}${tile.rank}`)) {
      el.classList.add('mj-tile--reaction-target');
    }

    if (onClickTile) {
      el.classList.add('mj-tile--clickable');
      el.addEventListener('click', () => onClickTile(tile));
    } else {
      el.disabled = true;
      el.style.cursor = 'default';
    }

    if (variant === 'drawn') {
      drawSlot.appendChild(el);
    } else {
      mainRow.appendChild(el);
    }
  };

  for (const tile of sortedHand) {
    appendTile(tile, 'hand');
  }

  if (drawnTile) {
    appendTile(drawnTile, 'drawn');
  }

  wrap.appendChild(mainRow);
  wrap.appendChild(drawSlot);
  return wrap;
}
