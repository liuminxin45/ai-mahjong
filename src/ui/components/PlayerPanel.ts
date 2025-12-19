import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import type { Meld } from '../../core/model/state';
import { renderDiscardGrid } from './DiscardGrid';

export function renderPlayerPanel(
  playerId: PlayerId,
  handCount: number,
  discards: Tile[],
  melds: Meld[],
  isCurrent: boolean,
  missingSuit?: 'W' | 'B' | 'T'
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
  
  // 显示缺门信息
  if (missingSuit) {
    const missingSuitInfo = document.createElement('div');
    missingSuitInfo.style.fontSize = '12px';
    missingSuitInfo.style.fontWeight = '600';
    missingSuitInfo.style.marginTop = '4px';
    missingSuitInfo.style.padding = '4px 8px';
    missingSuitInfo.style.backgroundColor = '#fff3cd';
    missingSuitInfo.style.border = '1px solid #ffc107';
    missingSuitInfo.style.borderRadius = '3px';
    missingSuitInfo.style.color = '#856404';
    
    const suitName = missingSuit === 'W' ? 'Wan' : missingSuit === 'B' ? 'Bamboo' : 'Dot';
    missingSuitInfo.textContent = suitName;
    
    panel.appendChild(header);
    panel.appendChild(handInfo);
    panel.appendChild(missingSuitInfo);
  } else {
    panel.appendChild(header);
    panel.appendChild(handInfo);
  }

  // 显示碰杠信息
  if (melds.length > 0) {
    const meldsSection = document.createElement('div');
    meldsSection.style.fontSize = '12px';
    meldsSection.style.marginTop = '6px';
    meldsSection.style.color = '#333';
    
    const meldsLabel = document.createElement('div');
    meldsLabel.style.fontWeight = '600';
    meldsLabel.style.marginBottom = '4px';
    meldsLabel.textContent = 'Melds:';
    
    meldsSection.appendChild(meldsLabel);
    
    for (const meld of melds) {
      const meldDiv = document.createElement('div');
      meldDiv.style.marginBottom = '2px';
      meldDiv.style.padding = '4px';
      meldDiv.style.backgroundColor = '#e8f4f8';
      meldDiv.style.borderRadius = '3px';
      meldDiv.style.display = 'inline-block';
      meldDiv.style.marginRight = '4px';
      
      let meldText = '';
      const tileStr = `${meld.tile.suit}${meld.tile.rank}`;
      
      if (meld.type === 'PENG') {
        meldText = `Pong ${tileStr}×3`;
      } else if (meld.type === 'GANG') {
        // Chengdu 规则包扩展了 Meld 类型，包含 gangType
        const gangMeld = meld as any;
        if (gangMeld.gangType === 'AN') {
          meldText = `Kong(Hidden) ${tileStr}×4`;
        } else if (gangMeld.gangType === 'MING') {
          meldText = `Kong(Open) ${tileStr}×4`;
        } else if (gangMeld.gangType === 'JIA') {
          meldText = `Kong(Add) ${tileStr}×4`;
        } else {
          meldText = `Kong ${tileStr}×4`;
        }
      } else if (meld.type === 'CHI') {
        meldText = `Chow ${tileStr}`;
      }
      
      meldDiv.textContent = meldText;
      meldsSection.appendChild(meldDiv);
    }
    
    panel.appendChild(meldsSection);
  }

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
