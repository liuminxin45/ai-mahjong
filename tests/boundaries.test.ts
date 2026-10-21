import { it, expect } from 'vitest';
import { analyze, countsOf, decompose, formatHand, parseHand, RULES_VERSION, setTiles, validateContext, type TileId } from '../src/engine/index.js';
import { solveDrawModel } from '../src/engine/deep.js';
import { answers, exercise, snapshot, validateSnapshot, validateProfile, solutionText, type Attempt, type ExerciseRef } from '../src/learning/index.js';
import { practiceQuestions, questionBank } from '../src/learning/bank.js';
import { recommendation } from '../src/learning/curriculum.js';
import { diagnose, factualClaims, learningFacts, learningTrends } from '../src/learning/facts.js';

const make=(q=questionBank[0],i=0,correct=true):Attempt=>({id:`boundary-evidence-${i}`,ref:q.ref,answer:correct?[answers(q)[0]]:[],correct,assisted:false,review:false,durationMs:1000+i,exerciseId:q.id,at:new Date(1700000000000+i*1000).toISOString(),...(q.metadata?{difficulty:q.metadata.difficulty,familyId:q.metadata.familyId}:{})});
it('分析器严格拒绝缺失、未知牌、未知组合、错误规则与过多组合，牌谱可以无损转存',()=>{
 const hand=parseHand('123456789p1112s');expect(parseHand(formatHand(hand))).toEqual(hand);
 expect(()=>countsOf(['1m'] as unknown as TileId[])).toThrow(/未知/);
 for(const ctx of [null,{}, {hand, rulesVersion:'future'},{hand,fixedSets:{}},{hand,fixedSets:Array(5).fill({kind:'triplet',tile:'1p'})},{hand,visible:{'1p':-1}},{hand,visible:{'1p':1.5}},{hand,visible:{'1m':1}}])expect(()=>validateContext(ctx as never)).toThrow();
 for(const set of [null,{kind:'eat',tile:'1p'},{kind:'triplet',tile:'0p'}])expect(()=>setTiles(set as never)).toThrow();
 expect(analyze({hand,rulesVersion:RULES_VERSION}).shanten).toBe(0);expect(decompose(parseHand('12p'))).toBeNull();expect(decompose([])).toBeNull();
});
it('非法题目版本、编号、未核验题与不匹配的抽牌模型全部拒绝',()=>{
 for(const ref of [null,{mode:'unknown',seed:0},{mode:'discard',seed:-1},{mode:'discard',seed:2147483648},{mode:'discard',seed:.5},{mode:'discard',seed:0,version:'2.0.0'}])expect(()=>exercise(ref as ExerciseRef)).toThrow();
 const q=questionBank[0];expect(()=>answers({...q,accepted:undefined})).toThrow();const deep=questionBank.find(q=>q.deep)!;expect(()=>answers({...deep,deep:{...deep.deep!,verified:false}})).toThrow();
 expect(exercise({mode:'seven-pairs',seed:28}).context.hand).toHaveLength(14);expect(exercise({mode:'ukeire',seed:28}).context.hand).toHaveLength(13);
 const ctx={hand:parseHand('123456789p11129s')},m={version:1 as const,bag:parseHand('223s'),horizon:2,target:'win' as const,kind:'discard' as const};
 expect(()=>solveDrawModel(ctx,{...m,kind:'first-draw'})).toThrow(/张数/);expect(()=>solveDrawModel(ctx,{...m,safeDiscards:[]})).toThrow(/候选/);expect(()=>solveDrawModel({...ctx,visible:{'2s':3}},m)).toThrow(/四张/);
});
it('快照校验包含来源、时长、标记、重复ID、旧重复题、压缩损坏与格式边界',()=>{
 const a=make(),s=snapshot([a]),e=s.attempts[0];
 for(const patch of [{id:'x'},{id:5},{answer:['1p','1p']},{answer:Array(19).fill('1p')},{assisted:'yes'},{review:1},{durationMs:-1},{durationMs:1800001},{at:'invalid'},{source:'invented'},{competitionRunId:'bad'}])expect(()=>validateSnapshot({...s,attempts:[{...e,...patch}]})).toThrow();
 for(const patch of [{schemaVersion:4},{rulesVersion:'future'},{contentVersion:'future'},{engineVersion:'future'},{attempts:null}])expect(()=>validateSnapshot({...s,...patch})).toThrow();
 expect(()=>validateSnapshot({...s,schemaVersion:1,attempts:[{...e,assisted:false},{...e,id:'another-legacy-evidence',assisted:false}]})).toThrow();
 const timed={...a,source:'competition' as const,competitionRunId:'b28a3c4c-0000-4000-8000-000000000000'};expect(validateSnapshot(snapshot([timed])).attempts[0].source).toBe('competition');
 const refs=practiceQuestions('waits',1).slice(0,2);const ws=snapshot(refs.map((q,i)=>({...make(q,i),answer:[],review:false})));expect(validateSnapshot(ws).attempts.every(a=>!a.correct)).toBe(true);
});
it('画像模型输出须有合法文本、引用和七天课程，拒绝格式与空证据',()=>{
 const s=snapshot(practiceQuestions('discard',1).map((q,i)=>make(q,i))),p={summary:'可核对的记录',strengths:[],weaknesses:[],uncertainties:['暂无实战证据'],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-07',mode:'discard',task:'逐步验证向听。'}))};
 expect(validateProfile(p,s)).toEqual(p);
 for(const patch of [{summary:''},{summary:'x'.repeat(601)},{strengths:{}},{plan:[]},{uncertainties:[5]},{strengths:[{mode:'discard',text:'观察',evidenceIds:[]}]},{weaknesses:[{mode:'wrong',text:'观察',evidenceIds:[s.attempts[0].id]}]}])expect(()=>validateProfile({...p,...patch},s)).toThrow();
 for(const patch of [{day:0},{mode:'unknown'},{lessonId:'lesson-99'},{task:''}])expect(()=>validateProfile({...p,plan:p.plan.map((x,i)=>i===0?{...x,...patch}:x)},s)).toThrow();
});
it('错题诊断区分多向听、少进张、危险牌、七对路线及多步目标，不推断思考原因',()=>{
 const old=exercise({mode:'discard',seed:2}),r=analyze(old.context);
 const worse=r.discards.find(d=>d.shanten>r.discards[0].shanten);expect(worse).toBeDefined();expect(diagnose({...make(old as never),correct:false,answer:[worse!.tile]})[0]).toMatch(/向听/);
 const few=r.discards.find(d=>d.shanten===r.discards[0].shanten&&d.ukeire<r.discards[0].ukeire);if(few)expect(diagnose({...make(old as never),correct:false,answer:[few.tile]})[0]).toMatch(/进张/);
 expect(diagnose(make())).toEqual([]);
 const defense=questionBank.find(q=>q.scenario?.goal==='safety'&&!q.metadata.response)!;expect(diagnose({...make(defense),correct:false,answer:[defense.scenario!.waits[0]]})[0]).toMatch(/危险/);
 const seven=questionBank.find(q=>q.ref.mode==='seven-pairs')!;expect(diagnose({...make(seven),correct:false,answer:[]})[0]).toMatch(/七对/);
 const deep=questionBank.find(q=>q.deep)!;expect(diagnose({...make(deep),correct:false,answer:[]})[0]).toMatch(/抽牌袋/);
 const waits=questionBank.find(q=>q.ref.mode==='waits')!;expect(diagnose({...make(waits),correct:false,answer:[...waits.accepted,'9s' as TileId].filter((t,i,a)=>a.indexOf(t)===i)})[0]).toMatch(/误选|漏选/);
});
it('同档前后各10题才比较趋势；全对、全错和未变化分别有可核对的结论',()=>{
 const qs=practiceQuestions('discard',1),up=qs.map((q,i)=>make(q,i,i>=10)),down=qs.map((q,i)=>make(q,i,i<10)),flat=qs.map((q,i)=>make(q,i));
 expect(learningTrends(up).find(f=>f.id==='fact:discard.distance:1')?.conclusion).toMatch(/提高/);expect(learningTrends(down)[0].conclusion).toMatch(/下降/);expect(learningTrends(flat)[0].conclusion).toMatch(/暂看不出/);expect(learningTrends(flat)[0].recentMs).not.toBeNull();
 expect(factualClaims(learningFacts(flat)).strengths.length).toBeGreaterThan(0);expect(factualClaims(learningFacts(down.map(a=>({...a,correct:false})))).weaknesses.length).toBeGreaterThan(0);
 expect(recommendation('discard',[{...flat[0],familyId:undefined},{...flat[1],familyId:undefined,review:true}]).count).toBe(1);
});
it('每种题型的解析都说明实际判分目标，包含普通与七对路线转换',()=>{
 for(const mode of ['discard','ukeire','waits','seven-pairs','defense'] as const)expect(solutionText(exercise({mode,seed:0})).length).toBeGreaterThan(10);
 const dual=questionBank.find(q=>q.metadata.skillIds.includes('seven-pairs.routes'))!;expect(solutionText(dual)).toMatch(/同时考虑/);expect(solutionText(questionBank.find(q=>q.deep)!)).toMatch(/不放回/);
});
