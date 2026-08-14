import { describe, expect, it } from 'vitest';
import {
  TILE_COLOR_MODES,
  getTileColorMode,
  getTilePaletteLut,
} from '../src/ui/tilePalette';

// DawnBringer-32 palette (full 32 colors).
const DB32 = new Set([
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126',
  '#d9a066', '#eec39a', '#fbf236', '#99e550', '#6abe30', '#37946e',
  '#4b692f', '#524b24', '#323c39', '#3f3f74', '#306082', '#5b6ee1',
  '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba',
  '#8f974a', '#8a6f30',
]);

// The 6 colors actually used by the 27 referenced tile assets (ASSET_AUDIT §2.1).
const ASSET_PALETTE = ['#ffffff', '#696a6a', '#d95763', '#6abe30', '#ac3232', '#000000'];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function intToHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [l1, l2] = la >= lb ? [la, lb] : [lb, la];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('tile palette LUT (runtime 6-color remapping)', () => {
  it('exposes exactly the 5 planned color modes', () => {
    expect([...TILE_COLOR_MODES]).toEqual([
      'normal',
      'high-contrast',
      'protan',
      'deutan',
      'tritan',
    ]);
  });

  it('every mode defines a LUT', () => {
    for (const mode of TILE_COLOR_MODES) {
      expect(getTilePaletteLut(mode)).toBeInstanceOf(Map);
    }
  });

  it('LUT keys stay within the real asset palette', () => {
    const allowed = new Set(ASSET_PALETTE.map((hex) => parseInt(hex.slice(1), 16)));
    for (const mode of TILE_COLOR_MODES) {
      const lut = getTilePaletteLut(mode)!;
      for (const key of lut.keys()) {
        expect(allowed.has(key), `${mode} remaps a non-asset color ${intToHex(key)}`).toBe(true);
      }
    }
  });

  it('all LUT targets are DawnBringer-32 colors', () => {
    for (const mode of TILE_COLOR_MODES) {
      const lut = getTilePaletteLut(mode)!;
      for (const target of lut.values()) {
        expect(DB32.has(intToHex(target)), `${mode} target ${intToHex(target)} not in DB32`).toBe(true);
      }
    }
  });

  it('A11Y-B6: bamboo ink is remapped from #6abe30 (2.33:1) to >= 3:1 in every mode', () => {
    // #6abe30 vs #ffffff was the only WCAG 1.4.11 hard failure in the audit.
    expect(contrastRatio('#6abe30', '#ffffff')).toBeLessThan(3);
    const bambooKey = parseInt('6abe30', 16);
    for (const mode of TILE_COLOR_MODES) {
      const lut = getTilePaletteLut(mode)!;
      const mapped = lut.get(bambooKey);
      expect(mapped, `${mode} must remap the legacy bamboo ink`).toBeDefined();
      const ratio = contrastRatio(intToHex(mapped!), '#ffffff');
      expect(ratio, `${mode} bamboo ink contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('no mode collapses two distinct asset inks onto the same color', () => {
    for (const mode of TILE_COLOR_MODES) {
      const lut = getTilePaletteLut(mode)!;
      const mapped = ASSET_PALETTE.map((hex) => {
        const key = parseInt(hex.slice(1), 16);
        return lut.get(key) ?? key;
      });
      expect(new Set(mapped).size, `${mode} collapses asset colors`).toBe(ASSET_PALETTE.length);
    }
  });

  it('color mode falls back to normal without a document or attribute', () => {
    expect(getTileColorMode()).toBe('normal');
  });
});
