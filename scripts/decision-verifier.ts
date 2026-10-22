import { TILES, setTiles, type HandContext, type TileId } from '../src/engine/index.js';
import type { DrawConditions, DecisionCertificate, ExactMetrics } from '../src/decision/solver.js';

/** Independent array/physical-path checker. It never calls production scoring, waits or search. */
export function independentFan(hand: TileId[], fixed: NonNullable<HandContext['fixedSets']> = []): number | null {
  if (hand.length !== 14 - 3 * fixed.length || fixed.some(s => s.kind === 'sequence')) return null;
  const occurrences = (xs: TileId[], t: TileId) => xs.filter(x => x === t).length;
  const all = [...hand, ...fixed.flatMap(setTiles)];
  if (new Set(all).size === 0 || TILES.some(t => occurrences(all, t) > 4)) return null;
  const partitions = (xs: TileId[], pairNeeded: boolean): boolean => {
    if (!xs.length) return !pairNeeded;
    const t = xs[0], count = occurrences(xs, t), remove = (tiles: TileId[]) => { const rest = [...xs]; for (const x of tiles) rest.splice(rest.indexOf(x), 1); return rest; };
    if (pairNeeded && count >= 2 && partitions(remove([t, t]), false)) return true;
    if (count >= 3 && partitions(remove([t, t, t]), pairNeeded)) return true;
    const a = (Number(t[0]) + 1) + t[1] as TileId, b = (Number(t[0]) + 2) + t[1] as TileId;
    return Number(t[0]) < 8 && xs.includes(a) && xs.includes(b) && partitions(remove([t, a, b]), pairNeeded);
  };
  const seven = !fixed.length && [...new Set(hand)].every(t => occurrences(hand, t) % 2 === 0);
  if (!seven && !partitions([...hand].sort(), true)) return null;
  let f = TILES.filter(t => occurrences(all, t) === 4).length;
  if (new Set(all.map(t => t[1])).size === 1) f += 2;
  if (seven) f += 2;
  else {
    const ns = [...new Set(hand)].map(t => occurrences(hand, t));
    if (ns.filter(n => n === 2).length === 1 && ns.every(n => n === 2 || n === 3)) f += 1 + Number(fixed.length === 4);
  }
  return f;
}

export function verifyDecision(ctx: HandContext, model: DrawConditions, maxNodes = 3000000): Pick<DecisionCertificate, 'denominator' | 'options' | 'accepted' | 'recommended' | 'fastest'> {
  const permutations = (n: number, k: number) => { let v = 1n; for (let i = 0; i < k; i++) v *= BigInt(n - i); return v; };
  const fixed = ctx.fixedSets ?? [], memo = new Map<string, bigint[]>(), fanCache = new Map<string, number | null>(), waitCache = new Map<string, boolean>(); let nodes = 0;
  const fan = (hand: TileId[]) => { const key = hand.join(','); if (!fanCache.has(key)) fanCache.set(key, independentFan(hand, fixed)); return fanCache.get(key)!; };
  const ready = (hand: TileId[], bag: TileId[]) => { const key = hand.join(',') + '|' + [...new Set(bag)].join(','); if (waitCache.has(key)) return waitCache.get(key)!; const yes = [...new Set(bag)].some(t => fan([...hand, t].sort()) !== null); waitCache.set(key, yes); return yes; };
  const greater = (a: bigint[], b: bigint[], fast: boolean) => { for (const i of fast ? [3, -4, 0, 1, -2] : [0, 1, -2, 3, -4]) { const d = (a[Math.abs(i)] - b[Math.abs(i)]) * (i < 0 ? -1n : 1n); if (d) return d > 0n; } return false; };
  const visit = (hand: TileId[], bag: TileId[], left: number, fast: boolean, wasReady: boolean): bigint[] => {
    const hit = wasReady || ready(hand, bag), key = [hand.join(','), bag.join(','), left, fast, hit].join('|'); const old = memo.get(key); if (old) return old;
    if (++nodes > maxNodes) throw new Error('Independent enumeration exceeded its budget');
    const tail = permutations(bag.length - 1, left - 1), result = Array<bigint>(9).fill(0n);
    // Indistinguishable physical copies share a continuation, weighted by their multiplicity.
    for (const physicalTile of new Set(bag)) {
      const pos=bag.indexOf(physicalTile),copies=BigInt(bag.filter(t=>t===physicalTile).length);
      const drawn = [...hand, bag[pos]].sort(), rest = bag.filter((_, i) => i !== pos), f = fan(drawn); let choice: bigint[];
      if (f !== null) { const cap = Math.min(3, f); choice = [BigInt(2 ** cap) * tail, tail, tail, tail, hit ? 0n : tail, 0n, 0n, 0n, 0n]; choice[5 + cap] = tail; }
      else if(left===1){
        // No further draw remains: every nonwinning continuation has zero points.
        // Only the existence of a live ready discard can distinguish the tie.
        let live=hit;
        if(!live)for(const discard of new Set(drawn)){const after=[...drawn];after.splice(after.indexOf(discard),1);if(ready(after,rest)){live=true;break;}}
        choice=[0n,0n,2n,live?1n:0n,hit?0n:live?1n:2n,0n,0n,0n,0n];
      }else {
        let best: bigint[] | undefined;
        for (const tile of new Set(drawn)) { const after = [...drawn]; after.splice(after.indexOf(tile), 1); const v = visit(after, rest, left - 1, fast, hit); if (!best || greater(v, best, fast && !hit)) best = v; }
        choice = [...best!]; choice[2] += tail; choice[4] = hit ? 0n : choice[4] + tail;
      }
      for (let i = 0; i < 9; i++) result[i] += copies*choice[i];
    }
    if (hit) { result[3] = permutations(bag.length, left); result[4] = 0n; }
    memo.set(key, result); return result;
  };
  const metrics = (v: bigint[]): ExactMetrics => ({ score: String(v[0]), wins: String(v[1]), winTime: String(v[2]), ready: String(v[3]), readyTime: String(v[4]), fans: v.slice(5).map(String) });
  const options = [...new Set(ctx.hand)].sort((a,b)=>TILES.indexOf(a)-TILES.indexOf(b)).map(tile => { const after = [...ctx.hand].sort(); after.splice(after.indexOf(tile), 1); return { tile, v: visit(after, [...model.bag].sort(), model.horizon, false, false), f: visit(after, [...model.bag].sort(), model.horizon, true, false) }; });
  const best = options.reduce((a, b) => greater(b.v, a.v, false) ? b : a), fastest = options.reduce((a, b) => greater(b.f, a.f, true) ? b : a);
  return { denominator: String(permutations(model.bag.length, model.horizon)), options: options.map(o => ({ tile: o.tile, value: metrics(o.v), fast: metrics(o.f) })), accepted: options.filter(o => o.v[0] === best.v[0]).map(o => o.tile), recommended: best.tile, fastest: fastest.tile };
}
