import { analyze, countsOf, setTiles, shanten, TILES, type HandContext, type TileId } from '../engine/index.js';
import { scoreCounts } from '../decision/score.js';

export const SCENARIO_VERSION = 'record-world-1' as const;
export type World = { id: string; weight: number; opponent: TileId[]; others: [TileId[], TileId[]]; wall: TileId[]; previousDraw?: TileId };
export type ScenarioModel = { version: typeof SCENARIO_VERSION; worlds: World[]; draws: number; observedDiscard?: TileId; policy: 'shape-first' | 'draw-discard'; };
export type WorldEvent = { actor: 'you' | 'opponent' | 'right' | 'left'; kind: 'draw' | 'discard' | 'win'; tile: TileId; hidden?: boolean };
export type Ending = 'you' | 'opponent' | 'draw' | 'unfinished';
export type WorldOutcome = { worldId: string; kind: Ending; points: number; events: WorldEvent[] };
export type ScenarioOption = { tile: TileId; score: string; wins: string; losses: string; draws: string; outcomes: WorldOutcome[] };
export type ScenarioCertificate = { version: typeof SCENARIO_VERSION; denominator: string; prior: { id: string; weight: number; compatible: boolean }[]; options: ScenarioOption[]; accepted: TileId[]; recommended: TileId; nodes: number };
type State = { world: World; opponent: TileId[]; position: number; events: WorldEvent[]; };
type Metrics = { score: bigint; wins: bigint; losses: bigint; draws: bigint; outcomes: WorldOutcome[] };
const zero = (): Metrics => ({ score: 0n, wins: 0n, losses: 0n, draws: 0n, outcomes: [] });
const remove = (hand: TileId[], tile: TileId) => { const next = [...hand], at = next.indexOf(tile); if (at < 0) throw Error('牌不在手中。'); next.splice(at, 1); return next; };

/** The opponent never sees a wall or the player's hand. Ties use the printed tile order. */
export function opponentDiscard(hand: TileId[], drawn: TileId, policy: ScenarioModel['policy']): TileId {
  if (policy === 'draw-discard') return drawn;
  const counts=countsOf(hand);let best=99,discard=hand[0];
  for(let i=0;i<18;i++)if(counts[i]){counts[i]--;const distance=shanten(counts);counts[i]++;if(distance<best){best=distance;discard=TILES[i];}}
  return discard;
}
export function compatibleWorld(world: World, model: ScenarioModel): boolean {
  return !model.observedDiscard || !scoreCounts(countsOf([...world.opponent, model.observedDiscard])) && opponentDiscard([...world.opponent, model.observedDiscard], world.previousDraw ?? model.observedDiscard, model.policy) === model.observedDiscard;
}
export function validateScenario(context: HandContext, model: ScenarioModel) {
  analyze(context);
  if (context.hand.length !== 14 - 3 * (context.fixedSets?.length ?? 0) || context.fixedSets?.some(s => s.kind === 'sequence') || scoreCounts(countsOf(context.hand), context.fixedSets)) throw Error('局面必须从合法的未和牌舍牌时刻开始。');
  if (model.version !== SCENARIO_VERSION || !['shape-first', 'draw-discard'].includes(model.policy) || !Number.isInteger(model.draws) || model.draws < 1 || model.draws > 16 || !Array.isArray(model.worlds) || !model.worlds.length || model.worlds.length > 128) throw Error('有限局面模型无效。');
  const ids = new Set<string>();
  for (const w of model.worlds) {
    if (!w.id || ids.has(w.id) || !Number.isSafeInteger(w.weight) || w.weight < 1 || w.weight > 10000 || w.opponent.length !== 13 || w.others.length !== 2 || w.others.some(h => h.length !== 13) || !w.wall.length || model.draws > w.wall.length || [...w.opponent, ...w.others.flat(), ...w.wall].some(t => !TILES.includes(t))) throw Error('候选世界无效。');
    ids.add(w.id);
    const all = countsOf([...context.hand, ...(context.fixedSets ?? []).flatMap(setTiles), ...w.opponent, ...w.others.flat(), ...w.wall]);
    for (let i = 0; i < 18; i++) if (all[i] + (context.visible?.[TILES[i]] ?? 0) !== 4) throw Error('候选世界必须恰好包含同一副72张牌。');
    if (model.observedDiscard && (!(context.visible?.[model.observedDiscard]) || !w.previousDraw || ![...w.opponent, model.observedDiscard].includes(w.previousDraw))) throw Error('公开行动无法重建。');
  }
  if (!model.worlds.some(w => compatibleWorld(w, model))) throw Error('公开行动排除了全部候选。');
}

