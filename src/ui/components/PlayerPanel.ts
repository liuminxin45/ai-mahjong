import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import type { Meld } from '../../core/model/state';
import { renderDiscardGrid } from './DiscardGrid';
import { renderTile } from './tileView';
import { languageStore } from '../../store/languageStore';

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

  const t = languageStore.t().game;
  
  const handInfo = document.createElement('div');
  handInfo.style.fontSize = '12px';
  handInfo.style.color = '#666';
  handInfo.textContent = `${t.hand}: ${handCount} ${t.tiles}`;
  
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
    
    const suitName = missingSuit === 'W' ? t.wan : missingSuit === 'B' ? t.tiao : t.bing;
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
    
    const isZh = languageStore.getLanguage() === 'zh';
    
    for (const meld of melds) {
      const meldDiv = document.createElement('div');
      meldDiv.style.marginBottom = '4px';
      meldDiv.style.padding = '2px 4px';
      meldDiv.style.backgroundColor = '#e8f4f8';
      meldDiv.style.borderRadius = '3px';
      meldDiv.style.display = 'inline-flex';
      meldDiv.style.alignItems = 'center';
      meldDiv.style.gap = '1px';
      meldDiv.style.marginRight = '4px';
      
      const tileCount = meld.type === 'GANG' ? 4 : 3;
      
      if (isZh) {
        // 中文模式：显示麻将牌图像
        for (let i = 0; i < tileCount; i++) {
          const tileEl = renderTile(meld.tile);
          tileEl.style.width = '20px';
          tileEl.style.height = '28px';
          tileEl.style.padding = '1px';
          tileEl.style.border = 'none';
          tileEl.style.backgroundColor = 'transparent';
          
          const img = tileEl.querySelector('img');
          if (img) {
            img.style.width = '18px';
            img.style.height = '26px';
            img.style.objectFit = 'contain';
          }
          
          meldDiv.appendChild(tileEl);
        }
      } else {
        // 英文模式：显示文本
        let meldText = '';
        const tileStr = `${meld.tile.suit}${meld.tile.rank}`;
        
        if (meld.type === 'PENG') {
          meldText = `Pong ${tileStr}×3`;
        } else if (meld.type === 'GANG') {
          const gangMeld = meld as any;
          if (gangMeld.gangType === 'AN') {
            meldText = `Kong(H) ${tileStr}×4`;
          } else if (gangMeld.gangType === 'MING') {
            meldText = `Kong(O) ${tileStr}×4`;
          } else if (gangMeld.gangType === 'JIA') {
            meldText = `Kong(+) ${tileStr}×4`;
          } else {
            meldText = `Kong ${tileStr}×4`;
          }
        } else if (meld.type === 'CHI') {
          meldText = `Chow ${tileStr}`;
        }
        
        meldDiv.textContent = meldText;
      }
      
      meldsSection.appendChild(meldDiv);
    }
    
    panel.appendChild(meldsSection);
  }

  const discardsLabel = document.createElement('div');
  discardsLabel.style.fontSize = '12px';
  discardsLabel.style.marginTop = '6px';
  discardsLabel.style.color = '#666';
  discardsLabel.textContent = `${t.discards} (${discards.length}):`;

  // 弃牌容器，添加滚动和最大高度限制
  const discardsContainer = document.createElement('div');
  discardsContainer.style.maxHeight = '80px'; // 紧凑高度适应一屏
  discardsContainer.style.overflowY = 'auto';
  discardsContainer.style.overflowX = 'hidden';
  discardsContainer.appendChild(renderDiscardGrid(discards));

  panel.appendChild(header);
  panel.appendChild(handInfo);
  panel.appendChild(discardsLabel);
  panel.appendChild(discardsContainer);

  return panel;
}
