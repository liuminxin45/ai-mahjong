import {describe,it,expect,afterAll} from 'vitest';
import {analyze,countsOf,decompose,TILES,type TileId} from '../src/engine/index.js';
import {createRound,configurations,playerDiscard,automaticStep,advanceToPlayer,replayRound,validateRound,publicContext,publicView,npcDiscard,distance,shuffled,type RoundState,type PlayerCommand} from '../src/journey/round.js';
import {activeRound,allCheckpoints,beginTable,changeTable,completeRound,emptyTables,pageFor,restoreTables,tableSnapshot,turnPage,validateTableSnapshot,type TableJourney} from '../src/journey/core.js';
import {tableFacts,summarizeTableFacts,validateTableProfile} from '../src/journey/facts.js';
import {allBeats,middleBeat,chapters} from '../src/journey/narrative.js';
function command(s:RoundState,index=0):PlayerCommand{return {id:s.id+':'+s.seq,seq:s.seq,tileId:s.hands[0][index].id,elapsedMs:1000,assisted:false};}
function finish(s:RoundState,worst=false){while(s.phase!=='over'){const a=analyze(publicContext(s)),tile=worst?a.discards.at(-1)!.tile:a.discards[0].tile;s=advanceToPlayer(playerDiscard(s,command(s,s.hands[0].findIndex(t=>t.tile===tile))));validateRound(s);}return s;}
function chapterStart(){let h=beginTable(emptyTables(),'journey-test',30);while(h.journeys[0].phase!=='playing')h=changeTable(h,'journey-test',turnPage);return h;}
function fullJourney(seed=30){const h=beginTable(emptyTables(),'journey-'+seed,seed);let j=h.journeys[0];for(let n=0;n<70&&j.phase!=='done';n++){if(j.phase==='playing'){j={...j,rounds:j.rounds.map(r=>r.id===activeRound(j).id?finish(r):r)};j=completeRound(j);}else j=turnPage(j);}h.journeys[0]=j;return h;}
describe('continuous physical rounds',()=>{
 it('curates 15 complete deals, paired end shapes with changed public answer',()=>{
  expect(configurations).toHaveLength(15);
  for(const c of configurations){const s=createRound(c.id,3);validateRound(s);expect(s.hands.map(h=>h.length)).toEqual([14,13,13,13]);expect(countsOf([...s.hands.flat(),...s.wall,...s.rivers.flat()].map(t=>t.tile))).toEqual(Array(18).fill(4));}
  for(let v=1;v<=3;v++){const first=createRound('table-1-'+v,1),last=createRound('table-5-'+v,1);expect(first.hands[0]).toEqual(last.hands[0]);expect(analyze(publicContext(first)).discards.filter(d=>d.best).map(d=>d.tile)).not.toEqual(analyze(publicContext(last)).discards.filter(d=>d.best).map(d=>d.tile));}
 });
 it('keeps all thirteen untouched entities and adds precisely one new draw for every legal first discard',()=>{
  for(const c of configurations.filter(c=>c.chapter===1))for(let index=0;index<14;index++){
   const s=createRound(c.id,13),discarded=s.hands[0][index],before=s.hands[0].filter(t=>t!==discarded),next=advanceToPlayer(playerDiscard(s,command(s,index)));
   expect(next.phase).toBe('player');expect(next.hands[0].filter(t=>t.id!==next.lastDraw)).toEqual(before);expect(next.rivers[0]).toEqual([discarded]);expect(next.cursor).toBe(4);validateRound(next);
  }
 });
 const endings=new Set<string>(),winners=new Set<number>();
 it.each(configurations.flatMap(c=>Array.from({length:6},(_,seed)=>[false,true].map(worst=>({c,seed,worst}))).flat()))('replays $c.id seed $seed public worst=$worst',({c,seed,worst})=>{
   const s=createRound(c.id,seed),result=finish(s,worst);expect(replayRound(c.id,seed,result.commands,s.id)).toEqual(result);expect(result.commands.length).toBeGreaterThan(0);endings.add(result.end!.kind);if(result.end!.winner!==undefined)winners.add(result.end!.winner);
   if(result.end!.kind==='exhausted')expect(result.cursor).toBe(result.wall.length);else{const hand=result.hands[result.end!.winner!].map(t=>t.tile);expect(decompose(result.end!.kind==='discard-win'?[...hand,result.end!.tile!.tile]:hand)).not.toBeNull();}
 });
 afterAll(()=>{
  expect(endings.has('exhausted')).toBe(true);expect(endings.has('discard-win')).toBe(true);expect(endings.has('self-draw')).toBe(true);expect([...winners].sort()).toEqual([0,1,2,3]);
 });
 it('does not let NPC or public facts see the next tile or other hands',()=>{const s=automaticStep(playerDiscard(createRound('table-1-1',3),command(createRound('table-1-1',3)))),context=publicContext(s,1);expect(Object.keys(context).sort()).toEqual(['hand','visible']);expect(npcDiscard(context)).toBe(analyze(context).discards[0].tile);expect(publicView(s)).not.toHaveProperty('wall');expect(publicView(s)).not.toHaveProperty('seed');expect(distance(s.hands[0].map(t=>t.tile))).toBeGreaterThanOrEqual(1);});
 it('locks commands idempotently, rejects stale or forged moves, never mutates the input',()=>{
  const s=createRound('table-1-1',2),c=command(s),before=JSON.stringify(s),next=playerDiscard(s,c);expect(JSON.stringify(s)).toBe(before);expect(playerDiscard(next,c)).toBe(next);expect(()=>playerDiscard(next,{...c,tileId:'1p:99'})).toThrow();expect(()=>playerDiscard(s,{...c,seq:1})).toThrow();expect(()=>playerDiscard(s,{...c,tileId:'1p:99'})).toThrow();expect(()=>playerDiscard(s,{...c,id:'<bad>'})).toThrow();expect(()=>playerDiscard(s,{...c,elapsedMs:-1})).toThrow();expect(()=>playerDiscard(s,{...c,elapsedMs:1800001})).toThrow();expect(()=>playerDiscard(s,{...c,assisted:undefined as never})).toThrow();expect(automaticStep(s)).toBe(s);const end=finish(s);expect(automaticStep(end)).toBe(end);
 });
 it('validates configuration, seed, unique physical copies and hand counts',()=>{
  for(const seed of [-1,1.2,0x100000000])expect(()=>createRound('table-1-1',seed)).toThrow();expect(()=>createRound('bad',0)).toThrow();expect(()=>createRound('table-1-1',0,'')).toThrow();
  const s=createRound('table-1-1',0);for(const change of [(x:RoundState)=>{x.version='bad' as never;},(x:RoundState)=>{x.hands=[];},(x:RoundState)=>{x.cursor=99;},(x:RoundState)=>{x.wall[0]={...x.hands[0][0]};},(x:RoundState)=>{x.hands[1].push(x.wall.shift()!);}]){const bad=structuredClone(s);change(bad);expect(()=>validateRound(bad)).toThrow();}
  expect(()=>replayRound('table-1-1',0,Array(21).fill(command(s)))).toThrow();expect(shuffled([1,2,3],1)).toEqual(shuffled([1,2,3],1));
 });
});
describe('five chapters, not five new questions',()=>{
 it('reads five continuous rounds to dinner with early round endings allowed',()=>{const h=fullJourney();expect(h.journeys[0].phase).toBe('done');expect(h.journeys[0].rounds).toHaveLength(5);expect(h.journeys[0].rounds.every(r=>r.phase==='over')).toBe(true);expect(validateTableSnapshot(tableSnapshot(h)).journeys).toHaveLength(1);});
 it('persists presentation, selection, reading and resumes pending automatic turn once',()=>{const h=chapterStart(),j=h.journeys[0],r=activeRound(j),pending=playerDiscard(r,command(r));j.rounds[0]=pending;j.selected='kept';j.presented=true;const restored=restoreTables(structuredClone(h)),round=activeRound(restored.journeys[0]);expect(round).toEqual(advanceToPlayer(pending));expect(restored.journeys[0].presented).toBe(true);expect(restoreTables(restored)).toEqual(restored);expect(restoreTables(undefined)).toEqual(emptyTables());});
 it('keeps mandatory plot at boundaries and labels notebook speech in the present',()=>{for(let c=4;c<=5;c++)for(const b of [...allBeats.filter(b=>b.id==='later-book'||b.id==='her-writing'||b.id==='same-shape'||b.id==='small-words'),...([middleBeat(c,2,true)].filter(Boolean))])expect(b?.speaker).not.toBe('妹妹');expect(allBeats.find(b=>b.id==='cut')?.period).toContain('今年');expect(allBeats.map(b=>b.lines.join('')).join('')).not.toMatch(/因病去世|得绝症|人格|正确答案|下一步/);expect(chapters).toHaveLength(5);expect(middleBeat(1,1,false)).toBeUndefined();expect(middleBeat(1,4,true)).toBeUndefined();});
 it('preserves unrelated journeys and scene marks',()=>{const h=chapterStart(),j=h.journeys[0];expect(completeRound(j)).toBe(j);expect(turnPage(j)).toBe(j);expect(pageFor(j)).toBeUndefined();const mid={...j,middle:middleBeat(1,1,true),line:1};expect(turnPage(mid).middle).toBeUndefined();const next=beginTable(h,'second',3);expect(changeTable(next,'second',x=>({...x,presented:true})).journeys[0]).toEqual(j);});
 it('rejects invalid saves and snapshot paths',()=>{
  const h=fullJourney(),s=tableSnapshot(h);for(const edit of [(x:any)=>{x.version=7;},(x:any)=>{x.contentVersion='old';},(x:any)=>{x.journeys[0].variant=4;},(x:any)=>{x.journeys.push(x.journeys[0]);},(x:any)=>{x.journeys[0].rounds[0].seed++;},(x:any)=>{x.journeys[0].rounds[0].commands=[];},(x:any)=>{x.journeys[0].rounds[0].commands[0].tileId='5p:99';}]){const bad=structuredClone(s);edit(bad);expect(()=>validateTableSnapshot(bad)).toThrow();}
  expect(()=>restoreTables({version:2} as never)).toThrow();const bad=structuredClone(h);bad.journeys[0].chapter=9;expect(()=>restoreTables(bad)).toThrow();
 });
});
describe('evidence from observed choices, not the hidden wall',()=>{
 it('distinguishes distance errors, opportunity errors, assistance and genuine repeat findings',()=>{
  const snapshots=[];
  for(const issue of ['distance','opportunities'] as const){
   const journeys=[];
   for(let variant=1;variant<=3;variant++){
    const id='finding-'+variant,seed=variant;let first=createRound('table-1-'+variant,(seed+997)>>>0,id+':1');
    while(first.phase!=='over'){const a=analyze(publicContext(first)),chosen=a.discards.find(d=>issue==='distance'?d.shanten>a.discards[0].shanten:d.shanten===a.discards[0].shanten&&d.ukeire<a.discards[0].ukeire)??a.discards.at(-1)!;first=advanceToPlayer(playerDiscard(first,{...command(first,first.hands[0].findIndex(t=>t.tile===chosen.tile)),assisted:false}));}
    const second=createRound('table-2-'+variant,(seed+1994)>>>0,id+':2'),a=analyze(publicContext(second)),chosen=a.discards.find(d=>issue==='distance'?d.shanten>a.discards[0].shanten:d.shanten===a.discards[0].shanten&&d.ukeire<a.discards[0].ukeire)??a.discards.at(-1)!,c=command(second,second.hands[0].findIndex(t=>t.tile===chosen.tile));
    journeys.push({id,variant,seed,rounds:[{configId:first.configId,seed:first.seed,commands:first.commands},{configId:second.configId,seed:second.seed,commands:[c]}]});
   }
   const s={version:8 as const,contentVersion:'sit-with-me-1' as const,journeys};validateTableSnapshot(s);const f=tableFacts(s);expect(f.independent.length).toBe(6);expect(f.facts.some(x=>x.issue===issue)).toBe(true);snapshots.push(s);
   expect(f.observations.some(o=>o.id.startsWith('repeated:'))).toBe(false);const sameLevel=summarizeTableFacts(f.facts.map(x=>({...x,level:3})));expect(sameLevel.observations.some(o=>o.id==='repeated:3:'+issue)).toBe(true);expect(sameLevel.cohorts.find(c=>c.level===3)?.interval?.length).toBe(2);
  }
  const assisted=structuredClone(snapshots[0]);assisted.journeys[0].rounds[0].commands[0].assisted=true;expect(tableFacts(assisted).summary.assisted).toBe(1);
 });
 it('retains legacy payload separately and clamps old reading positions without erasing pages',()=>{const h=chapterStart(),j=h.journeys[0];for(const phase of ['opening','entry','exit'] as const)expect(pageFor({...j,phase,page:0})).toBeDefined();j.phase='entry';j.page=1;j.line=99;expect(restoreTables(h).journeys[0].line).toBe(1);const legacy={kept:'unchanged'};expect(validateTableSnapshot(tableSnapshot(h,legacy)).legacy).toEqual(legacy);const huge={...tableSnapshot(h),journeys:Array.from({length:5000},()=>({id:'x',variant:1,seed:0,rounds:[{commands:Array(11).fill({})}]}))};expect(()=>validateTableSnapshot(huge)).toThrow('记录太长');});
 it('counts correlated moves as choices, only different starts as independent, pairs and assistance separately',()=>{const h=fullJourney(),s=tableSnapshot(h),f=tableFacts(s);expect(f.summary.rounds).toBe(5);expect(f.summary.choices).toBeGreaterThan(5);expect(f.independent).toHaveLength(4);expect(f.facts.filter(x=>x.paired).length).toBeGreaterThan(0);const repeated=tableFacts({...s,journeys:[...s.journeys,{...s.journeys[0],id:'repeat'}]});expect(repeated.independent).toHaveLength(4);expect(f.observations.some(o=>o.id.startsWith('repeated:'))).toBe(false);expect(allCheckpoints(s)).toHaveLength(f.facts.length);});
 it('allows only existing observations, vetted questions and exact evidence IDs',()=>{const s=tableSnapshot(fullJourney()),f=tableFacts(s),o=f.fallback!,p={version:6 as const,observationId:o.id,questionId:o.questionIds[0],evidenceIds:o.evidenceIds};expect(validateTableProfile(p,s)).toEqual(p);for(const bad of [null,{...p,version:5},{...p,observationId:'invented'},{...p,questionId:'greedy'},{...p,evidenceIds:['invented']},{...p,evidenceIds:[]}])expect(()=>validateTableProfile(bad,s)).toThrow();expect(tableFacts(tableSnapshot(emptyTables())).fallback).toBeUndefined();});
});
