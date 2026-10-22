import { countsOf, setTiles, TILES, validateContext, type HandContext, type TileId } from '../engine/index.js';
import { DECISION_RULES, isWinningCounts, scoreCounts } from './score.js';

export const DECISION_MODEL = 'finite-discard-1';
export type DrawConditions = { version: typeof DECISION_MODEL; kind: 'remaining' | 'explicit'; bag: TileId[]; horizon: number };
export type ExactMetrics = { score: string; wins: string; winTime: string; ready: string; readyTime: string; fans: string[] };
export type DecisionOption = { tile: TileId; value: ExactMetrics; fast: ExactMetrics };
export type StrategyBranch = { discard: TileId; draw: TileId; won: boolean; next: TileId[] };
export type DecisionCertificate = { version: 1; rules: typeof DECISION_RULES; denominator: string; options: DecisionOption[]; accepted: TileId[]; recommended: TileId; fastest: TileId; branches: StrategyBranch[]; nodes: number };
type Vector = bigint[]; // score, win mass, truncated win time, ready mass, truncated ready time, capped-fan masses
const falling = (n: number, h: number) => { let v = 1n; for (let i = 0; i < h; i++) v *= BigInt(n - i); return v; };
const fields = (v: Vector): ExactMetrics => ({ score: String(v[0]), wins: String(v[1]), winTime: String(v[2]), ready: String(v[3]), readyTime: String(v[4]), fans: v.slice(5).map(String) });
const better = (a: Vector, b: Vector, fast: boolean) => {
  const order = fast ? [3, -4, 0, 1, -2] : [0, 1, -2, 3, -4];
  for (const key of order) { const i = Math.abs(key), sign = key < 0 ? -1n : 1n, difference = (a[i] - b[i]) * sign; if (difference) return difference > 0n; }
  return false;
};
export function remainingBag(ctx: HandContext): TileId[] {
  const known = countsOf([...ctx.hand, ...(ctx.fixedSets ?? []).flatMap(setTiles)]);
  return TILES.flatMap((t, i) => Array(Math.max(0, 4 - known[i] - (ctx.visible?.[t] ?? 0))).fill(t));
}
export function validateDecision(ctx: HandContext, model: DrawConditions) {
  validateContext(ctx);
  if (ctx.fixedSets?.some(s => s.kind === 'sequence') || ctx.hand.length !== 14 - (ctx.fixedSets?.length ?? 0) * 3 || scoreCounts(countsOf(ctx.hand), ctx.fixedSets)) throw new Error('舍牌题须为尚未成牌的合法摸牌后手牌，公开组合仅限碰杠。');
  if (model.version !== DECISION_MODEL || !['remaining', 'explicit'].includes(model.kind) || !Number.isInteger(model.horizon) || model.horizon < 1 || model.horizon > 6 || !Array.isArray(model.bag) || model.bag.length < model.horizon) throw new Error('摸牌条件无效。');
  const available = countsOf(remainingBag(ctx)), pool = countsOf(model.bag);
  if (pool.some((n, i) => n > available[i]) || model.kind === 'remaining' && pool.some((n, i) => n !== available[i])) throw new Error('抽牌袋与已知牌不一致。');
}
/** Exact finite-horizon expectimax. No discarded tile ever goes back into the bag. */
export function solveDecision(ctx: HandContext, model: DrawConditions, maxNodes = 3000000): DecisionCertificate {
  validateDecision(ctx, model);
  const c = countsOf(ctx.hand), pool = countsOf(model.bag), fixed = ctx.fixedSets ?? [], scoreCache = new Map<string, ReturnType<typeof scoreCounts>>(), readyCache = new Map<string, boolean>(), memo = new Map<string, Vector>();
  const win = () => { if (!isWinningCounts(c, fixed.length)) return null; const key = c.join(''); if (!scoreCache.has(key)) scoreCache.set(key, scoreCounts(c, fixed)); return scoreCache.get(key)!; };
  const ready = () => { const key = c.join('') + ':' + pool.map(n => n ? '1' : '0').join(''); const old = readyCache.get(key); if (old !== undefined) return old; let yes = false; for (let i = 0; i < 18 && !yes; i++) if (pool[i]) { c[i]++; yes = isWinningCounts(c, fixed.length); c[i]--; } readyCache.set(key, yes); return yes; };
  let nodes = 0;
  const future = (h: number, n: number, fast: boolean, previouslyReady: boolean): Vector => {
    const hit = previouslyReady || ready();
    const key = [h, fast ? 1 : 0, hit ? 1 : 0, c.join(''), pool.join('')].join(':');
    const saved = memo.get(key); if (saved) return saved;
    if (++nodes > maxNodes) throw new Error('精确求解超过节点预算，禁止发布。');
    const den = falling(n, h), tail = falling(n - 1, h - 1), total = Array<bigint>(9).fill(0n);
    for (let i = 0; i < 18; i++) if (pool[i]) {
      const copies = pool[i]; pool[i]--; c[i]++;
      const won = win(); let branch: Vector;
      if (won) { branch = [BigInt(won.points) * tail, tail, tail, tail, hit ? 0n : tail, 0n, 0n, 0n, 0n]; branch[5 + won.capped] = tail; }
      else if (h === 1) {
        let found = hit;
        if (!found) for (let d = 0; d < 18 && !found; d++) if (c[d]) { c[d]--; found = ready(); c[d]++; }
        branch = [0n, 0n, 2n, found ? 1n : 0n, hit ? 0n : found ? 1n : 2n, 0n, 0n, 0n, 0n];
      } else {
        let best: Vector | undefined;
        for (let d = 0; d < 18; d++) if (c[d]) { c[d]--; const candidate = future(h - 1, n - 1, fast, hit); c[d]++; if (!best || better(candidate, best, fast && !hit)) best = candidate; }
        branch = [...best!]; branch[2] += tail; branch[4] = hit ? 0n : branch[4] + tail;
      }
      c[i]--; pool[i]++;
      for (let k = 0; k < total.length; k++) total[k] += BigInt(copies) * branch[k];
    }
    if (hit) { total[3] = den; total[4] = 0n; }
    memo.set(key, total); return total;
  };
  const n = model.bag.length, h = model.horizon, options: DecisionOption[] = [], vectors: { tile: TileId; value: Vector; fast: Vector }[] = [];
  for (let d = 0; d < 18; d++) if (c[d]) { c[d]--; const value = future(h, n, false, false), fast = future(h, n, true, false); c[d]++; vectors.push({ tile: TILES[d], value, fast }); options.push({ tile: TILES[d], value: fields(value), fast: fields(fast) }); }
  const best = vectors.reduce((a, b) => better(b.value, a.value, false) ? b : a), fastest = vectors.reduce((a, b) => better(b.fast, a.fast, true) ? b : a);
  const branches: StrategyBranch[] = [];
  const initial = TILES.indexOf(best.tile); c[initial]--; const hit = ready();
  for (let i = 0; i < 18; i++) if (pool[i]) {
    pool[i]--; c[i]++; const won = !!win(), next: TileId[] = []; let top: Vector | undefined;
    if (!won && h > 1) for (let d = 0; d < 18; d++) if (c[d]) { c[d]--; const v = future(h - 1, n - 1, false, hit); c[d]++; if (!top || better(v, top, false)) { top = v; next.length = 0; next.push(TILES[d]); } else if (!better(top, v, false)) next.push(TILES[d]); }
    branches.push({ discard: best.tile, draw: TILES[i], won, next }); c[i]--; pool[i]++;
  }
  c[initial]++;
  return { version: 1, rules: DECISION_RULES, denominator: String(falling(n, h)), options, accepted: vectors.filter(o => o.value[0] === best.value[0]).map(o => o.tile), recommended: best.tile, fastest: fastest.tile, branches, nodes };
}

export const fraction = (numerator: string, denominator: string) => Number(BigInt(numerator) * 1000000n / BigInt(denominator)) / 1000000;
export const percent = (n: string, d: string) => BigInt(n) > 0n && BigInt(n) * 1000n < BigInt(d) ? '<0.1%' : (fraction(n, d) * 100).toFixed(1) + '%';
export const decimal = (n: string, d: string) => BigInt(n) > 0n && BigInt(n) * 1000n < BigInt(d) ? '<0.001' : fraction(n, d).toFixed(3);
