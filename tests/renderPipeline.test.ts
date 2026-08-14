import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const tileViewSource = readFileSync(resolve(root, 'src/ui/components/tileView.ts'), 'utf8');
const legacyCss = readFileSync(resolve(root, 'src/ui/styles/legacy.css'), 'utf8');

// Source tile art is 20x28 px (ASSET_AUDIT §2.1).
const SOURCE_ASPECT = 20 / 28;

interface SizeRule {
  width: number;
  height: number;
  line: number;
  sizes: Array<'xs' | 'sm' | 'md' | 'lg'>;
}

function cssImageRules(source: string): SizeRule[] {
  const rules: SizeRule[] = [];
  // Capture blocks such as:
  //   .pixel-table .mj-tile--xs img, ... { width: 10px; height: 14px; }
  const selectorBlock = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = selectorBlock.exec(source)) !== null) {
    const selectors = match[1];
    const body = match[2];
    if (!/\.mj-tile--(xs|sm|md|lg)\s+img\b/.test(selectors)) continue;
    const width = /width:\s*(\d+)px/.exec(body);
    const height = /height:\s*(\d+)px/.exec(body);
    if (!width || !height) continue;
    const line = source.slice(0, match.index).split('\n').length;
    const sizes = [...selectors.matchAll(/\.mj-tile--(xs|sm|md|lg)\s+img\b/g)].map(
      (m) => m[1] as 'xs' | 'sm' | 'md' | 'lg',
    );
    rules.push({ width: Number(width[1]), height: Number(height[1]), line, sizes });
  }
  return rules;
}

// Integer-px approximation of the 20:28 source aspect. Steps must stay
// strictly inside the audit's worst offender (+14.3% stretch at xs).
function expectAspect20x28(width: number, height: number, label: string): void {
  const error = Math.abs(height / width - 1 / SOURCE_ASPECT) / (1 / SOURCE_ASPECT);
  expect(error, `${label} ${width}x${height} deviates ${(error * 100).toFixed(1)}% from 20:28`).toBeLessThanOrEqual(0.05);
}

describe('render pipeline (ASSET_AUDIT §2.3 P0 fixes)', () => {
  it('tileView size steps keep the exact 20:28 source aspect ratio', () => {
    const sizeBlock = /const pixelTileTargetSize[^=]*= \{([\s\S]*?)\};/m.exec(tileViewSource);
    expect(sizeBlock).not.toBeNull();
    const entries = [...sizeBlock![1].matchAll(/(xs|sm|md|lg):\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/g)];
    expect(entries.map((e) => e[1]).sort()).toEqual(['lg', 'md', 'sm', 'xs']);
    for (const entry of entries) {
      expectAspect20x28(Number(entry[2]), Number(entry[3]), `step ${entry[1]}`);
    }
  });

  it('canvas pipeline disables smoothing and drops the sharpen workaround', () => {
    expect(tileViewSource).toContain('imageSmoothingEnabled = false');
    expect(tileViewSource).not.toContain('imageSmoothingEnabled = true');
    expect(tileViewSource).not.toContain('applySharpen');
  });

  it('pixel tile cache has an eviction bound', () => {
    expect(tileViewSource).toMatch(/PIXEL_TILE_CACHE_LIMIT\s*=\s*\d+/);
    expect(tileViewSource).toContain('pixelTileCache.size > PIXEL_TILE_CACHE_LIMIT');
  });

  it('every CSS display size for tile images keeps the 20:28 aspect', () => {
    const rules = cssImageRules(legacyCss);
    expect(rules.length).toBeGreaterThanOrEqual(8);
    for (const rule of rules) {
      expectAspect20x28(rule.width, rule.height, `legacy.css:${rule.line}`);
    }
  });

  it('xs tile images render at exactly 10x14 everywhere', () => {
    const rules = cssImageRules(legacyCss);
    const xsRules = rules.filter((rule) => rule.sizes.includes('xs'));
    expect(xsRules.length).toBeGreaterThanOrEqual(4);
    for (const rule of xsRules) {
      expect([rule.width, rule.height], `legacy.css:${rule.line}`).toEqual([10, 14]);
    }
  });

  it('no CSS rule forces image-rendering: smooth on tile images', () => {
    const selectorBlock = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = selectorBlock.exec(legacyCss)) !== null) {
      if (!/\.mj-tile[^,{]*\s+img\b/.test(match[1]) && !/\.mj-tile--(xs|sm|md|lg)\s+img\b/.test(match[1])) continue;
      const line = legacyCss.slice(0, match.index).split('\n').length;
      expect(match[2], `legacy.css:${line} still forces smooth scaling on pixel art`).not.toMatch(
        /image-rendering:\s*(auto|smooth)/,
      );
    }
  });
});
