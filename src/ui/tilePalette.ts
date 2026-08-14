/**
 * Runtime palette remapping for the pixel tile assets.
 *
 * The tile PNGs are 4-bit indexed images using exactly 6 colors, all inside
 * DawnBringer-32 (ASSET_AUDIT §2.1/§5.4). That makes it possible to support
 * every color mode with a 6-entry lookup table instead of 81 variant assets.
 *
 * Base palette (as shipped in `resource/mahjong_tiles/`):
 *   #ffffff  tile face
 *   #696a6a  bevel + circle-suit ink
 *   #d95763  character-suit "wan" glyph + accents
 *   #6abe30  bamboo-suit ink (LEGACY: fails WCAG 1.4.11 at 2.33:1)
 *   #ac3232  base plate
 *   #000000  character-suit digit
 *
 * 'normal' remaps the legacy bamboo ink to DB32 #4b692f (6.25:1 vs the white
 * face, up from 2.33:1), which clears the A11Y-B6 asset-side hard failure.
 * Remapped bitmaps are produced by `tileView.createPixelatedTile()`, so PNG
 * files stay untouched and the change is cache-keyed per color mode.
 */

export type TileColorMode = 'normal' | 'high-contrast' | 'protan' | 'deutan' | 'tritan';

export const TILE_COLOR_MODES: readonly TileColorMode[] = [
  'normal',
  'high-contrast',
  'protan',
  'deutan',
  'tritan',
];

const TILE_COLOR_MODE_ATTRIBUTE = 'data-tile-color-mode';

function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

type PaletteSpec = Record<string, string>;

// Source color -> target color, per mode. All targets are DawnBringer-32
// members, chosen as the nearest DB32 color to the Brettel/Vienot LMS
// simulation of the source (audit targets in ASSET_AUDIT §5.2), with
// collisions between suit inks resolved to preserve per-suit identity.
const PALETTE_SPECS: Record<TileColorMode, PaletteSpec> = {
  normal: {
    // A11Y-B6: bamboo ink 2.33:1 -> 6.25:1 vs the white tile face.
    '#6abe30': '#4b692f',
  },
  'high-contrast': {
    // Every ink well above the 3:1 non-text threshold; maximum separation.
    '#d95763': '#ac3232',
    '#696a6a': '#323c39',
    '#6abe30': '#45283c',
    '#ac3232': '#222034',
  },
  protan: {
    '#696a6a': '#847e87',
    '#d95763': '#696a6a',
    '#6abe30': '#df7126',
    '#ac3232': '#524b24',
  },
  deutan: {
    '#696a6a': '#847e87',
    '#d95763': '#8f974a',
    '#6abe30': '#df7126',
    '#ac3232': '#8a6f30',
  },
  tritan: {
    '#696a6a': '#847e87',
    '#d95763': '#ac3232',
    // #639bff (nearest DB32 to the audit simulation #9c9cff) only reaches
    // 2.74:1 vs the white face; #306082 is the next DB32 blue at 7.49:1.
    '#6abe30': '#306082',
    '#ac3232': '#45283c',
  },
};

const PALETTE_LUTS: Record<TileColorMode, Map<number, number>> = Object.fromEntries(
  TILE_COLOR_MODES.map((mode) => [
    mode,
    new Map(
      Object.entries(PALETTE_SPECS[mode]).map(([from, to]) => [hexToInt(from), hexToInt(to)]),
    ),
  ]),
) as Record<TileColorMode, Map<number, number>>;

export function getTilePaletteLut(mode: TileColorMode): Map<number, number> | null {
  return PALETTE_LUTS[mode] ?? null;
}

export function getTileColorMode(): TileColorMode {
  const raw =
    typeof document === 'undefined'
      ? undefined
      : document.documentElement.getAttribute(TILE_COLOR_MODE_ATTRIBUTE);
  return raw && (TILE_COLOR_MODES as readonly string[]).includes(raw) ? (raw as TileColorMode) : 'normal';
}

/**
 * Returns the LUT for the currently active mode, or null when no pixel needs
 * to be remapped (defensive: 'normal' currently remaps the legacy bamboo ink,
 * but a future fully-re-exported asset set could make it a true identity).
 */
export function getActivePaletteLut(): Map<number, number> | null {
  const lut = getTilePaletteLut(getTileColorMode());
  return lut && lut.size > 0 ? lut : null;
}
