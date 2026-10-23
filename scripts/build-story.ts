import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { analyze, countsOf, setTiles, sorted, TILES, type TileId, type HandContext } from '../src/engine/index.js';
import { legacyDecisionQuestions, type DecisionQuestion } from '../src/decision/questions.js';
import { solveDecision, remainingBag } from '../src/decision/solver.js';
import { ordinaryProof, type Challenge, type ChallengeKind, type ChallengeProof } from '../src/experience/definitions.js';
import { STORY_VERSION, chapterKinds, chapters, oldNotes, type DecisionNode } from '../src/story/definition.js';
import { SCENARIO_VERSION, solveScenario, compatibleWorld, type World, type ScenarioModel } from '../src/story/model.js';
import { scenarioWitness } from './story-witness.js';
type Candidate = { question: DecisionQuestion; proof: ChallengeProof };
const saved = JSON.parse(readFileSync(existsSync('work/story-candidates.json')?'work/story-candidates.json':'work/experience-candidates.json','utf8'));
try{execFileSync('git',['cat-file','-e','HEAD:src/story/catalog.json'],{stdio:'ignore'});throw Error('PUBLISHED_STORY_IMMUTABLE');}catch(e){if(String(e).includes('PUBLISHED_STORY_IMMUTABLE'))throw e;}
const candidates: Candidate[] = saved.candidates;
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
let seed = 1845915; const random = (n: number) => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed % n; };
const shuffle = <T,>(xs: T[]) => { const a=[...xs];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; };
for(const source of legacyDecisionQuestions.filter(q=>q.level===3&&['seven','flush'].includes(q.skill)&&q.pool==='practice')){
  const id=STORY_VERSION+':intro:'+source.id;
  const focus=[...new Set(source.shape.discards.flatMap(d=>d.improvements.map(x=>x.tile)))],bag:TileId[]=[];
  for(const t of [...focus,...new Set(source.model.bag)])if(source.model.bag.includes(t)&&bag.length<8)bag.push(t);
  for(const t of source.model.bag)if(bag.length<8&&bag.filter(x=>x===t).length<source.model.bag.filter(x=>x===t).length)bag.push(t);
  const model={...source.model,kind:'explicit' as const,bag:sorted(bag),horizon:2},certificate=solveDecision(source.context,model),{hash:_hash,finish:_finish,...base}=source;
  const value={...base,id,level:2,model,certificate},q={...value,hash:sha(value)};
  for(const kind of ['temptation','entanglement','cost'] as const){const proof=ordinaryProof(q,kind);if(proof)candidates.push({question:q,proof});}
  const alt=certificate.options.find(o=>o.tile!==certificate.recommended&&BigInt(o.value.score)<BigInt(certificate.options.find(x=>x.tile===certificate.recommended)!.value.score));
  if(q.skill==='seven'&&alt)candidates.push({question:q,proof:{kind:'entanglement',alternative:alt.tile,tiles:q.context.hand.filter(t=>q.context.hand.filter(x=>x===t).length>=2),basis:'route-overlap'}});
  if(q.skill==='flush')for(const tile of new Set(bag)){try{const amount=bag.filter(t=>t===tile).length,context={...q.context,visible:{...q.context.visible,[tile]:(q.context.visible?.[tile]??0)+amount}},changed=recertify(q,context,'flush-gap:'+id+':'+tile),before=certificate.options.find(o=>o.tile===certificate.recommended)!,after=changed.certificate.options.find(o=>o.tile===certificate.recommended)!;if(BigInt(after.value.score)*BigInt(certificate.denominator)>=BigInt(before.value.score)*BigInt(changed.certificate.denominator)||!BigInt(changed.certificate.options.find(o=>o.tile===changed.certificate.recommended)!.value.score))continue;candidates.push({question:changed,proof:{kind:'gap',alternative:certificate.recommended,tiles:[tile],basis:remainingBag(context).includes(tile)?'bag-absence':'seen-out',before:q}});break;}catch{}}
}
for(const q of [...legacyDecisionQuestions,...candidates.map(c=>c.question)]){
  const best=q.certificate.options.find(o=>o.tile===q.certificate.recommended)!,bad=q.certificate.options.filter(o=>BigInt(o.value.score)<BigInt(best.value.score));
  const edge=bad.find(o=>['1','9'].includes(o.tile[0])&&!['1','9'].includes(best.tile[0]));
  if(edge&&!candidates.some(c=>c.question.id===q.id&&c.proof.basis==='keep-edge'))candidates.push({question:q,proof:{kind:'adaptability',alternative:edge.tile,tiles:[edge.tile],basis:'keep-edge'}});
  const smaller=bad.find(o=>BigInt(o.value.wins)>BigInt(best.value.wins)&&BigInt(best.value.score)*BigInt(o.value.wins)>BigInt(o.value.score)*BigInt(best.value.wins));
  if(smaller&&!candidates.some(c=>c.question.id===q.id&&c.proof.basis==='bigger-worthwhile'))candidates.push({question:q,proof:{kind:'adaptability',alternative:smaller.tile,tiles:[best.tile,smaller.tile],basis:'bigger-worthwhile'}});
  const counter=candidates.find(c=>c.question.id===q.id&&c.proof.before);
  if(counter&&!candidates.some(c=>c.question.id===q.id&&c.proof.basis==='information-shift'))candidates.push({question:q,proof:{...counter.proof,kind:'temptation',basis:'information-shift'}});
}
for(const q of legacyDecisionQuestions.filter(q=>q.pool!=='example'))for(const kind of ['temptation','entanglement','cost'] as const){const proof=ordinaryProof(q,kind);if(proof&&!candidates.some(c=>c.question.id===q.id&&c.proof.kind===kind))candidates.push({question:q,proof});}
for(const original of legacyDecisionQuestions.filter(q=>q.pool!=='example')) {
  if(['gap','adaptability'].every(kind=>candidates.filter(c=>c.question.level===original.level&&c.proof.kind===kind).length>=3))continue;
  console.log('Preparing missing witnesses',original.level,original.id);
  try{
    const base=recertify(original,original.context,'baseline:'+original.id);
    for(const kind of ['gap','adaptability'] as const){
      if(candidates.filter(c=>c.question.level===original.level&&c.proof.kind===kind).length>=3)continue;
      for(const tile of [...new Set(base.model.bag)]){
        const count=base.model.bag.filter(t=>t===tile).length,add=kind==='gap'?count:count-1;if(add<=0)continue;
        try{const context={...base.context,visible:{...base.context.visible,[tile]:(base.context.visible?.[tile]??0)+add}},q=recertify(base,context,kind+':'+original.id);
          if(q.certificate.accepted.some(t=>base.certificate.accepted.includes(t))||BigInt(q.certificate.options.find(o=>o.tile===q.certificate.recommended)!.value.score)===0n)continue;
          candidates.push({question:q,proof:{kind,alternative:base.certificate.recommended,tiles:[tile],basis:kind==='gap'?(remainingBag(context).includes(tile)?'bag-absence':'seen-out'):'live-counterfactual',before:base}});break;
        }catch{}
      }
    }
  }catch{}
}
// A small explicit two-draw model makes the flush/pair tradeoff approachable in chapter two.
const flushHand=sorted([...'55'].map(x=>(x+'p') as TileId).concat([...'122334567899'].map(x=>(x+'s') as TileId)));
for(let copies=1;copies<=3;copies++)for(const waste of [['3s','6s','2p','8p'],['1s','9s','5p','8p'],['2s','5s','8s','2p']] as TileId[][]){
  const bag=sorted([...Array<TileId>(copies).fill('1s'),...Array<TileId>(Math.min(2,copies)).fill('9s'),...waste]),context={hand:flushHand},model={version:'finite-discard-1' as const,kind:'explicit' as const,bag,horizon:2};
  try{const certificate=solveDecision(context,model),analysis=analyze(context),payload={id:STORY_VERSION+':flush-pair:'+copies+':'+waste.join('-'),level:2,skill:'flush' as const,pool:'practice' as const,family:'story-family:'+sha([flushHand,[]]),context,model,certificate,shape:{normal:analysis.normal,sevenPairs:analysis.sevenPairs,shanten:analysis.shanten,discards:analysis.discards},note:'对子与清一色，按这两次摸牌比较。',groups:[]},q={...payload,hash:sha(payload)};
    for(const tile of ['1s','9s'] as TileId[]){const amount=bag.filter(t=>t===tile).length,changed=recertify(q,{hand:flushHand,visible:{[tile]:amount}},'flush-pair-gap:'+copies+':'+waste.join('-')+':'+tile),before=certificate.options.find(o=>o.tile===certificate.recommended)!,after=changed.certificate.options.find(o=>o.tile===certificate.recommended)!;
      if(BigInt(after.value.score)*BigInt(certificate.denominator)<BigInt(before.value.score)*BigInt(changed.certificate.denominator)&&BigInt(changed.certificate.options.find(o=>o.tile===changed.certificate.recommended)!.value.score))candidates.push({question:changed,proof:{kind:'gap',alternative:certificate.recommended,tiles:[tile],basis:'bag-absence',before:q}});
    }
  }catch{}
}
const deduplicated=new Set<string>();for(let i=candidates.length-1;i>=0;i--){const key=[candidates[i].question.id,candidates[i].proof.kind,candidates[i].proof.basis].join('|');if(candidates[i].question.pool==='example'||deduplicated.has(key))candidates.splice(i,1);else deduplicated.add(key);}
candidates.sort((a,b)=>a.question.id.localeCompare(b.question.id)||a.proof.kind.localeCompare(b.proof.kind)||a.proof.basis.localeCompare(b.proof.basis));
writeFileSync('work/story-candidates.json',JSON.stringify({candidates}));
const newQuestions = new Map<string,DecisionQuestion>();
for (const c of candidates) if(!legacyDecisionQuestions.some(q=>q.id===c.question.id)) newQuestions.set(c.question.id,c.question);
const challenges: Challenge[] = [], groups: {id:string;level:number;challenges:string[];quoteId:string;ending:string}[]=[];
// Curated continuation sets. Equivalent variants share the original structural family.
for(let level=1;level<=4;level++) {
  const usage=new Map<string,number>();
  for(let g=0;g<8;g++) {
    const family=new Set<string>(), chosen: string[]=[];
    for(const kind of ['temptation','gap','entanglement','cost','adaptability'] as const) {
      const item=candidates.filter(c=>c.question.level===level&&c.question.model.horizon<=3&&c.proof.kind===kind&&!family.has(c.question.family)).sort((a,b)=>(usage.get(a.question.family)??0)-(usage.get(b.question.family)??0)||a.question.id.localeCompare(b.question.id))[0];
      if(!item)throw Error('Continuation coverage missing '+level+' '+kind);
      family.add(item.question.family);usage.set(item.question.family,(usage.get(item.question.family)??0)+1);
      const id='record-practice:'+level+':'+g+':'+kind;
      challenges.push({id,kind,questionId:item.question.id,proof:item.proof});chosen.push(id);
    }
    groups.push({id:'record-practice:'+level+':'+g,level,challenges:[...chosen.slice(g%5),...chosen.slice(0,g%5)],quoteId:String(g),ending:'还有哪一种可能，值得再看一眼？'});
  }
}
for(const c of candidates.filter(c=>c.question.level===4&&c.question.model.horizon>=4))challenges.push({id:'record-deep:'+c.question.id+':'+c.proof.kind,kind:c.proof.kind,questionId:c.question.id,proof:c.proof});
writeFileSync('src/experience/questions.json',JSON.stringify([...newQuestions.values()])+'\n');
writeFileSync('src/experience/catalog.json',JSON.stringify({version:'five-hands-1',groups,challenges})+'\n');

