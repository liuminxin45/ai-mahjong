import { Container, Graphics, Sprite, Texture } from 'pixi.js';

export type TileSpriteVariant = 'face' | 'back' | 'discard' | 'discard-focus';

const TILE_W = 32;
const TILE_H = 46;
const SIDE_H = 6;
const RADIUS = 4;

/**
 * Create a 2.5D tile Container.
 * The sprite sits at (0, 0); total bounding box is (TILE_W × (TILE_H + SIDE_H)).
 */
export function createTileSprite(
    texture: Texture,
    variant: TileSpriteVariant = 'face',
): Container {
    const c = new Container();

    // --- bottom 3D side face ---
    const side = new Graphics();
    side.roundRect(1, TILE_H + 1, TILE_W - 2, SIDE_H - 1, 2);
    if (variant === 'back') {
        side.fill({ color: 0x061208, alpha: 0.95 });
    } else {
        side.fill({ color: 0x6a5c44, alpha: 0.95 });
    }
    side.y = 0;
    c.addChild(side);

    // --- face background ---
    const bg = new Graphics();
    if (variant === 'back') {
        bg.roundRect(0, 0, TILE_W, TILE_H, RADIUS);
        bg.fill({ color: 0x1e4a38, alpha: 1 });
        // cross-hatch pattern lines
        for (let i = 0; i < TILE_W; i += 5) {
            bg.moveTo(i, 0);
            bg.lineTo(i + TILE_H, TILE_H);
            bg.stroke({ color: 0x3a8060, width: 0.5, alpha: 0.15 });
        }
        // inner border
        bg.roundRect(2, 2, TILE_W - 4, TILE_H - 4, RADIUS - 1);
        bg.stroke({ color: 0x4a9870, width: 0.8, alpha: 0.25 });
    } else {
        // ivory face
        bg.roundRect(0, 0, TILE_W, TILE_H, RADIUS);
        bg.fill({ color: 0xfff8ee, alpha: 1 });
        // subtle gradient feel: top strip lighter
        const topStrip = new Graphics();
        topStrip.roundRect(1, 0, TILE_W - 2, 4, RADIUS);
        topStrip.fill({ color: 0xffffff, alpha: 0.45 });
        c.addChild(topStrip);
    }
    c.addChild(bg);

    // --- tile image sprite ---
    if (variant !== 'back' && texture !== Texture.WHITE) {
        const img = new Sprite(texture);
        img.width = TILE_W - 6;
        img.height = TILE_H - 8;
        img.x = 3;
        img.y = 4;
        c.addChild(img);
    }

    // --- border / outline ---
    const border = new Graphics();
    border.roundRect(0, 0, TILE_W, TILE_H, RADIUS);
    if (variant === 'back') {
        border.stroke({ color: 0x50a06e, width: 1, alpha: 0.5 });
    } else if (variant === 'discard-focus') {
        border.stroke({ color: 0xffd700, width: 1.5, alpha: 0.7 });
        // gold glow ring
        const glow = new Graphics();
        glow.roundRect(-3, -3, TILE_W + 6, TILE_H + 6, RADIUS + 2);
        glow.stroke({ color: 0xffcc44, width: 2, alpha: 0.25 });
        c.addChild(glow);
    } else {
        border.stroke({ color: 0xc7bfaa, width: 1, alpha: 0.9 });
    }
    c.addChild(border);

    return c;
}

export { TILE_W, TILE_H, SIDE_H };
