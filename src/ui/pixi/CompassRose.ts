import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { PlayerId } from '../../core/model/types';

const WIND_LABELS: Record<PlayerId, string> = {
    P0: '南',
    P1: '西',
    P2: '北',
    P3: '东',
};

// Positions on the circle (angle in degrees, 0 = right, CW)
const WIND_ANGLES: Record<PlayerId, number> = {
    P2: -90, // North → top
    P1: 0,   // West → right  (our right = P1's seat)
    P0: 90,  // South → bottom
    P3: 180, // East → left
};

const RADIUS = 44;
const CENTER = 54; // canvas space center (x and y)

export class CompassRose extends Container {
    private readonly rings: Graphics;
    private readonly windTexts: Map<PlayerId, Text> = new Map();
    private readonly activeGlow: Graphics;
    private currentActive: PlayerId | null = null;

    constructor() {
        super();

        // Outer decorative ring
        this.rings = new Graphics();
        this.drawRings();
        this.addChild(this.rings);

        // Active-player glow circle (hidden initially)
        this.activeGlow = new Graphics();
        this.addChild(this.activeGlow);

        // Wind labels
        const labelStyle = new TextStyle({
            fontFamily: 'Noto Sans SC, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            fill: 0xe8e0d4,
        });

        for (const [pid, angle] of Object.entries(WIND_ANGLES) as [PlayerId, number][]) {
            const rad = (angle * Math.PI) / 180;
            const lx = CENTER + RADIUS * Math.cos(rad);
            const ly = CENTER + RADIUS * Math.sin(rad);

            const text = new Text({ text: WIND_LABELS[pid], style: labelStyle });
            text.anchor.set(0.5, 0.5);
            text.x = lx;
            text.y = ly;
            this.windTexts.set(pid, text);
            this.addChild(text);
        }

        // Center dot
        const dot = new Graphics();
        dot.circle(CENTER, CENTER, 5);
        dot.fill({ color: 0x70f0c0, alpha: 0.6 });
        dot.circle(CENTER, CENTER, 3);
        dot.fill({ color: 0xb0fff0, alpha: 0.9 });
        this.addChild(dot);
    }

    private drawRings(): void {
        this.rings.clear();

        // Outer ring
        this.rings.circle(CENTER, CENTER, RADIUS + 10);
        this.rings.stroke({ color: 0x70d0a0, width: 1, alpha: 0.3 });

        // Mid ring
        this.rings.circle(CENTER, CENTER, RADIUS + 4);
        this.rings.stroke({ color: 0x90e0b8, width: 0.5, alpha: 0.2 });

        // Cardinal tick marks
        for (let i = 0; i < 4; i++) {
            const angle = (i * 90 * Math.PI) / 180;
            const x1 = CENTER + (RADIUS + 5) * Math.cos(angle);
            const y1 = CENTER + (RADIUS + 5) * Math.sin(angle);
            const x2 = CENTER + (RADIUS + 10) * Math.cos(angle);
            const y2 = CENTER + (RADIUS + 10) * Math.sin(angle);
            this.rings.moveTo(x1, y1);
            this.rings.lineTo(x2, y2);
            this.rings.stroke({ color: 0x80d8a8, width: 1.5, alpha: 0.4 });
        }

        // Diagonal tick marks (lighter)
        for (let i = 0; i < 4; i++) {
            const angle = ((i * 90 + 45) * Math.PI) / 180;
            const x1 = CENTER + (RADIUS + 6) * Math.cos(angle);
            const y1 = CENTER + (RADIUS + 6) * Math.sin(angle);
            const x2 = CENTER + (RADIUS + 10) * Math.cos(angle);
            const y2 = CENTER + (RADIUS + 10) * Math.sin(angle);
            this.rings.moveTo(x1, y1);
            this.rings.lineTo(x2, y2);
            this.rings.stroke({ color: 0x80d8a8, width: 0.8, alpha: 0.2 });
        }
    }

    setActivePlayer(playerId: PlayerId): void {
        if (this.currentActive === playerId) return;
        this.currentActive = playerId;

        // Reset all label styles
        const normalStyle = new TextStyle({
            fontFamily: 'Noto Sans SC, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            fill: 0xe8e0d4,
        });
        const activeStyle = new TextStyle({
            fontFamily: 'Noto Sans SC, system-ui, sans-serif',
            fontSize: 15,
            fontWeight: 'bold',
            fill: 0x9dfff0,
        });

        for (const [pid, text] of this.windTexts) {
            text.style = pid === playerId ? activeStyle : normalStyle;
        }

        // Draw glow circle at active wind position
        this.activeGlow.clear();
        const angle = (WIND_ANGLES[playerId] * Math.PI) / 180;
        const gx = CENTER + RADIUS * Math.cos(angle);
        const gy = CENTER + RADIUS * Math.sin(angle);
        this.activeGlow.circle(gx, gy, 14);
        this.activeGlow.fill({ color: 0x70ffe8, alpha: 0.15 });
        this.activeGlow.circle(gx, gy, 14);
        this.activeGlow.stroke({ color: 0x70ffe8, width: 1.5, alpha: 0.45 });
    }

    /** Total pixel size of this component */
    static readonly SIZE = CENTER * 2;
}
