import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { analyze, sorted, TILES, type TileId } from '../src/engine/index.js';
import { decisionQuestions, type DecisionQuestion } from '../src/decision/questions.js';
import { remainingBag, solveDecision } from '../src/decision/solver.js';
import { finishExample } from '../src/decision/example.js';
import { ordinaryProof, challengeKinds, EXPERIENCE_VERSION, type Challenge, type ChallengeKind, type ChallengeProof } from '../src/experience/definitions.js';

mkdirSync('work', { recursive: true });
const target = 'src/experience/catalog.json';
if (existsSync(target) && JSON.parse(readFileSync(target, 'utf8')).groups?.length) throw Error('Published experience catalog is immutable; publish a new edition.');
const checkpoint = 'work/experience-candidates.json';
type Candidate = { question: DecisionQuestion; proof: ChallengeProof };
const saved = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : { done: [], candidates: [] };
const candidates: Candidate[] = saved.candidates, done: string[] = saved.done;
const digest = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function changed(base: DecisionQuestion, tile: TileId, add: number, kind: 'gap' | 'adaptability'): DecisionQuestion | null {
  const context = { ...base.context, visible: { ...base.context.visible, [tile]: (base.context.visible?.[tile] ?? 0) + add } };
  const bag = base.model.kind === 'remaining' ? remainingBag(context) : [...base.model.bag];
  if (base.model.kind === 'explicit') for (let i = 0; i < add; i++) { const at = bag.indexOf(tile); if (at < 0) return null; bag.splice(at, 1); }
  const model = { ...base.model, bag: sorted(bag) };
  if (bag.length < model.horizon) return null;
  const certificate = solveDecision(context, model, 400000);
  if (!BigInt(certificate.options.find(o => o.tile === certificate.recommended)!.value.score) || (kind === 'gap' ? certificate.accepted.some(t => base.certificate.accepted.includes(t)) : certificate.accepted.includes(base.certificate.recommended))) return null;
  const a = analyze(context), shape = { normal: a.normal, sevenPairs: a.sevenPairs, shanten: a.shanten, discards: a.discards };
  const id = EXPERIENCE_VERSION + ':' + base.level + ':' + kind + ':' + base.id.split(':').slice(-2).join('-');
  const { hash: _oldHash, finish: _finish, ...old } = base;
  const payload = { ...old, id, context, model, certificate, shape, skill: kind === 'gap' ? 'dead' as const : 'visible' as const, note: kind === 'gap' ? '先数还在的机会，再决定等哪张。' : '牌形没有变，剩下的机会变了。' };
  const finish = finishExample(payload), teaching = { ...payload, ...(finish ? { finish } : {}) };
  return { ...teaching, hash: digest(teaching) };
}
const originals = decisionQuestions.filter(q => q.pool !== 'example' && q.model.horizon <= 3);
for (const original of originals) {
  if (done.includes(original.id)) continue;
  for (const kind of ['temptation', 'entanglement', 'cost'] as const) { const proof = ordinaryProof(original, kind); if (proof) candidates.push({ question: original, proof }); }
  // Keep counterfactual enumeration bounded; the before and after use the same horizon.
  let base = original;
  if (base.model.horizon > 2) {
    const model = { ...base.model, horizon: 2 }, certificate = solveDecision(base.context, model, 400000);
    base = { ...base, model, certificate };
  }
  const focus = base.shape.discards.find(d => d.tile === base.certificate.recommended)!.improvements.map(x => x.tile);
  const types = [...new Set([...focus, ...base.certificate.branches.map(b => b.draw), ...TILES])];
  for (const kind of ['gap', 'adaptability'] as const) {
    if (candidates.filter(x => x.question.level === original.level && x.proof.kind === kind).length >= 12 || candidates.some(x => x.question.family === original.family && x.proof.kind === kind)) continue;
    for (const tile of types) {
      const n = base.model.bag.filter(t => t === tile).length, add = kind === 'gap' ? n : n - 1;
      if (add <= 0) continue;
      try {
        const q = changed(base, tile, add, kind); if (!q) continue;
        candidates.push({ question: q, proof: { kind, alternative: base.certificate.recommended, tiles: [tile], basis: kind === 'gap' ? (remainingBag(q.context).includes(tile) ? 'bag-absence' : 'seen-out') : 'live-counterfactual', before: base } });
        break;
      } catch { /* Search budgets and illegal variants are never published. */ }
    }
  }
  done.push(original.id); writeFileSync(checkpoint, JSON.stringify({ done, candidates }));
  console.log('Prepared', done.length, '/', originals.length, 'candidates', candidates.length, original.level);
}

