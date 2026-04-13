import { Assets, Texture } from 'pixi.js';
import type { Tile } from '../../core/model/tile';

// Mirror the path structure from tileView.ts imports (Vite resolves them to hashed URLs at build,
// but during dev they are served from /resource/png/...)
// We use the same logical paths; Vite's ?url import trick: use direct string paths with Assets.load.
const buildTilePath = (filename: string): string => `/resource/png/${filename}`;

const RAW_MAP: Record<string, string> = {
    'W1': buildTilePath('08-characters-1.png'),
    'W2': buildTilePath('09-characters-2.png'),
    'W3': buildTilePath('10-characters-3.png'),
    'W4': buildTilePath('11-characters-4.png'),
    'W5': buildTilePath('12-characters-5.png'),
    'W6': buildTilePath('13-characters-6.png'),
    'W7': buildTilePath('14-characters-7.png'),
    'W8': buildTilePath('15-characters-8.png'),
    'W9': buildTilePath('16-characters-9.png'),
    'T1': buildTilePath('17-circles-1.png'),
    'T2': buildTilePath('18-circles-2.png'),
    'T3': buildTilePath('19-circles-3.png'),
    'T4': buildTilePath('20-circles-4.png'),
    'T5': buildTilePath('21-circles-5.png'),
    'T6': buildTilePath('22-circles-6.png'),
    'T7': buildTilePath('23-circles-7.png'),
    'T8': buildTilePath('24-circles-8.png'),
    'T9': buildTilePath('25-circles-9.png'),
    'B1': buildTilePath('26-bamboos-1.png'),
    'B2': buildTilePath('27-bamboos-2.png'),
    'B3': buildTilePath('28-bamboos-3.png'),
    'B4': buildTilePath('29-bamboos-4.png'),
    'B5': buildTilePath('30-bamboos-5.png'),
    'B6': buildTilePath('31-bamboos-6.png'),
    'B7': buildTilePath('32-bamboos-7.png'),
    'B8': buildTilePath('33-bamboos-8.png'),
    'B9': buildTilePath('34-bamboos-9.png'),
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
