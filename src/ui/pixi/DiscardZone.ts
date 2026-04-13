import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Tile } from '../../core/model/tile';
import { createTileSprite, TILE_W, TILE_H, SIDE_H } from './TileSprite';
import { getTileTexture } from './TileTextureCache';

type Direction = 'top' | 'right' | 'bottom' | 'left';

const GAP = 2;
const TRAY_PAD = 6;
const DISCARD_SCALE = 0.72;
const FOCUS_LIFT = 3;

/**
 * Renders a 4-direction discard tray as a Pixi Container.
 * Call setTiles() to update contents without rebuilding the container.
 */
export class DiscardZone extends Container {
    private readonly direction: Direction;
    private readonly maxPerRow: number;
    private tileLayer: Container;

    constructor(direction: Direction, maxPerRow = 8) {
        super();
        this.direction = direction;
        this.maxPerRow = maxPerRow;
        this.tileLayer = new Container();
        this.addChild(this.tileLayer);
    }

    setTiles(tiles: Tile[], focusLast = false): void {
        this.tileLayer.removeChildren();

        const isVertical = this.direction === 'left' || this.direction === 'right';
        const tileW = TILE_W * DISCARD_SCALE;
        const tileH = (TILE_H + SIDE_H) * DISCARD_SCALE;

        tiles.forEach((tile, i) => {
            const isFocus = focusLast && i === tiles.length - 1;
            const tex = getTileTexture(tile);
            const sprite = createTileSprite(tex, isFocus ? 'discard-focus' : 'discard');
            sprite.scale.set(DISCARD_SCALE);

            let col: number, row: number;
            if (isVertical) {
                // For side trays: flow downward, 2 columns
                col = i % 2;
                row = Math.floor(i / 2);
                sprite.x = TRAY_PAD + col * (tileW + GAP);
                sprite.y = TRAY_PAD + row * (tileH + GAP);
            } else {
                // For top/bottom trays: flow right, max maxPerRow columns then wrap
                col = i % this.maxPerRow;
                row = Math.floor(i / this.maxPerRow);
                sprite.x = TRAY_PAD + col * (tileW + GAP);
                sprite.y = TRAY_PAD + row * (tileH + GAP);
            }

            if (isFocus) sprite.y -= FOCUS_LIFT;
            this.tileLayer.addChild(sprite);
        });
    }

    /** Returns the pixel dimensions needed for this zone given tile count */
    getPreferredSize(tileCount: number): { w: number; h: number } {
        const isVertical = this.direction === 'left' || this.direction === 'right';
        const tileW = TILE_W * DISCARD_SCALE;
        const tileH = (TILE_H + SIDE_H) * DISCARD_SCALE;

        if (isVertical) {
            const rows = Math.ceil(tileCount / 2);
            return {
                w: TRAY_PAD * 2 + 2 * tileW + GAP,
                h: TRAY_PAD * 2 + rows * (tileH + GAP),
            };
        } else {
            const cols = Math.min(tileCount, this.maxPerRow);
            const rows = Math.ceil(tileCount / this.maxPerRow);
            return {
                w: TRAY_PAD * 2 + cols * (tileW + GAP),
                h: TRAY_PAD * 2 + rows * (tileH + GAP),
            };
        }
    }
}
