import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { decisionQuestions } from '../src/decision/questions.js';
import { structure } from '../src/training/questions.js';
import { validateDecision } from '../src/decision/solver.js';
import { verifyDecision, independentFan } from './decision-verifier.js';
import { analyze, sorted } from '../src/engine/index.js';
const proofHash=(q:typeof decisionQuestions[number])=>createHash('sha256').update(JSON.stringify({context:q.context,model:q.model,certificate:q.certificate})).digest('hex');
const exact = process.argv.includes('--exact'), level = Number(process.argv.find(a=>a.startsWith('--level='))?.split('=')[1] ?? 0), seen = new Set<string>(), checkpoint = 'work/decision-proofs'+(level?'-level'+level:'')+'.json';
mkdirSync('work',{recursive:true});
const currentHashes = new Set(decisionQuestions.map(proofHash));
const cache=existsSync(checkpoint)?checkpoint:'work/decision-proofs.json';
const scopedHashes=new Set(decisionQuestions.filter(q=>!level||q.level===level).map(proofHash));
const checked: string[] = exact && existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')).filter((hash:string)=>currentHashes.has(hash)&&scopedHashes.has(hash)) : [];
if (decisionQuestions.length !== 332) throw new Error('Decision bank must contain 240 practice, 80 transfer and 12 worked examples');
for (let i = 0; i < decisionQuestions.length; i++) {
  const q = decisionQuestions[i], { hash, ...payload } = q;
  validateDecision(q.context, q.model);
  if (hash !== createHash('sha256').update(JSON.stringify(payload)).digest('hex') || q.family !== structure(q.context) || seen.has(q.family)) throw new Error('Invalid decision hash or duplicate family: ' + q.id);
  seen.add(q.family);
  const shape=analyze(q.context);if(JSON.stringify(q.shape)!==JSON.stringify({normal:shape.normal,sevenPairs:shape.sevenPairs,shanten:shape.shanten,discards:shape.discards}))throw new Error('Invalid precomputed shape: '+q.id);
  if(q.finish){const hand=[...q.context.hand],bag=[...q.model.bag];if(q.finish.draws.length>q.model.horizon||q.finish.draws.length!==q.finish.discarded.length||q.finish.discarded[0]!==q.certificate.recommended)throw new Error('Invalid teaching path');for(let step=0;step<q.finish.draws.length;step++){const discard=hand.indexOf(q.finish.discarded[step]),draw=bag.indexOf(q.finish.draws[step]);if(discard<0||draw<0)throw new Error('Impossible teaching path');hand.splice(discard,1);hand.push(bag.splice(draw,1)[0]);if(step<q.finish.draws.length-1&&independentFan(hand,q.context.fixedSets)!==null)throw new Error('Win must be absorbing');}const fan=independentFan(hand,q.context.fixedSets);if(fan!==q.finish.value.fan||JSON.stringify(sorted(hand))!==JSON.stringify(q.finish.hand)||q.finish.value.points!==2**Math.min(3,fan!))throw new Error('Invalid teaching fan');}
  const best = q.certificate.options.reduce((v, o) => BigInt(o.value.score) > v ? BigInt(o.value.score) : v, 0n), accepted = q.certificate.options.filter(o => BigInt(o.value.score) === best).map(o => o.tile);
  if (!best || accepted.length === q.certificate.options.length || JSON.stringify(accepted) !== JSON.stringify(q.certificate.accepted)) throw new Error('Invalid decision ranking: ' + q.id);
  for (const o of q.certificate.options) for (const policy of [o.value, o.fast]) { const den = BigInt(q.certificate.denominator); if (BigInt(policy.wins) > den || BigInt(policy.ready) > den || policy.fans.reduce((n, f) => n + BigInt(f), 0n) !== BigInt(policy.wins) || policy.fans.reduce((n, f, k) => n + BigInt(f) * BigInt(2 ** k), 0n) !== BigInt(policy.score)) throw new Error('Invalid exact metrics: ' + q.id); }
  const proof=proofHash(q);
  if (exact && (!level || q.level===level) && !checked.includes(proof)) {
    const verified = verifyDecision(q.context, q.model);
    for (const key of ['denominator', 'options', 'accepted', 'recommended', 'fastest'] as const) if (JSON.stringify(verified[key]) !== JSON.stringify(q.certificate[key])) throw new Error('Independent policy mismatch: ' + q.id + ':' + key);
    checked.push(proof); writeFileSync(checkpoint, JSON.stringify(checked));
  }
  if (i % 20 === 19) console.log('Verified ' + (i + 1) + '/' + decisionQuestions.length + (exact ? ' independently' : ''));
}
for (const level of [1, 2, 3, 4]) for (const [pool, count] of [['practice', 60], ['transfer', 20], ['example', 3]] as const) if (decisionQuestions.filter(q => q.level === level && q.pool === pool).length !== count) throw new Error('Incomplete level coverage');
mkdirSync('artifacts', { recursive: true });
const inScope=decisionQuestions.filter(q=>!level||q.level===level),verified=inScope.filter(q=>checked.includes(proofHash(q))).length;
writeFileSync('artifacts/decision-bank-verification'+(level?'-level'+level:'')+'.json', JSON.stringify({ questions: decisionQuestions.length, exact, level:level||'all', inScope:inScope.length, verified:exact?verified:undefined, at:new Date().toISOString() }));
console.log('All '+inScope.length+' decision questions'+(level?' in stage '+level:'')+' verified' + (exact ? ' by independent physical-path enumeration.' : '.'));