/** Exact belief-state search. A future action is shared by all worlds with the same observations. */
export function solveScenario(context: HandContext, model: ScenarioModel, budget = 500000): ScenarioCertificate {
  validateScenario(context, model);
  const prior = model.worlds.map(w => ({ id: w.id, weight: w.weight, compatible: compatibleWorld(w, model) }));
  const active = model.worlds.filter((_, i) => prior[i].compatible), fixed = context.fixedSets ?? [];
  let nodes = 0;
  const points = (hand: TileId[], own: boolean) => scoreCounts(countsOf(hand), own ? fixed : [])?.points ?? 0;
  const terminal = (s: State, kind: Ending, value: number): Metrics => ({ score: BigInt(s.world.weight * value), wins: BigInt(kind === 'you' ? s.world.weight : 0), losses: BigInt(kind === 'opponent' ? s.world.weight : 0), draws: BigInt(kind === 'draw' ? s.world.weight : 0), outcomes: [{ worldId: s.world.id, kind, points: value, events: s.events }] });
  const merge = (to: Metrics, from: Metrics) => { to.score += from.score; to.wins += from.wins; to.losses += from.losses; to.draws += from.draws; to.outcomes.push(...from.outcomes); };
  const advance = (hand: TileId[], states: State[], discard: TileId): Metrics => {
    if (++nodes > budget) throw Error('局面精确搜索超过预算，禁止发布。');
    const after = remove(hand, discard), result = zero(), groups = new Map<string, { hand: TileId[]; states: State[] }>();
    for (const original of states) {
      const s: State = { ...original, opponent: [...original.opponent], events: [...original.events, { actor: 'you', kind: 'discard', tile: discard }] };
      const ron = points([...s.opponent, discard], false);
      if (ron) { s.events.push({ actor: 'opponent', kind: 'win', tile: discard }); merge(result, terminal(s, 'opponent', -ron)); continue; }
      let finished = false, observation = '';
      for (let turn = 1; turn <= 4; turn++) {
        if (s.position >= model.draws || s.position >= s.world.wall.length) { merge(result, terminal(s, s.position === s.world.wall.length ? 'draw' : 'unfinished', 0)); finished = true; break; }
        const tile = s.world.wall[s.position++], actor = (['you', 'right', 'opponent', 'left'] as const)[turn % 4];
        s.events.push({ actor, kind: 'draw', tile, hidden: actor !== 'you' });
        if (actor === 'you') {
          const next = [...after, tile], won = points(next, true);
          if (won) { s.events.push({ actor, kind: 'win', tile }); merge(result, terminal(s, 'you', won)); finished = true; break; }
          observation += ':draw:' + tile;
          const group = groups.get(observation) ?? { hand: next, states: [] }; group.states.push(s); groups.set(observation, group); finished = true; break;
        }
        if (actor === 'opponent') {
          s.opponent.push(tile); const won = points(s.opponent, false);
          if (won) { s.events.push({ actor, kind: 'win', tile }); merge(result, terminal(s, 'opponent', -won)); finished = true; break; }
          const out = opponentDiscard(s.opponent, tile, model.policy); s.opponent = remove(s.opponent, out);
          s.events.push({ actor, kind: 'discard', tile: out }); observation += ':opponent:' + out;
        } else { s.events.push({ actor, kind: 'discard', tile }); observation += ':' + actor + ':' + tile; }
      }
      if (!finished) throw Error('局面事件未完成。');
    }
    for (const group of groups.values()) {
      let best: Metrics | undefined;
      for (const tile of TILES.filter(t => group.hand.includes(t))) { const m = advance(group.hand, group.states, tile); if (!best || m.score > best.score || m.score === best.score && m.wins > best.wins) best = m; }
      merge(result, best!);
    }
    return result;
  };
  const states = active.map(world => ({ world, opponent: [...world.opponent], position: 0, events: [] }));
  const options = TILES.filter(t => context.hand.includes(t)).map(tile => { const m = advance(context.hand, states, tile); return { tile, score: String(m.score), wins: String(m.wins), losses: String(m.losses), draws: String(m.draws), outcomes: m.outcomes }; });
  const best = options.reduce((a, b) => BigInt(b.score) > BigInt(a.score) || b.score === a.score && BigInt(b.wins) > BigInt(a.wins) ? b : a);
  return { version: SCENARIO_VERSION, denominator: String(active.reduce((n, w) => n + w.weight, 0)), prior, options, accepted: options.filter(o => o.score === best.score).map(o => o.tile), recommended: best.tile, nodes };
}

export function realizedOutcome(certificate: ScenarioCertificate, answer: TileId, seed: number): WorldOutcome {
  const option = certificate.options.find(o => o.tile === answer); if (!option) throw Error('舍牌不在当前手牌中。');
  const active = certificate.prior.filter(w => w.compatible), total = active.reduce((n, w) => n + w.weight, 0);
  let pick = (seed >>> 0) % total;
  for (const w of active) { if (pick < w.weight) return option.outcomes.find(o => o.worldId === w.id)!; pick -= w.weight; }
  throw Error('隐藏状态无法重建。');
}
