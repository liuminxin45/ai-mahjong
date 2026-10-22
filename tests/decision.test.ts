import { describe, expect, it } from 'vitest';
import { analyze, countsOf, parseHand, TILES, type TileId } from '../src/engine/index.js';
import { scoreCounts, scoreHand } from '../src/decision/score.js';
import { DECISION_MODEL, decimal, fraction, percent, remainingBag, solveDecision, validateDecision, type DrawConditions } from '../src/decision/solver.js';
import { independentFan, verifyDecision } from '../scripts/decision-verifier.js';
import { decisionQuestions, decisionQuestion } from '../src/decision/questions.js';
import { choiceEvidence, compressedDecisions, createDecisionSession, decisionFacts, decisionSnapshot, decisionStats, emptyDecision, focusSkill, importDecision, independentDecisions, localDay, nextRecommendation, opportunityCount, recordDecision, reviewOutcomes, validateDecisionProfile, validateDecisionSnapshot, wilson } from '../src/decision/core.js';
import { emptyData, importData } from '../src/learning/storage.js';
import { emptyTraining, recordTraining, trainingSnapshot } from '../src/training/core.js';
import { trainingQuestions } from '../src/training/questions.js';

const practice = () => decisionQuestions.filter(q => q.pool === 'practice');
const attempt = (q = practice()[0], i = 0, correct = true) => ({ id: 'decision-evidence-' + i, questionId: q.id, answer: correct ? q.certificate.accepted[0] : q.certificate.options.find(o => !q.certificate.accepted.includes(o.tile))!.tile, assisted: false, review: false, durationMs: 2000, at: new Date(Date.UTC(2026, 9, 22, 0, 0, i)).toISOString() });
const populated = (n = 10, correct = true) => { let s = emptyDecision(); practice().slice(0, n).forEach((q, i) => { s = recordDecision(s, attempt(q, i, correct)); }); return s; };
const ctx = { hand: parseHand('123456789p22569s') };
const model: DrawConditions = { version: DECISION_MODEL, kind: 'explicit', bag: parseHand('14579s'), horizon: 2 };

describe('exact scoring and future strategies', () => {
  it('matches an independent physical-path enumerator for both policies, times and terminal fan distributions', () => {
    for (const c of [ctx, { hand: parseHand('1111223344556p9s') }, { hand: ['2p', '7s'] as TileId[], fixedSets: [{ kind: 'quad' as const, tile: '1p' as const }, { kind: 'triplet' as const, tile: '4p' as const }, { kind: 'triplet' as const, tile: '3s' as const }, { kind: 'triplet' as const, tile: '9s' as const }] }]) {
      const bag = remainingBag(c).filter(t => c.hand.includes(t) || t === '5p' || t === '4s' || t === '7s').slice(0, 5);
      for (const horizon of [1, 2, 3]) { const m = { ...model, horizon, bag }, actual = solveDecision(c, m), oracle = verifyDecision(c, m); for (const key of ['denominator', 'options', 'accepted', 'recommended', 'fastest'] as const) expect(actual[key]).toEqual(oracle[key]); }
    }
  });
  it('handles exact ties, early absorption, no-win branches, a one-tile bag and zero node budgets', () => {
    for (const bag of [['4s'], ['1s'], ['4s', '7s'], ['1s','2s','4s','7s']] as TileId[][]) { const m = { ...model, bag, horizon: Math.min(2, bag.length) }, actual = solveDecision(ctx, m), oracle = verifyDecision(ctx, m); expect(actual.options).toEqual(oracle.options); expect(actual.accepted).toEqual(oracle.accepted); }
    expect(() => solveDecision(ctx, model, 0)).toThrow('预算');
    expect(solveDecision(ctx, { ...model, bag: ['4s'], horizon: 1 }).options.find(o => o.tile === '9s')?.value).toMatchObject({ score: '1', wins: '1', winTime: '1', ready: '1', readyTime: '0' });
  });
  it('rejects invalid physical pools, completed hands, public chows and unsupported conditions', () => {
    for (const patch of [{ horizon: 0 }, { horizon: 7 }, { horizon: 1.5 }, { bag: [] }, { version: 'unknown' }, { kind: 'unknown' }, { kind: 'remaining' }, { bag: ['2s','2s','2s'] }]) expect(() => validateDecision(ctx, { ...model, ...patch } as never)).toThrow();
    expect(() => validateDecision({ hand: parseHand('123456789p23455s') }, model)).toThrow();
    expect(() => validateDecision({ hand: parseHand('123456789p2256s') }, model)).toThrow();
    expect(() => validateDecision({ hand: parseHand('123456p22569s'), fixedSets: [{ kind:'sequence',tile:'1s' }] }, model)).toThrow();
    expect(() => validateDecision(ctx, { ...model, bag: ['1m'] as never })).toThrow();
  });
  it('matches independent winning decompositions and chooses the highest supported fan interpretation', () => {
    for (const q of decisionQuestions) {
      for (const tile of [...new Set(q.model.bag)].slice(0, 5)) { const hand = [...q.context.hand]; hand.splice(hand.indexOf(q.certificate.recommended), 1); hand.push(tile); const physical = countsOf(hand); if (physical.some(n => n > 4)) continue; const value = scoreCounts(physical, q.context.fixedSets); expect(value?.fan ?? null).toBe(independentFan(hand, q.context.fixedSets)); if (value?.items.some(x => x.id === 'pungs')) expect(value.groups.every(g => g.every(t => t === g[0]))).toBe(true); }
    }
    expect(scoreCounts([])).toBeNull(); expect(scoreCounts(Array(18).fill(-1))).toBeNull(); expect(scoreCounts(countsOf(ctx.hand), Array(5).fill({kind:'triplet',tile:'1p'}))).toBeNull();
    expect(scoreCounts(countsOf(parseHand('123456789p23455s')), [{kind:'sequence',tile:'1p'}])).toBeNull();
    expect(scoreCounts(countsOf(parseHand('111234p55s')), [{kind:'quad',tile:'1p'},{kind:'triplet',tile:'9s'}])).toBeNull();
  });
  it('keeps small nonzero differences visible', () => { expect(percent('1','100000')).toBe('<0.1%'); expect(decimal('1','100000')).toBe('<0.001'); expect(percent('0','100')).toBe('0.0%'); expect(decimal('3','2')).toBe('1.500'); expect(fraction('1','2')).toBe(.5); });
});

