export const ARTWORK_VERSION = '7522fdb84290ee3c';
export function artworkSize() { return typeof window !== 'undefined' && window.devicePixelRatio > 1.25 ? 192 : 96; }
const prepared = new Map<string,string>();
export function registerTileImage(url:string,blob:Blob){if(!prepared.has(url))prepared.set(url,URL.createObjectURL(blob));}
export function tileImageUrl(base: string, tile: string) { const url=`${base}/${tile}-${artworkSize()}.webp`;return prepared.get(url)??url; }
const decoded = new Map<string, { image: HTMLImageElement; ready: Promise<void> }>();
export function preloadTiles(base: string, tiles: readonly string[]): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all([...new Set(tiles)].map(tile => {
    const url = tileImageUrl(base, tile), old = decoded.get(url); if (old) return old.ready;
    const image = new Image(); image.decoding = 'async';
    const ready = new Promise<void>((resolve, reject) => {
      image.onload = () => { image.decode().then(resolve, reject); };
      image.onerror = () => reject(new Error('有几张牌没有打开，请再试一次。'));
      image.src = url;
    }).catch(error => { decoded.delete(url); throw error; });
    decoded.set(url, { image, ready }); return ready;
  })).then(() => {});
}