function recertify(q:DecisionQuestion, context:HandContext, suffix:string):DecisionQuestion {
  const available=countsOf(remainingBag(context)),bag=q.model.bag.filter(t=>{const i=TILES.indexOf(t);if(!available[i])return false;available[i]--;return true;});
  const model={...q.model,kind:'explicit' as const,bag:sorted(bag),horizon:Math.min(2,q.model.horizon,bag.length)};
  if(!model.horizon)throw Error('No draw in teaching baseline');
  const certificate=solveDecision(context,model,500000),a=analyze(context),{hash:_hash,finish:_finish,...base}=q;
  const value={...base,id:STORY_VERSION+':'+suffix,context,model,certificate,shape:{normal:a.normal,sevenPairs:a.sevenPairs,shanten:a.shanten,discards:a.discards}};
  return {...value,hash:sha(value)};
}
function waitingHand(pool:TileId[], target:TileId):TileId[]|null {
  for(let attempt=0;attempt<600;attempt++) {
    const hand:TileId[]=[],available=countsOf(pool),take=(xs:TileId[])=>{const need=countsOf(xs);if(need.some((n,i)=>n>available[i]))return false;xs.forEach(t=>{available[TILES.indexOf(t)]--;hand.push(t);});return true;};
    const pair=TILES[random(18)];if(!take([pair,pair]))continue;
    for(let g=0;g<4;g++){let found=false;for(let k=0;k<30;k++){const t=TILES[random(18)],i=TILES.indexOf(t),xs=random(3)&&i%9<7?[t,TILES[i+1],TILES[i+2]]:[t,t,t];if(take(xs)){found=true;break;}}if(!found)break;}
    if(hand.length!==14||!hand.includes(target))continue;
    hand.splice(hand.indexOf(target),1);return sorted(hand);
  }return null;
}
function makeScenario(base:DecisionQuestion,suffix:string,final=false,observation=false) {
  const context:HandContext=structuredClone(base.context),visible={...context.visible};
  const total=()=>context.hand.length+(context.fixedSets??[]).flatMap(setTiles).length+Object.values(visible).reduce((a,b)=>a+(b??0),0);
  const wallLength=final?4:Math.max(4,Math.min(8,72-total()-39));
  if(72-total()-39<wallLength)throw Error('Too many visible tiles for four players');
  const wanted=72-39-wallLength;
  // Prefer physically removing one otherwise live route; always retain enough alternatives.
  while(total()<wanted){const pool=remainingBag({...context,visible}),t=pool[random(pool.length)];visible[t]=(visible[t]??0)+1;}
  context.visible=visible;
  const q=recertify(base,context,suffix),pool=remainingBag(context),worlds:World[]=[];
  const targets=shuffle([...new Set(context.hand)]);
  for(let k=0;k<12;k++) {
    const target=targets[k%targets.length],opponent=waitingHand(pool,target);if(!opponent)continue;
    const left=[...pool];for(const t of opponent)left.splice(left.indexOf(t),1);
    const live=q.shape.discards.flatMap(d=>d.improvements.map(x=>x.tile));
    const priority=shuffle(left).sort((a,b)=>Number(live.includes(b))-Number(live.includes(a)));
    // Preserve a chance for the player's fourth draw and for the opponent's second draw.
    const wall=shuffle(priority.slice(0,wallLength)),others=priority.slice(wallLength);
    if(others.length!==26)throw Error('World allocation drifted');
    worlds.push({id:suffix+':w'+k,weight:1,opponent,others:[sorted(others.slice(0,13)),sorted(others.slice(13))],wall});
  }
  if(worlds.length<3)throw Error('Insufficient physical worlds');
  let model:ScenarioModel={version:SCENARIO_VERSION,worlds,draws:wallLength,policy:'shape-first'};
  if(observation) {
    for(const tile of TILES.filter(t=>visible[t])) {
      const proposed={...model,observedDiscard:tile},test=worlds.map(w=>compatibleWorld({...w,previousDraw:tile},proposed));
      if(test.filter(Boolean).length>=2&&test.some(x=>!x)) {model={...model,observedDiscard:tile,worlds:worlds.map(w=>({...w,previousDraw:tile}))};break;}
    }
    if(!model.observedDiscard)throw Error('No informative observed action');
  }
  const certificate=solveScenario(q.context,model);
  if(!certificate.options.some(o=>o.score!==certificate.options[0].score))throw Error('No meaningful decision');
  return {q,model,certificate};
}