describe('training evidence and scheduling', () => {
  it('has 332 unique structures, 80 held-out transfers, simple beginner hands and explicit advanced bags', () => {
    expect(decisionQuestions).toHaveLength(332); expect(new Set(decisionQuestions.map(q=>q.family)).size).toBe(332);
    for (const level of [1,2,3,4]) { expect(decisionQuestions.filter(q=>q.level===level&&q.pool==='practice')).toHaveLength(60); expect(decisionQuestions.filter(q=>q.level===level&&q.pool==='transfer')).toHaveLength(20); expect(decisionQuestions.filter(q=>q.level===level&&q.pool==='example')).toHaveLength(3); }
    expect(decisionQuestions.filter(q=>q.level===1).every(q=>countsOf(q.context.hand).every(n=>n<=2))).toBe(true);
    expect([4,5,6].every(h=>decisionQuestions.some(q=>q.model.horizon===h&&q.model.kind==='explicit'))).toBe(true);
    expect(decisionQuestions.some(q=>q.certificate.fastest!==q.certificate.recommended)).toBe(true);
    expect(()=>decisionQuestion('fake')).toThrow();
  });
  it('counts only first independent decisions and regrades fabricated client correctness', () => {
    const q=practice()[0],s=recordDecision(emptyDecision(),attempt(q));expect(recordDecision(s,attempt(q))).toBe(s);
    const repeated=recordDecision(s,attempt(q,1));expect(independentDecisions(repeated.attempts)).toHaveLength(1);expect(repeated.attempts[1].review).toBe(true);
    const hinted=recordDecision(emptyDecision(),{...attempt(q),assisted:true});expect(independentDecisions(hinted.attempts)).toHaveLength(0);
    expect(()=>recordDecision(s,{...attempt(q,3),answer:'1m' as never})).toThrow();
    const raw=decisionSnapshot(populated(30));const checked=validateDecisionSnapshot({...raw,attempts:raw.attempts.map(a=>({...a,correct:false,loss:1,skill:'fake'}))});expect(checked.state.attempts.every(a=>a.correct&&a.loss===0)).toBe(true);
    const legacy=recordTraining(emptyTraining(),{id:'old-history-evidence',questionId:trainingQuestions[1].id,answer:trainingQuestions[1].accepted[0],assisted:false,durationMs:1,at:new Date().toISOString()});expect(validateDecisionSnapshot(decisionSnapshot(s,trainingSnapshot(legacy))).legacy?.independent).toBe(1);
  });
  it('schedules local 1/3/7-day review and preserves wrong and hinted work', () => {
    const q=practice()[0],now=new Date(2026,9,22,12);let s=recordDecision(emptyDecision(),attempt(q,0,false),now);expect(s.reviews[0].due).toBe('2026-10-22');
    for(const [i,date] of ['2026-10-23','2026-10-25','2026-10-29','2026-10-29'].entries()){s=recordDecision(s,attempt(q,i+1),now);expect(s.reviews[0].due).toBe(date);}
    s=recordDecision(s,{...attempt(q,9),assisted:true},now);expect(s.reviews[0].stage).toBe(0);expect(localDay(now)).toBe('2026-10-22');
  });
  it('recommends one stage at a time, supports manual choice and resets observation windows', () => {
    const s=populated(10);expect(s.recommendation.level).toBe(2);expect(s.recommendation.after).toBe(10);expect(nextRecommendation(s)).toEqual(s.recommendation);
    let down={...emptyDecision(),recommendation:{level:2,after:0}};practice().filter(q=>q.level===2).slice(0,10).forEach((q,i)=>{down=recordDecision(down,attempt(q,i,false));});expect(down.recommendation.level).toBe(1);
    const manual={...s,manualLevel:3};expect(createDecisionSession(manual).questions.every(id=>decisionQuestion(id).level===3)).toBe(true);
    expect(createDecisionSession({...s,manualLevel:4}).questions.every(id=>decisionQuestion(id).model.horizon<=3)).toBe(true);
    expect(createDecisionSession({...s,manualLevel:4,allowDeep:true}).questions.some(id=>decisionQuestion(id).model.horizon>=4)).toBe(true);
    let oneSkill=emptyDecision();decisionQuestions.filter(q=>q.level===1&&q.pool!=='example'&&q.skill==='loose').slice(0,10).forEach((q,i)=>{oneSkill=recordDecision(oneSkill,attempt(q,i));});expect(oneSkill.recommendation.level).toBe(1);
    const source={...emptyDecision(),attempts:practice().map((q,i)=>({...recordDecision(emptyDecision(),attempt(q,i)).attempts[0]}))};expect(createDecisionSession(source).questions).toHaveLength(5);
  });
  it('interleaves due mistakes, unseen held-out transfers, and fills exhausted pools without inventing independent work', () => {
    const q=practice()[0],s=recordDecision(emptyDecision(),attempt(q,0,false),new Date(2026,9,22)),session=createDecisionSession(s,new Date(2026,9,22));expect(session.questions).toHaveLength(5);expect(new Set(session.questions).size).toBe(5);expect(session.questions).toContain(q.id);expect(session.questions.some(id=>decisionQuestion(id).pool==='transfer')).toBe(true);expect(session.questions.every(id=>decisionQuestion(id).pool!=='example')).toBe(true);
    expect(focusSkill(populated(30,false))).toBeTruthy();
  });
  it('keeps hint/review samples separate and divides statistics by model, horizon and level', () => {
    const s=populated(60,false),stats=decisionStats(s);expect(stats.some(x=>x.count>=5&&x.status==='初步观察')).toBe(true);expect(decisionFacts(s).length).toBeGreaterThan(0);expect(compressedDecisions(s).independent).toBe(60);expect(JSON.stringify(compressedDecisions(s)).length).toBeLessThan(30000);
    expect(wilson(0,0)).toBeNull();expect(wilson(0,1)![0]).toBeGreaterThanOrEqual(0);expect(wilson(1,1)![1]).toBeLessThanOrEqual(1.00000001);
    for(const q of practice().filter(q=>q.level===4).slice(0,12)){const a=attempt(q,1000+TILES.indexOf(q.certificate.accepted[0]));if(!s.attempts.some(x=>x.id===a.id)){const next=recordDecision(s,a);expect(decisionStats(next).every(x=>x.horizon>=1&&x.kind)).toBe(true);}}
    for(const q of practice().slice(0,10)){expect(choiceEvidence(q,q.certificate.accepted[0])).toContain('听牌');expect(choiceEvidence(q,q.certificate.options.find(o=>!q.certificate.accepted.includes(o.tile))!.tile)).toContain('平均基础分');}
  });
  it('validates full backups, in-progress physical selection, report shapes and untouched archives', () => {
    let s=emptyDecision();const session=createDecisionSession(s);s={...s,session:{...session,selected:3}};expect(importDecision(s).session?.selected).toBe(3);
    const q=decisionQuestion(session.questions[0]),a=attempt(q);s=recordDecision(s,a);s.session={...s.session!,selected:q.context.hand.indexOf(a.answer),submitted:true,attemptIds:[a.id]};expect(importDecision(s).session?.submitted).toBe(true);
    const backup={...emptyData(),decision:s,drafts:{quiz:{index:7},analysis:{old:true}}};const imported=importData(backup);expect(imported.drafts).toEqual(backup.drafts);expect(imported.decision?.attempts[0].correct).toBe(true);
    for(const patch of [{version:2},{allowDeep:'yes'},{manualLevel:0},{recommendation:{level:5,after:0}},{recommendation:{level:1,after:999}},{reviews:[{questionId:q.id,stage:0,due:'2026-02-31'}]},{reports:[{}]},{session:{...session,selected:99}},{session:{...session,index:5}},{session:{...session,submitted:true,attemptIds:[]}},{session:{...session,questions:[q.id,q.id,q.id,q.id,q.id]}}])expect(()=>importDecision({...s,...patch})).toThrow();
    const profile={version:4,summary:'依据题目',facts:[],suggestion:'先比较整手牌。',evidenceIds:[],focus:'edge',uncertainties:[]};expect(validateDecisionProfile(profile).version).toBe(4);expect(()=>validateDecisionProfile({...profile,focus:'fake'})).toThrow();expect(()=>validateDecisionProfile({...profile,facts:[{}]})).toThrow();
  });
  it('rejects malformed snapshots, fabricated evidence, impossible answers and invalid durations', () => {
    const s=decisionSnapshot(populated(1)),a=s.attempts[0];
    for(const patch of [{id:'!'},{answer:'1m'},{questionId:'missing'},{durationMs:-1},{durationMs:1800001},{at:'invalid'},{assisted:0},{review:null},{questionId:decisionQuestions.find(q=>q.pool==='example')!.id}])expect(()=>validateDecisionSnapshot({...s,attempts:[{...a,...patch}]})).toThrow();
    for(const raw of [null,{...s,schemaVersion:4},{...s,version:'fake'},{...s,attempts:[a,a]},{...s,attempts:null}])expect(()=>validateDecisionSnapshot(raw)).toThrow();
    expect(validateDecisionSnapshot(decisionSnapshot(emptyDecision())).state.attempts).toHaveLength(0);
  });
  it('keeps stable ordering, exact medians and complete archived sessions', () => {
    const qs=practice().filter(q=>q.level===1&&q.skill==='loose');let state=emptyDecision();
    state=recordDecision(state,{...attempt(qs[0],0),durationMs:1000});state=recordDecision(state,{...attempt(qs[1],1),durationMs:3000});expect(decisionStats(state)[0].medianTime).toBe(2000);
    expect(independentDecisions([{...state.attempts[0],id:'zzzzzzzz'}, {...state.attempts[1],id:'aaaaaaaa',at:state.attempts[0].at}])[0].id).toBe('aaaaaaaa');
    expect(independentDecisions(recordDecision(emptyDecision(),{...attempt(),review:true}).attempts)).toHaveLength(0);
    expect(()=>createDecisionSession({...emptyDecision(),manualLevel:99})).toThrow('题库');
    expect(validateDecisionSnapshot(decisionSnapshot(populated(60,false))).focus).toBeTruthy();
    const session=createDecisionSession(emptyDecision());let complete=emptyDecision();const ids:string[]=[];
    session.questions.forEach((id,i)=>{const input=attempt(decisionQuestion(id),i);complete=recordDecision(complete,input);ids.push(input.id);});
    complete.session={...session,index:5,selected:null,submitted:false,attemptIds:ids};expect(importDecision(complete).session?.index).toBe(5);
    expect(()=>importDecision({...complete,session:{...complete.session,submitted:true}})).toThrow();
    expect(importDecision({...complete,manualLevel:2,reviews:[{questionId:qs[0].id,stage:1,due:'2026-10-23'}]}).manualLevel).toBe(2);
    const profile={version:4 as const,summary:'题目证据',facts:[{id:'fact',text:'这手的选择',evidenceIds:[ids[0]]}],suggestion:'先看整手。',evidenceIds:[ids[0]],focus:'loose' as const,uncertainties:['还需要练习。']};
    expect(importDecision({...complete,reports:[{reportId:'report-test',at:new Date().toISOString(),profile}]}).reports).toHaveLength(1);
    for(const patch of [{summary:'a'.repeat(601)},{suggestion:'a'.repeat(601)},{evidenceIds:[1]},{evidenceIds:Array(10).fill('evidence')},{facts:Array(7).fill(profile.facts[0])},{facts:[{...profile.facts[0],evidenceIds:[1]}]},{uncertainties:[1]},{uncertainties:Array(11).fill('unknown')},{uncertainties:null}])expect(()=>validateDecisionProfile({...profile,...patch})).toThrow();
    const one={...complete,session:{...session,submitted:true,selected:decisionQuestion(session.questions[0]).context.hand.indexOf(complete.attempts[0].answer),attemptIds:[ids[0]]}};
    expect(()=>importDecision({...one,session:{...one.session,assisted:true}})).toThrow();expect(()=>importDecision({...one,session:{...one.session,selected:null}})).toThrow();
    for(const patch of [{manualLevel:5},{recommendation:{level:1,after:-1}},{recommendation:{level:1,after:1.5}},{reports:null},{reviews:null}])expect(()=>importDecision({...complete,...patch})).toThrow();
    for(const q of practice().filter(q=>q.level>1).slice(0,30)){const wrong=q.certificate.options.find(o=>!q.certificate.accepted.includes(o.tile))!.tile;expect(choiceEvidence(q,wrong)).toContain('基础分');}
  });
  it('explains actual bag opportunities and observes delayed review without increasing independent samples', () => {
    for(const q of decisionQuestions){const tile=q.certificate.recommended,shape=q.shape.discards.find(o=>o.tile===tile)!;expect(opportunityCount(q,tile)).toBeLessThanOrEqual(shape.ukeire);if(q.model.kind==='remaining')expect(opportunityCount(q,tile)).toBe(shape.ukeire);expect(choiceEvidence(q,tile)).toContain('听牌');}
    const qs=practice().filter(q=>q.level===1&&q.skill==='loose').slice(0,3);let s=emptyDecision();
    qs.forEach((q,i)=>{s=recordDecision(s,attempt(q,i,false));s=recordDecision(s,{...attempt(q,i+100),at:new Date(Date.parse(s.attempts[0].at)+2*86400000+i*1000).toISOString()});});
    expect(independentDecisions(s.attempts)).toHaveLength(3);expect(reviewOutcomes(s)[0]).toMatchObject({count:3,correct:3});expect(decisionFacts(s).some(f=>f.id.startsWith('review:'))).toBe(true);expect(compressedDecisions(s).retention[0].count).toBe(3);
    s=recordDecision(s,{...attempt(qs[0],999,false),at:new Date(Date.parse(s.attempts[0].at)+4*86400000).toISOString()});expect(reviewOutcomes(s)[0].correct).toBe(2);
  });
  it('replays automatic progression server-side and respects explicit difficulty preferences', () => {
    const source=populated(20),checked=validateDecisionSnapshot(decisionSnapshot(source));expect(checked.state.recommendation).toEqual(source.recommendation);
    expect(validateDecisionSnapshot(decisionSnapshot({...source,manualLevel:4,allowDeep:true})).state).toMatchObject({manualLevel:4,allowDeep:true});
    expect(validateDecisionSnapshot({...decisionSnapshot(source),preferences:undefined}).state.manualLevel).toBeUndefined();
    for(const preferences of [{level:0,deep:false},{level:5,deep:false},{level:'auto',deep:'yes'}])expect(()=>validateDecisionSnapshot({...decisionSnapshot(source),preferences})).toThrow();
    const state=recordDecision(emptyDecision(),attempt(practice()[0],0,false));const q=practice()[0],best=BigInt(q.certificate.options.find(o=>o.tile===q.certificate.recommended)!.value.score),chosen=BigInt(q.certificate.options.find(o=>o.tile===state.attempts[0].answer)!.value.score);expect(state.attempts[0].loss).toBe(Number(best-chosen)/Number(best));
  });
});
