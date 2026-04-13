import type { Tile } from '../../core/model/tile';
import { tileToString } from '../../core/model/tile';
import { languageStore } from '../../store/languageStore';
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

const pixelTileTargetSize: Record<'xs' | 'sm' | 'md' | 'lg', { width: number; height: number }> = {
  xs: { width: 10, height: 16 },
  sm: { width: 14, height: 22 },
  md: { width: 20, height: 30 },
  lg: { width: 28, height: 42 },
};

const pixelTileRenderScale: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  // Keep visual size unchanged; render at 2x for small tiles to preserve details.
  xs: 2,
  sm: 2,
  md: 1,
  lg: 1,
};

const pixelTileSharpenAmount: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 0.55,
  sm: 0.45,
  md: 0.32,
  lg: 0.28,
};

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
  return `${src}::${size}`;
}

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function applySharpen(context: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  if (amount <= 0) return;

  const source = context.getImageData(0, 0, width, height);
  const src = source.data;
  const output = context.createImageData(width, height);
  const dst = output.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const leftX = x > 0 ? x - 1 : x;
      const rightX = x < width - 1 ? x + 1 : x;
      const upY = y > 0 ? y - 1 : y;
      const downY = y < height - 1 ? y + 1 : y;

      const leftIdx = (y * width + leftX) * 4;
      const rightIdx = (y * width + rightX) * 4;
      const upIdx = (upY * width + x) * 4;
      const downIdx = (downY * width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const current = src[idx + c];
        const sharpened =
          current * 5 -
          src[leftIdx + c] -
          src[rightIdx + c] -
          src[upIdx + c] -
          src[downIdx + c];
        const mixed = current + (sharpened - current) * amount;
        dst[idx + c] = clampByte(mixed);
      }

      dst[idx + 3] = src[idx + 3];
    }
  }

  context.putImageData(output, 0, 0);
}

function createPixelatedTile(src: string, size: keyof typeof pixelTileTargetSize): Promise<string> {
  const cacheKey = getPixelTileCacheKey(src, size);
  const cached = pixelTileCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const pending = pixelTilePending.get(cacheKey);
  if (pending) return pending;

  const { width, height } = pixelTileTargetSize[size];
  const renderScale = pixelTileRenderScale[size];
  const sharpenAmount = pixelTileSharpenAmount[size];
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

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.clearRect(0, 0, renderWidth, renderHeight);
        context.drawImage(image, 0, 0, renderWidth, renderHeight);
        applySharpen(context, renderWidth, renderHeight, sharpenAmount);

        const pixelated = canvas.toDataURL('image/png');
        pixelTileCache.set(cacheKey, pixelated);
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
