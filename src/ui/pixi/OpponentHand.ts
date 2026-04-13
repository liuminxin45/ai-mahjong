import { Container } from 'pixi.js';
import { createTileSprite, TILE_W, TILE_H, SIDE_H } from './TileSprite';
import { Texture } from 'pixi.js';

type Direction = 'top' | 'left' | 'right';

const SCALE = 0.58; // shrink opponent tiles so they don't overflow the table
const GAP_H = 1;
const GAP_V = 1;
const MAX_PER_ROW = 7;

/**
 * Shows N face-down tiles representing an opponent's hand.
 * Direction controls layout:
 *   top   → horizontal rows (wraps at MAX_PER_ROW)
 *   left  → vertical column
 *   right → vertical column
 */
export class OpponentHand extends Container {
    private readonly direction: Direction;
    private count = 0;

    constructor(direction: Direction) {
        super();
        this.direction = direction;
    }

    setCount(n: number): void {
        if (n === this.count) return;
        this.count = n;
        this.rebuild();
    }

    private rebuild(): void {
        this.removeChildren();

        const tileW = TILE_W * SCALE;
        const tileH = (TILE_H + SIDE_H) * SCALE;

        for (let i = 0; i < this.count; i++) {
            const sprite = createTileSprite(Texture.EMPTY, 'back');
            sprite.scale.set(SCALE);

            if (this.direction === 'top') {
                const col = i % MAX_PER_ROW;
                const row = Math.floor(i / MAX_PER_ROW);
                sprite.x = col * (tileW + GAP_H);
                sprite.y = row * (tileH + GAP_V);
            } else {
                sprite.x = 0;
                sprite.y = i * (tileH + GAP_V);
            }

            this.addChild(sprite);
        }
    }

    /** Returns bounding size for layout calculations */
    getSize(): { w: number; h: number } {
        const tileW = TILE_W * SCALE;
        const tileH = (TILE_H + SIDE_H) * SCALE;

        if (this.direction === 'top') {
            const cols = Math.min(this.count, MAX_PER_ROW);
            const rows = Math.max(1, Math.ceil(this.count / MAX_PER_ROW));
            return { w: cols * (tileW + GAP_H), h: rows * (tileH + GAP_V) };
        } else {
            return { w: tileW, h: this.count * (tileH + GAP_V) };
        }
    }
}
