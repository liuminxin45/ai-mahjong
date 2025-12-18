import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { renderDiscardGrid } from './DiscardGrid';

export function renderPlayerPanel(
  playerId: PlayerId,
  handCount: number,
  discards: Tile[],
  isCurrent: boolean
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'player-panel';
  panel.style.border = isCurrent ? '2px solid #4a90e2' : '1px solid #ccc';
  panel.style.padding = '8px';
  panel.style.borderRadius = '4px';
  panel.style.backgroundColor = isCurrent ? '#f0f8ff' : '#fff';

  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.marginBottom = '4px';
  header.textContent = `${playerId}${isCurrent ? ' ⬅' : ''}`;

  const handInfo = document.createElement('div');
  handInfo.style.fontSize = '12px';
  handInfo.style.color = '#666';
  handInfo.textContent = `Hand: ${handCount} tiles`;

  const discardsLabel = document.createElement('div');
  discardsLabel.style.fontSize = '12px';
  discardsLabel.style.marginTop = '6px';
  discardsLabel.style.color = '#666';
  discardsLabel.textContent = `Discards (${discards.length}):`;

  panel.appendChild(header);
  panel.appendChild(handInfo);
  panel.appendChild(discardsLabel);
  panel.appendChild(renderDiscardGrid(discards));

  return panel;
}
