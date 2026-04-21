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
  panel.className = `player-panel${isCurrent ? ' player-panel--active' : ''}`;

  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.marginBottom = '4px';
  header.style.color = 'var(--text-primary)';
  header.textContent = `${playerId}${isCurrent ? ' ⬅' : ''}`;

  const t = languageStore.t().game;

  const handInfo = document.createElement('div');
  handInfo.style.fontSize = 'max(var(--font-body-min), 14px)';
  handInfo.style.color = 'var(--text-muted)';
  handInfo.textContent = `${t.hand}: ${handCount} ${t.tiles}`;

  // Missing suit badge
  let missingSuitInfo: HTMLElement | null = null;
  if (missingSuit) {
    missingSuitInfo = document.createElement('div');
    missingSuitInfo.className = 'badge badge-gold';
    missingSuitInfo.style.marginTop = '4px';

    const suitName = missingSuit === 'W' ? t.wan : missingSuit === 'B' ? t.tiao : t.bing;
    missingSuitInfo.textContent = suitName;

  }

  // 显示碰杠信息
  if (melds.length > 0) {
    const meldsSection = document.createElement('div');
    meldsSection.style.fontSize = 'max(var(--font-body-min), 14px)';
    meldsSection.style.marginTop = '6px';
    meldsSection.style.color = 'var(--text-secondary)';

    const isZh = languageStore.getLanguage() === 'zh';

    for (const meld of melds) {
      const meldDiv = document.createElement('div');
      meldDiv.style.marginBottom = '4px';
      meldDiv.style.padding = '2px 4px';
      meldDiv.style.backgroundColor = 'var(--bg-hover)';
      meldDiv.style.borderRadius = 'var(--r-sm)';
      meldDiv.style.display = 'inline-flex';
      meldDiv.style.alignItems = 'center';
      meldDiv.style.gap = '1px';
      meldDiv.style.marginRight = '4px';

      const tileCount = meld.type === 'GANG' ? 4 : 3;

      if (isZh) {
        // 中文模式：显示麻将牌图像
        for (let i = 0; i < tileCount; i++) {
          const tileEl = renderTile(meld.tile, 'sm');
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
  discardsLabel.style.fontSize = 'max(var(--font-body-min), 14px)';
  discardsLabel.style.marginTop = '6px';
  discardsLabel.style.color = 'var(--text-muted)';
  discardsLabel.textContent = `${t.discards} (${discards.length}):`;

  // 弃牌容器，添加滚动和最大高度限制
  const discardsContainer = document.createElement('div');
  discardsContainer.style.maxHeight = '80px'; // 紧凑高度适应一屏
  discardsContainer.style.overflowY = 'auto';
  discardsContainer.style.overflowX = 'hidden';
  discardsContainer.appendChild(renderDiscardGrid(discards));

  panel.appendChild(header);
  panel.appendChild(handInfo);
  if (missingSuitInfo) panel.appendChild(missingSuitInfo);
  panel.appendChild(discardsLabel);
  panel.appendChild(discardsContainer);

  return panel;
}
