import { Application, Container, Graphics, Ticker } from 'pixi.js';
import type { GameState } from '../../core/model/state';
import type { GameEvent } from '../../core/model/event';
import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { loadAllTileTextures, getTileTexture } from './TileTextureCache';
import { createTileSprite, TILE_W, TILE_H, SIDE_H } from './TileSprite';
import { DiscardZone } from './DiscardZone';
import { OpponentHand } from './OpponentHand';
import { CompassRose } from './CompassRose';
import { Texture } from 'pixi.js';

const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
function easeCubicOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export class MahjongTableScene {
    readonly app: Application;
    private readonly host: HTMLElement;
    private initialized = false;
    private ready = false;

    // Layers (ordered by z)
    private feltLayer!: Graphics;
    private wallLayer!: Container;
    private opponentHandLayer!: Container;
    private discardLayer!: Container;
    private compassLayer!: Container;
    private focusTileLayer!: Container;
    // Pixi objects
    private discardZones!: Map<PlayerId, DiscardZone>;
    private opponentHands!: Map<PlayerId, OpponentHand>;
    private compass!: CompassRose;

    // Animation state
    private animTicker: Ticker | null = null;

    constructor(host: HTMLElement) {
        this.host = host;
        this.app = new Application();
    }

    async init(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        await this.app.init({
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            width: this.host.clientWidth || 800,
            height: this.host.clientHeight || 600,
        });

        this.host.appendChild(this.app.canvas as HTMLCanvasElement);

        await loadAllTileTextures();
        this.buildLayers();
        this.ready = true;
    }

    private buildLayers(): void {
        const stage = this.app.stage;
        stage.removeChildren();

        // Felt layer (decorative table surface drawn by Pixi to reinforce the CSS green)
        this.feltLayer = new Graphics();
        stage.addChild(this.feltLayer);
        this.drawFelt();

        // Wall layer
        this.wallLayer = new Container();
        stage.addChild(this.wallLayer);

        // Opponent hand layer
        this.opponentHandLayer = new Container();
        stage.addChild(this.opponentHandLayer);

        // Discard layer
        this.discardLayer = new Container();
        stage.addChild(this.discardLayer);

        // Compass layer (center)
        this.compassLayer = new Container();
        stage.addChild(this.compassLayer);

        // Focus tile (last discard highlight in center)
        this.focusTileLayer = new Container();
        stage.addChild(this.focusTileLayer);

        // Build discard zones
        this.discardZones = new Map([
            ['P0', new DiscardZone('bottom', 8)],
            ['P1', new DiscardZone('right', 8)],
            ['P2', new DiscardZone('top', 8)],
            ['P3', new DiscardZone('left', 8)],
        ]);
        for (const zone of this.discardZones.values()) this.discardLayer.addChild(zone);

        // Opponent hands (P1, P2, P3 only — P0 is the human)
        this.opponentHands = new Map([
            ['P1', new OpponentHand('right')],
            ['P2', new OpponentHand('top')],
            ['P3', new OpponentHand('left')],
        ]);
        for (const hand of this.opponentHands.values()) this.opponentHandLayer.addChild(hand);

        // Compass rose
        this.compass = new CompassRose();
        this.compassLayer.addChild(this.compass);

        this.layoutAll();
    }

    private drawFelt(): void {
        const { width, height } = this.app.renderer;
        this.feltLayer.clear();
        // Inner felt ring highlight (vignette on existing CSS background)
        this.feltLayer.roundRect(20, 20, width - 40, height - 40, 26);
        this.feltLayer.stroke({ color: 0x60c888, width: 1, alpha: 0.12 });
        // Center table line
        this.feltLayer.roundRect(60, 60, width - 120, height - 120, 20);
        this.feltLayer.stroke({ color: 0x50b878, width: 0.5, alpha: 0.08 });
    }

    private layoutAll(state?: GameState): void {
        const W = this.app.renderer.width;
        const H = this.app.renderer.height;

        // ------ Compass rose (center) ------
        const compassSize = CompassRose.SIZE;
        this.compass.x = W / 2 - compassSize / 2;
        this.compass.y = H / 2 - compassSize / 2;

        // ------ Discard zones ------
        // Keep all discard piles clustered in the middle so they read as one table area.
        const centerX = W / 2;
        const centerY = H / 2;
        const horizontalGap = 72;
        const verticalGap = 22;
        const topSafeY = 188;
        const bottomSafeInset = W < 900 ? 292 : 320;

        const topZone = this.discardZones.get('P2')!;
        const topSize = topZone.getPreferredSize(state?.discards.P2.length ?? 0);
        topZone.x = centerX - topSize.w / 2;
        topZone.y = Math.max(topSafeY, centerY - compassSize / 2 - topSize.h - verticalGap);

        const botZone = this.discardZones.get('P0')!;
        const botSize = botZone.getPreferredSize(state?.discards.P0.length ?? 0);
        botZone.x = centerX - botSize.w / 2;
        botZone.y = Math.min(
            centerY + compassSize / 2 + verticalGap,
            H - bottomSafeInset - botSize.h,
        );

        const leftZone = this.discardZones.get('P3')!;
        const leftSize = leftZone.getPreferredSize(state?.discards.P3.length ?? 0);
        leftZone.x = centerX - compassSize / 2 - leftSize.w - horizontalGap;
        leftZone.y = centerY - leftSize.h / 2;

        const rightZone = this.discardZones.get('P1')!;
        const rightSize = rightZone.getPreferredSize(state?.discards.P1.length ?? 0);
        rightZone.x = centerX + compassSize / 2 + horizontalGap;
        rightZone.y = centerY - rightSize.h / 2;

        // ------ Opponent hands ------
        // Leave room above P2 for the seat chip and exposed melds.
        const topHand = this.opponentHands.get('P2')!;
        const topHandSize = topHand.getSize();
        topHand.x = centerX - topHandSize.w / 2;
        topHand.y = 76;

        // P3 (left): vertical, left side
        const leftHand = this.opponentHands.get('P3')!;
        leftHand.x = 18;
        leftHand.y = centerY - leftHand.getSize().h / 2;

        // P1 (right): vertical, right side
        const rightHand = this.opponentHands.get('P1')!;
        rightHand.x = W - 18 - TILE_W;
        rightHand.y = centerY - rightHand.getSize().h / 2;

    }

    update(state: GameState | null, evs: GameEvent[]): void {
        if (!state || !this.ready) return;

        const chengdu = state as any;

        // Compass active player
        this.compass.setActivePlayer(state.currentPlayer);

        // Opponent hands
        for (const pid of ['P1', 'P2', 'P3'] as PlayerId[]) {
            this.opponentHands.get(pid)?.setCount(state.hands[pid].length);
        }
        // Re-layout after count change (heights change for vertical hands)
        this.layoutAll(state);

        // Discard zones
        for (const pid of PLAYERS) {
            const zone = this.discardZones.get(pid)!;
            const focusLast = state.lastDiscard?.from === pid;
            zone.setTiles(state.discards[pid] ?? [], focusLast);
        }

        // The active discard stays highlighted inside its owner's pile.
        // Avoid rendering a separate oversized center tile that blocks the table.
        this.focusTileLayer.removeChildren();

    }

    async animateDiscard(tile: Tile, fromY: number, targetX: number, targetY: number): Promise<void> {
        if (!this.initialized) return;
        const tex = getTileTexture(tile);
        const sprite = createTileSprite(tex, 'discard');
        const W = this.app.renderer.width;
        const startX = W / 2 - TILE_W / 2;
        const startY = fromY;
        sprite.x = startX;
        sprite.y = startY;
        this.focusTileLayer.addChild(sprite);

        const duration = 0.35;
        let elapsed = 0;

        await new Promise<void>((resolve) => {
            const ticker = new Ticker();
            ticker.add((dt) => {
                elapsed += dt.deltaTime / 60;
                const t = Math.min(elapsed / duration, 1);
                const et = easeCubicOut(t);
                sprite.x = lerp(startX, targetX, et);
                sprite.y = lerp(startY, targetY, et);
                sprite.alpha = t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1;
                if (t >= 1) {
                    this.focusTileLayer.removeChild(sprite);
                    ticker.destroy();
                    resolve();
                }
            });
            ticker.start();
        });
    }

    resize(w: number, h: number): void {
        if (!this.ready) return;
        this.app.renderer.resize(w, h);
        this.drawFelt();
        this.layoutAll();
    }

    destroy(): void {
        if (!this.initialized) return;
        this.ready = false;
        this.app.destroy(true);
        this.initialized = false;
    }
}
