import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { story, chapterKinds } from '../src/story/definition.js';
import { accepted } from '../src/story/core.js';
import { catalog, challenge } from '../src/experience/core.js';
import { challengeKinds, ordinaryProof } from '../src/experience/definitions.js';
import { decisionQuestion, type DecisionQuestion } from '../src/decision/questions.js';
import { countsOf, TILES } from '../src/engine/index.js';
import { remainingBag } from '../src/decision/solver.js';
import { verifyDecision } from './decision-verifier.js';
import { verifyScenario } from './story-verifier.js';
import { scenarioWitness } from './story-witness.js';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
mkdirSync('work',{recursive:true});mkdirSync('artifacts/story',{recursive:true});
const cachePath='work/record-independent-proofs.json';
const proofs=new Set<string>(existsSync(cachePath)?JSON.parse(readFileSync(cachePath,'utf8')):[]);
const questions=new Map<string,DecisionQuestion>();
const add=(q:DecisionQuestion)=>questions.set(hash([q.context,q.model,q.certificate]),q);
assert.equal(story.nodes.length,35);assert.equal(new Set(story.nodes.map(n=>n.id)).size,35);
for(const n of story.nodes){
  assert.equal(n.challenge.kind,chapterKinds[n.chapter-1][(n.position-1)%5]);
  add(n.question);if(n.challenge.proof.before)add(n.challenge.proof.before);
  if(n.scenario){
    const independent=verifyScenario(n.question.context,n.scenario);
    assert.deepEqual(independent.options,n.certificate!.options.map(({outcomes,...o})=>o),n.id);
    assert.deepEqual(independent.accepted,accepted(n));
    assert.deepEqual(independent.compatible,n.certificate!.prior.map(p=>p.compatible));
    assert.ok(n.witness);assert.deepEqual(JSON.parse(JSON.stringify(scenarioWitness(n.question,n.scenario,n.certificate!,n.challenge.kind,n.challenge.proof,n.position))),n.witness);
    if(n.witness.before){const b=n.witness.before;assert.deepEqual(verifyScenario(b.context,b.model).options,b.certificate.options.map(({outcomes,...o})=>o));}
  }
}
assert.equal(catalog.groups.length,32);
for(const level of [1,2,3,4]){
  const gs=catalog.groups.filter(g=>g.level===level);assert.equal(gs.length,8);
  for(const g of gs){const cs=g.challenges.map(challenge),qs=cs.map(c=>decisionQuestion(c.questionId));assert.deepEqual(cs.map(c=>c.kind).sort(),[...challengeKinds].sort());assert.equal(new Set(qs.map(q=>q.family)).size,5);assert.ok(qs.every(q=>q.level===level&&q.model.horizon<=3&&q.pool!=='example'));assert.ok(qs.filter(q=>q.pool==='transfer').length<=1);}
}
for(const c of catalog.challenges){
  const q=decisionQuestion(c.questionId);add(q);const p=c.proof,best=q.certificate.options.find(o=>o.tile===q.certificate.recommended)!,alt=q.certificate.options.find(o=>o.tile===p.alternative)!;
  assert.ok(alt);assert.equal(p.kind,c.kind);assert.ok(BigInt(best.value.score)>BigInt(alt.value.score)||p.before,c.id);
  if(p.before){add(p.before);assert.ok(!p.before.certificate.accepted.some(t=>q.certificate.accepted.includes(t)));if(c.kind==='gap')assert.equal(q.model.bag.filter(t=>t===p.tiles[0]).length,0);if(p.basis==='seen-out')assert.equal(remainingBag(q.context).filter(t=>t===p.tiles[0]).length,0);}
  else if(p.basis==='keep-edge')assert.ok(['1','9'].includes(p.alternative[0])&&!['1','9'].includes(best.tile[0]));
  else if(p.basis==='bigger-worthwhile')assert.ok(BigInt(best.value.wins)<BigInt(alt.value.wins)&&BigInt(best.value.score)*BigInt(alt.value.wins)>BigInt(alt.value.score)*BigInt(best.value.wins));
  else {const recomputed=ordinaryProof(q,c.kind);assert.ok(recomputed,c.id);assert.equal(recomputed.basis,p.basis);}
  if(p.basis==='shared-physical-tile'){const count=countsOf(q.context.hand);assert.ok(p.tiles.some((t,i,all)=>all.indexOf(t)!==i&&count[TILES.indexOf(t)]===1));}
}
let index=0;for(const [key,q] of questions){
  if(!proofs.has(key)){const independent=verifyDecision(q.context,q.model);for(const field of ['denominator','options','accepted','recommended','fastest'] as const)assert.deepEqual(independent[field],q.certificate[field],q.id+':'+field);proofs.add(key);writeFileSync(cachePath,JSON.stringify([...proofs]));}
  if(++index%10===0)console.log('Independently verified',index,'/',questions.size);
}
const audio=JSON.parse(readFileSync('assets/audio/manifest.json','utf8'));let total=0;
assert.equal(audio.files.filter((a:{kind:string})=>a.kind==='music').length,5);assert.equal(audio.files.filter((a:{kind:string})=>a.kind==='effect').length,6);
for(const a of audio.files){const bytes=readFileSync(a.path);assert.equal(bytes.length,a.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.ok(a.license&&a.licenseUrl&&a.source&&a.author&&a.modifications);total+=a.bytes;}
assert.ok(total<15*1024*1024);assert.deepEqual(audio,JSON.parse(readFileSync('src/story/audio-manifest.json','utf8')));
writeFileSync('artifacts/story/content-verification.json',JSON.stringify({version:story.version,nodes:35,continuationGroups:32,exactCertificates:questions.size,audioBytes:total,catalogHash:hash(story),at:new Date().toISOString()},null,2));
console.log('Story, executable witnesses, continuation and audio manifests verified.');
