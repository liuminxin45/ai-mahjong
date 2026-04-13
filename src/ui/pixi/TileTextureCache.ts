import { Assets, Texture } from 'pixi.js';
import type { Tile } from '../../core/model/tile';

// Mirror the path structure from tileView.ts imports (Vite resolves them to hashed URLs at build,
// but during dev they are served from /resource/mahjong_tiles/...)
// We use the same logical paths; Vite's ?url import trick: use direct string paths with Assets.load.
const buildTilePath = (filename: string): string => `/resource/mahjong_tiles/${filename}`;

const RAW_MAP: Record<string, string> = {
    'W1': buildTilePath('Characters1.png'),
    'W2': buildTilePath('Characters2.png'),
    'W3': buildTilePath('Characters3.png'),
    'W4': buildTilePath('Characters4.png'),
    'W5': buildTilePath('Characters5.png'),
    'W6': buildTilePath('Characters6.png'),
    'W7': buildTilePath('Characters7.png'),
    'W8': buildTilePath('Characters8.png'),
    'W9': buildTilePath('Characters9.png'),
    'T1': buildTilePath('Circles1.png'),
    'T2': buildTilePath('Circles2.png'),
    'T3': buildTilePath('Circles3.png'),
    'T4': buildTilePath('Circles4.png'),
    'T5': buildTilePath('Circles5.png'),
    'T6': buildTilePath('Circles6.png'),
    'T7': buildTilePath('Circles7.png'),
    'T8': buildTilePath('Circles8.png'),
    'T9': buildTilePath('Circles9.png'),
    'B1': buildTilePath('Bamboo1.png'),
    'B2': buildTilePath('Bamboo2.png'),
    'B3': buildTilePath('Bamboo3.png'),
    'B4': buildTilePath('Bamboo4.png'),
    'B5': buildTilePath('Bamboo5.png'),
    'B6': buildTilePath('Bamboo6.png'),
    'B7': buildTilePath('Bamboo7.png'),
    'B8': buildTilePath('Bamboo8.png'),
    'B9': buildTilePath('Bamboo9.png'),
};

const cache: Map<string, Texture> = new Map();
let loaded = false;

export async function loadAllTileTextures(): Promise<void> {
    if (loaded) return;
    const entries = Object.entries(RAW_MAP);
    await Promise.all(
        entries.map(async ([key, path]) => {
            try {
                const tex: Texture = await Assets.load(path);
                cache.set(key, tex);
            } catch {
                // Fallback: white texture if image fails
                cache.set(key, Texture.WHITE);
            }
        }),
    );
    loaded = true;
}

export function getTileTexture(tile: Tile): Texture {
    const key = `${tile.suit}${tile.rank}`;
    return cache.get(key) ?? Texture.WHITE;
}

export function isLoaded(): boolean {
    return loaded;
}
