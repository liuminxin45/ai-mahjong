import type { Tile } from '../../core/model/tile';
import { tileToString } from '../../core/model/tile';
import { languageStore } from '../../store/languageStore';
import { getActivePaletteLut, getTileColorMode } from '../tilePalette';
import w1Icon from '../../../resource/mahjong_tiles/Characters1.png';
import w2Icon from '../../../resource/mahjong_tiles/Characters2.png';
import w3Icon from '../../../resource/mahjong_tiles/Characters3.png';
import w4Icon from '../../../resource/mahjong_tiles/Characters4.png';
import w5Icon from '../../../resource/mahjong_tiles/Characters5.png';
import w6Icon from '../../../resource/mahjong_tiles/Characters6.png';
import w7Icon from '../../../resource/mahjong_tiles/Characters7.png';
import w8Icon from '../../../resource/mahjong_tiles/Characters8.png';
import w9Icon from '../../../resource/mahjong_tiles/Characters9.png';
import t1Icon from '../../../resource/mahjong_tiles/Circles1.png';
import t2Icon from '../../../resource/mahjong_tiles/Circles2.png';
import t3Icon from '../../../resource/mahjong_tiles/Circles3.png';
import t4Icon from '../../../resource/mahjong_tiles/Circles4.png';
import t5Icon from '../../../resource/mahjong_tiles/Circles5.png';
import t6Icon from '../../../resource/mahjong_tiles/Circles6.png';
import t7Icon from '../../../resource/mahjong_tiles/Circles7.png';
import t8Icon from '../../../resource/mahjong_tiles/Circles8.png';
import t9Icon from '../../../resource/mahjong_tiles/Circles9.png';
import b1Icon from '../../../resource/mahjong_tiles/Bamboo1.png';
import b2Icon from '../../../resource/mahjong_tiles/Bamboo2.png';
import b3Icon from '../../../resource/mahjong_tiles/Bamboo3.png';
import b4Icon from '../../../resource/mahjong_tiles/Bamboo4.png';
import b5Icon from '../../../resource/mahjong_tiles/Bamboo5.png';
import b6Icon from '../../../resource/mahjong_tiles/Bamboo6.png';
import b7Icon from '../../../resource/mahjong_tiles/Bamboo7.png';
import b8Icon from '../../../resource/mahjong_tiles/Bamboo8.png';
import b9Icon from '../../../resource/mahjong_tiles/Bamboo9.png';

export type TileVariant = 'hand' | 'drawn' | 'discard' | 'discard-focus' | 'meld' | 'wall' | 'back';

// Source tiles are 20x28 px (aspect 20:28 = 0.7143). Every size step keeps that
// exact ratio so the bitmap is never anisotropically stretched (ASSET_AUDIT §2.3).
const pixelTileTargetSize: Record<'xs' | 'sm' | 'md' | 'lg', { width: number; height: number }> = {
  xs: { width: 10, height: 14 },
  sm: { width: 14, height: 20 },
  md: { width: 20, height: 28 },
  lg: { width: 28, height: 40 },
};

const pixelTileRenderScale: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  // Keep visual size unchanged; render at 2x for small tiles to preserve details.
  xs: 2,
  sm: 2,
  md: 1,
  lg: 1,
};

// (src, size, mode) -> processed dataURL. Bounded LRU: at most 27 assets x 4
// sizes x 5 color modes = 540 possible keys; evict oldest beyond the cap.
const PIXEL_TILE_CACHE_LIMIT = 320;
const pixelTileCache = new Map<string, string>();
const pixelTilePending = new Map<string, Promise<string>>();

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

function getPixelTileCacheKey(src: string, size: keyof typeof pixelTileTargetSize): string {
  return `${src}::${size}::${getTileColorMode()}`;
}

function rememberPixelTile(cacheKey: string, dataUrl: string): void {
  pixelTileCache.delete(cacheKey);
  pixelTileCache.set(cacheKey, dataUrl);
  while (pixelTileCache.size > PIXEL_TILE_CACHE_LIMIT) {
    const oldest = pixelTileCache.keys().next().value;
    if (oldest === undefined) break;
    pixelTileCache.delete(oldest);
  }
}

// Remap every pixel through the active 6-color LUT (identity in 'normal' mode).
function applyPaletteLut(context: CanvasRenderingContext2D, width: number, height: number): void {
  const lut = getActivePaletteLut();
  if (!lut) return;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const mapped = lut.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (mapped === undefined) continue;
    data[i] = (mapped >> 16) & 0xff;
    data[i + 1] = (mapped >> 8) & 0xff;
    data[i + 2] = mapped & 0xff;
  }
  context.putImageData(imageData, 0, 0);
}

function createPixelatedTile(src: string, size: keyof typeof pixelTileTargetSize): Promise<string> {
  const cacheKey = getPixelTileCacheKey(src, size);
  const cached = pixelTileCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const pending = pixelTilePending.get(cacheKey);
  if (pending) return pending;

  const { width, height } = pixelTileTargetSize[size];
  const renderScale = pixelTileRenderScale[size];
  const renderWidth = width * renderScale;
  const renderHeight = height * renderScale;
  const job = new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(src);
          return;
        }

        // Pixel art: never smooth. Nearest-neighbor keeps hard edges; the LUT
        // then remaps the 6-color palette for the active color mode.
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, renderWidth, renderHeight);
        context.drawImage(image, 0, 0, renderWidth, renderHeight);
        applyPaletteLut(context, renderWidth, renderHeight);

        const pixelated = canvas.toDataURL('image/png');
        rememberPixelTile(cacheKey, pixelated);
        resolve(pixelated);
      } catch (error) {
        reject(error);
      } finally {
        pixelTilePending.delete(cacheKey);
      }
    };
    image.onerror = () => {
      pixelTilePending.delete(cacheKey);
      reject(new Error(`Failed to load tile asset: ${src}`));
    };
    image.src = src;
  });

  pixelTilePending.set(cacheKey, job);
  return job;
}

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
    const tileSrc = suitIconMap[tile.suit][tile.rank];
    const img = document.createElement('img');
    const cacheKey = getPixelTileCacheKey(tileSrc, size);
    img.src = pixelTileCache.get(cacheKey) ?? tileSrc;
    img.alt = tileToString(tile);
    img.draggable = false;
    img.onerror = () => {
      if (!el.contains(img)) return;
      el.removeChild(img);
      el.textContent = tileToString(tile);
      el.classList.add('mj-tile--fallback');
    };
    el.appendChild(img);

    if (!pixelTileCache.has(cacheKey)) {
      void createPixelatedTile(tileSrc, size).then((pixelatedSrc) => {
        if (img.isConnected) {
          img.src = pixelatedSrc;
        }
      }).catch(() => {
        // Keep the original asset if pixel conversion fails.
      });
    }
  } else {
    el.textContent = tileToString(tile);
    el.classList.add('mj-tile--fallback');
  }

  return el;
}
