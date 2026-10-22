import { countsOf, setTiles, TILES, validateContext, type HandContext, type TileId } from '../engine/index.js';

export const DECISION_RULES = 'mil-two-suits-base-1';
export const RULE_SOURCE = 'https://mahjong-mil.org/wp-content/uploads/2024/08/Brief_Introduction_to_Bloody_Mahjong-1.pdf';
export type FanItem = { id: string; label: string; fan: number };
export type WinScore = { fan: number; capped: number; points: number; items: FanItem[]; groups: TileId[][]; route: 'normal' | 'seven' };

const suitMemo = new Map<number, boolean>();
function suitComplete(c: number[], start: number, pair: boolean): boolean {
  let code = 0, power = 1, first = -1;
  for (let j = 0; j < 9; j++) { code += c[start + j] * power; power *= 5; if (first < 0 && c[start + j]) first = j; }
  const key = code * 2 + Number(pair), old = suitMemo.get(key); if (old !== undefined) return old;
  if (first < 0) return !pair;
  const i = start + first; let yes = false;
  if (pair && c[i] >= 2) { c[i] -= 2; yes = suitComplete(c, start, false); c[i] += 2; }
  if (!yes && c[i] >= 3) { c[i] -= 3; yes = suitComplete(c, start, pair); c[i] += 3; }
  if (!yes && first < 7 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; yes = suitComplete(c, start, pair); c[i]++; c[i + 1]++; c[i + 2]++; }
  suitMemo.set(key, yes); return yes;
}
export function isWinningCounts(c: number[], fixed = 0): boolean {
  let p = 0, s = 0; for (let i = 0; i < 9; i++) { p += c[i]; s += c[i + 9]; }
  if (p + s !== 14 - fixed * 3) return false;
  if (!fixed && c.every(n => n % 2 === 0)) return true;
  if (p % 3 === 2 && s % 3 === 0) return suitComplete(c, 0, true) && suitComplete(c, 9, false);
  if (p % 3 === 0 && s % 3 === 2) return suitComplete(c, 0, false) && suitComplete(c, 9, true);
  return false;
}

/** MIL hand value only: self-draw bonuses and kong settlements are deliberately outside this training model. */
export function scoreCounts(input: number[], fixedSets: NonNullable<HandContext['fixedSets']> = []): WinScore | null {
  if (input.length !== 18 || input.some(n => !Number.isInteger(n) || n < 0 || n > 4) || fixedSets.length > 4 || fixedSets.some(s => s.kind === 'sequence')) return null;
  const publicCounts = countsOf(fixedSets.flatMap(setTiles));
  if (input.some((n, i) => n + publicCounts[i] > 4) || input.reduce((a, b) => a + b, 0) !== 14 - fixedSets.length * 3) return null;
  if (!isWinningCounts(input, fixedSets.length)) return null;
  const c = [...input], need = 4 - fixedSets.length;
  const meld = (left: number): TileId[][] | null => {
    const i = c.findIndex(n => n > 0);
    if (i < 0) return left === 0 ? [] : null;
    if (!left) return null;
    if (c[i] >= 3) { c[i] -= 3; const rest = meld(left - 1); c[i] += 3; if (rest) return [[TILES[i], TILES[i], TILES[i]], ...rest]; }
    if (i % 9 < 7 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; const rest = meld(left - 1); c[i]++; c[i + 1]++; c[i + 2]++; if (rest) return [TILES.slice(i, i + 3), ...rest]; }
    return null;
  };
  let groups: TileId[][] | null = null;
  for (let i = 0; i < 18 && !groups; i++) if (c[i] >= 2) { c[i] -= 2; const rest = meld(need); c[i] += 2; if (rest) groups = [[TILES[i], TILES[i]], ...rest]; }
  const seven = !fixedSets.length && input.every(n => n % 2 === 0);
  if (!groups && !seven) return null;
  const all = input.map((n, i) => n + publicCounts[i]), items: FanItem[] = [];
  const roots = all.filter(n => n === 4).length;
  if (roots) items.push({ id: 'root', label: '根', fan: roots });
  if (!all.slice(0, 9).some(Boolean) || !all.slice(9).some(Boolean)) items.push({ id: 'flush', label: '清一色', fan: 2 });
  // All-pungs needs a valid all-triplet decomposition, not merely the first normal decomposition.
  const allPungs = input.filter(n => n % 3 === 2).length === 1 && input.every(n => n % 3 === 0 || n === 2);
  let route: WinScore['route'] = 'normal';
  if (seven) { route = 'seven'; items.push({ id: 'seven', label: '七对', fan: 2 }); groups = input.flatMap((n, i) => Array.from({ length: n / 2 }, () => [TILES[i], TILES[i]])); }
  else if (allPungs) { groups = input.flatMap((n,i) => n ? [Array<TileId>(n).fill(TILES[i])] : []); items.push({ id: 'pungs', label: '碰碰胡', fan: 1 }); if (fixedSets.length === 4) items.push({ id: 'single', label: '金钩钓', fan: 1 }); }
  const fan = items.reduce((n, item) => n + item.fan, 0), capped = Math.min(3, fan);
  return { fan, capped, points: 2 ** capped, items, groups: [...groups!, ...fixedSets.map(setTiles)], route };
}

export function scoreHand(context: HandContext): WinScore | null {
  validateContext(context);
  return scoreCounts(countsOf(context.hand), context.fixedSets);
}