// Minimum-cost flow: forty different families, eight witnesses per kind, at most eight transfers.
function choose(level: number) {
  const xs = candidates.filter(x => x.question.level === level), families = [...new Set(xs.map(x => x.question.family))];
  type Edge = { to: number; cap: number; cost: number; back: number; candidate?: Candidate };
  const size = families.length + 9, source = size - 4, practice = size - 3, transfer = size - 2, sink = size - 1, graph: Edge[][] = Array.from({ length: size }, () => []);
  const edge = (a: number, b: number, cap: number, cost = 0, candidate?: Candidate) => { graph[a].push({ to: b, cap, cost, back: graph[b].length, candidate }); graph[b].push({ to: a, cap: 0, cost: -cost, back: graph[a].length - 1 }); };
  edge(source, practice, 40); edge(source, transfer, 8, 1000);
  families.forEach((family, i) => { const pool = xs.find(x => x.question.family === family)!.question.pool; edge(pool === 'transfer' ? transfer : practice, i, 1); for (const kind of challengeKinds) { const item = xs.find(x => x.question.family === family && x.proof.kind === kind); if (item) edge(i, families.length + challengeKinds.indexOf(kind), 1, item.proof.before ? 1 : 0, item); } });
  challengeKinds.forEach((_, i) => edge(families.length + i, sink, 8));
  for (let flow = 0; flow < 40; flow++) {
    const dist = Array(size).fill(Infinity), prev = Array(size).fill(null) as ([number, number] | null)[]; dist[source] = 0;
    for (let pass = 0; pass < size; pass++) { let moved = false; graph.forEach((edges, a) => edges.forEach((e, index) => { if (e.cap && dist[a] + e.cost < dist[e.to]) { dist[e.to] = dist[a] + e.cost; prev[e.to] = [a, index]; moved = true; } })); if (!moved) break; }
    if (!prev[sink]) throw Error('Insufficient distinct witnessed families for stage ' + level + ': ' + flow);
    let node = sink; while (node !== source) { const [a, i] = prev[node]!; const e = graph[a][i]; e.cap--; graph[e.to][e.back].cap++; node = a; }
  }
  return graph.flat().filter(e => e.candidate && !e.cap).map(e => e.candidate!);
}
const selected = [1, 2, 3, 4].flatMap(choose), challenges: Challenge[] = [], groups = [];
for (const level of [1, 2, 3, 4]) {
  const buckets = challengeKinds.map(kind => selected.filter(x => x.question.level === level && x.proof.kind === kind).sort((a, b) => (a.question.pool === 'transfer' ? -1 : 1) - (b.question.pool === 'transfer' ? -1 : 1) || a.question.id.localeCompare(b.question.id)));
  const rows: Candidate[][] = Array.from({ length: 8 }, () => []);
  for (const bucket of buckets) for (const x of bucket) { const row = rows.filter(r => !r.some(y => y.proof.kind === x.proof.kind) && (x.question.pool !== 'transfer' || !r.some(y => y.question.pool === 'transfer'))).sort((a, b) => a.length - b.length)[0]; if (!row) throw Error('Cannot distribute transfers'); row.push(x); }
  rows.forEach((row, i) => {
    const ids = row.map(x => { const id = EXPERIENCE_VERSION + ':challenge:' + level + ':' + i + ':' + x.proof.kind; challenges.push({ id, questionId: x.question.id, kind: x.proof.kind, proof: x.proof }); return id; });
    // The last hand always supplies a legal, precomputed reversal. Earlier four vary in order.
    const first = ids.filter(id => !id.endsWith(':adaptability')); for (let n = 0; n < i % 4; n++) first.push(first.shift()!);
    groups.push({ id: EXPERIENCE_VERSION + ':group:' + level + ':' + i, level, challenges: [...first, ids.find(id => id.endsWith(':adaptability'))!], quoteId: String(i), ending: '牌形没变，为什么答案变了？' });
  });
}
const newQuestions = [...new Map(selected.filter(x => x.question.id.startsWith(EXPERIENCE_VERSION)).map(x => [x.question.id, x.question])).values()];
for (const q of decisionQuestions.filter(q => q.pool !== 'example' && q.model.horizon >= 4)) for (const kind of ['temptation', 'entanglement', 'cost'] as const) { const proof = ordinaryProof(q, kind); if (proof) challenges.push({ id: EXPERIENCE_VERSION + ':deep:' + q.id + ':' + kind, questionId: q.id, kind, proof }); }
writeFileSync('src/experience/questions.json', JSON.stringify(newQuestions) + '\n');
writeFileSync(target, JSON.stringify({ version: EXPERIENCE_VERSION, challenges, groups }) + '\n');
console.log('Published', groups.length, 'groups;', new Set(selected.map(x => x.question.family)).size, 'families;', newQuestions.length, 'additional questions.');
