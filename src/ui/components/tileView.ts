import type { Tile } from '../../core/model/tile';
import { tileToString } from '../../core/model/tile';
import { languageStore } from '../../store/languageStore';
import w1Icon from '../../../resource/png/08-characters-1.png';
import w2Icon from '../../../resource/png/09-characters-2.png';
import w3Icon from '../../../resource/png/10-characters-3.png';
import w4Icon from '../../../resource/png/11-characters-4.png';
import w5Icon from '../../../resource/png/12-characters-5.png';
import w6Icon from '../../../resource/png/13-characters-6.png';
import w7Icon from '../../../resource/png/14-characters-7.png';
import w8Icon from '../../../resource/png/15-characters-8.png';
import w9Icon from '../../../resource/png/16-characters-9.png';
import t1Icon from '../../../resource/png/17-circles-1.png';
import t2Icon from '../../../resource/png/18-circles-2.png';
import t3Icon from '../../../resource/png/19-circles-3.png';
import t4Icon from '../../../resource/png/20-circles-4.png';
import t5Icon from '../../../resource/png/21-circles-5.png';
import t6Icon from '../../../resource/png/22-circles-6.png';
import t7Icon from '../../../resource/png/23-circles-7.png';
import t8Icon from '../../../resource/png/24-circles-8.png';
import t9Icon from '../../../resource/png/25-circles-9.png';
import b1Icon from '../../../resource/png/26-bamboos-1.png';
import b2Icon from '../../../resource/png/27-bamboos-2.png';
import b3Icon from '../../../resource/png/28-bamboos-3.png';
import b4Icon from '../../../resource/png/29-bamboos-4.png';
import b5Icon from '../../../resource/png/30-bamboos-5.png';
import b6Icon from '../../../resource/png/31-bamboos-6.png';
import b7Icon from '../../../resource/png/32-bamboos-7.png';
import b8Icon from '../../../resource/png/33-bamboos-8.png';
import b9Icon from '../../../resource/png/34-bamboos-9.png';

export type TileVariant = 'hand' | 'drawn' | 'discard' | 'discard-focus' | 'meld' | 'wall' | 'back';

const suitIconMap: Record<Tile['suit'], Record<Tile['rank'], string>> = {
  W: {
    1: w1Icon,
    2: w2Icon,
    3: w3Icon,
    4: w4Icon,
    5: w5Icon,
    6: w6Icon,
    7: w7Icon,
    8: w8Icon,
    9: w9Icon,
  },
  T: {
    1: t1Icon,
    2: t2Icon,
    3: t3Icon,
    4: t4Icon,
    5: t5Icon,
    6: t6Icon,
    7: t7Icon,
    8: t8Icon,
    9: t9Icon,
  },
  B: {
    1: b1Icon,
    2: b2Icon,
    3: b3Icon,
    4: b4Icon,
    5: b5Icon,
    6: b6Icon,
    7: b7Icon,
    8: b8Icon,
    9: b9Icon,
  },
};

export function renderTile(
  tile: Tile,
  size: 'xs' | 'sm' | 'md' | 'lg' = 'md',
  variant: TileVariant = 'hand',
): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `mj-tile mj-tile--${size} mj-tile--${variant}`;
  el.setAttribute('aria-label', tileToString(tile));

  if (variant === 'wall' || variant === 'back') {
    if (variant === 'back') {
      const pattern = document.createElement('span');
      pattern.className = 'mj-tile__back-pattern';
      el.appendChild(pattern);
    } else {
      const wallFace = document.createElement('span');
      wallFace.className = 'mj-tile__wall-face';
      el.appendChild(wallFace);
    }
    return el;
  }

  const currentLang = languageStore.getLanguage();
  if (currentLang === 'zh') {
    const img = document.createElement('img');
    img.src = suitIconMap[tile.suit][tile.rank];
    img.alt = tileToString(tile);
    img.onerror = () => {
      if (!el.contains(img)) return;
      el.removeChild(img);
      el.textContent = tileToString(tile);
      el.classList.add('mj-tile--fallback');
    };
    el.appendChild(img);
  } else {
    el.textContent = tileToString(tile);
    el.classList.add('mj-tile--fallback');
  }

  return el;
}