const nodes:DecisionNode[]=[], used=new Set<string>(),owners=new Map<string,{chapter:number;variant:string}>();
let opening:Candidate|undefined;
for(const c of candidates.filter(c=>c.question.level===1&&c.proof.kind==='entanglement')) {
  if(c.question.shape.discards.filter(d=>d.shanten===0).length>=2){opening=c;break;}
}
if(!opening)throw Error('No opening with multiple live ready choices');
for(let chapter=1;chapter<=5;chapter++) for(const variant of chapter===3?['changed','kept'] as const:chapter===5?['loss','clear'] as const:['shared'] as const) for(let j=0;j<5;j++) {
  const position=(chapter-1)*5+j+1,kind=chapterKinds[chapter-1][j],level=chapters[chapter-1].level,id=STORY_VERSION+':'+position+':'+variant;
  const matches=(c:Candidate)=>position===3?c.proof.basis==='seen-out':position===4?c.proof.basis==='pair-distance':position===5?c.proof.basis==='keep-edge':position===6?c.question.certificate.fastest!==c.question.certificate.recommended:position===7?c.question.skill==='seven':position===8?c.proof.basis==='bigger-worthwhile':position===9?c.question.skill==='flush':position===12?!!c.proof.before:position===13?c.proof.basis==='information-shift':position===15?c.question.model.horizon>=2:true;
  const eligible=position===1?[opening]:position===25?[opening]:candidates.filter(c=>c.question.level===level&&c.proof.kind===kind&&matches(c)&&(!used.has(c.question.family)||owners.get(c.question.family)?.chapter===chapter&&owners.get(c.question.family)?.variant!==variant)&&!(chapter===3&&nodes.some(n=>n.chapter===chapter&&n.variant!==variant&&n.question.id===c.question.id)));
  let node:DecisionNode|undefined,last='';
  for(const candidate of eligible) {
    try{
      let q=candidate.question,scenario:ScenarioModel|undefined,certificate,witness;
      if(chapter>=4){let made;for(let attempt=0;attempt<(position===25?180:24);attempt++){try{const next=makeScenario(q,id,position===25,[16,19].includes(position));if(position===25&&(next.certificate.accepted.some(t=>opening!.question.certificate.accepted.includes(t))||!next.certificate.options.some(o=>o.outcomes.some(w=>w.kind==='you'))))continue;const evidence=scenarioWitness(next.q,next.model,next.certificate,kind,candidate.proof,position);if(!evidence)continue;made=next;witness=evidence;break;}catch(e){last=String(e);}}if(!made)continue;q=made.q;scenario=made.model;certificate=made.certificate;
        if(position===25&&certificate.accepted.some(t=>opening!.question.certificate.accepted.includes(t)))continue;
        if(position===25&&!certificate.options.some(o=>o.outcomes.some(w=>w.kind==='you')))continue;
      }
      const proof=candidate.proof;
      node={id,position,variant,chapter,question:q,challenge:{id:id+':proof',kind,questionId:q.id,proof},...(scenario?{scenario,certificate,witness}:{}),note:oldNotes[position-1],noteTime:chapter>=4?'后来补记':'当年的注记',...([1,25].includes(position)?{pair:'opening-mirror'}:{})};
      if(position===10&&!q.context.hand.some(t=>q.context.hand.filter(x=>x===t).length===2))continue;
      break;
    }catch(e){last=String(e);}
  }
  if(!node)throw Error('No verified node '+id+' '+kind+' '+last);
  nodes.push(node);used.add(node.question.family);owners.set(node.question.family,{chapter,variant});writeFileSync('work/story-nodes.json',JSON.stringify(nodes));console.log('Story node',position,variant,node.question.id,node.certificate?.accepted??node.question.certificate.accepted);
}
mkdirSync('src/story',{recursive:true});
writeFileSync('src/story/catalog.json',JSON.stringify({version:STORY_VERSION,nodes,mirror:{opening:nodes[0].id,endings:nodes.filter(n=>n.position===25).map(n=>n.id)}})+'\n');
writeFileSync('work/story-build-proof.json',JSON.stringify({nodes:nodes.length,seed,catalogHash:sha(nodes),kinds:chapterKinds},null,2));
console.log('Prepared',nodes.length,'story nodes and',groups.length,'continuation sets');
