import { describe,it,expect } from 'vitest';
import { analyze,parseHand,validateContext,type TileId } from '../src/engine/index.js';
import { answers,compressLearningEvidence,CURATED_HANDS,dimensions,exercise,grade,lessons,MODES,packSnapshot,QUIZ_MODES,scenarios,snapshot,uniqueAttempts,validateProfile,validateSnapshot,type Attempt } from '../src/learning/index.js';
import { dueDate,emptyData,importData,LearningRepository,recordAttempt } from '../src/learning/storage.js';
import 'fake-indexeddb/auto';
const make=(seed:number,mode:'discard'|'waits'='discard'):Attempt=>{const q=exercise({mode,seed});return{id:`evidence-${seed}-${mode}`,ref:q.ref,answer:answers(q).slice(0,mode==='waits'?99:1),assisted:false,durationMs:1000,at:new Date(2026,9,1,0,0,seed).toISOString(),correct:false,exerciseId:q.id,review:false};};
describe('课程、题库与证据',()=>{
 it('24节课程和80道种子题均可分析',async()=>{expect(lessons).toHaveLength(24);expect(CURATED_HANDS).toHaveLength(40);expect(scenarios).toHaveLength(40);for(const l of lessons){validateContext({hand:parseHand(l.example)});expect(l.paragraphs.length).toBeGreaterThanOrEqual(2);}for(const mode of MODES)for(let seed=0;seed<(mode==='defense'?40:10);seed++){const q=exercise({mode,seed});validateContext(q.context);const a=answers(q);expect(a.length).toBeGreaterThan(0);expect(grade(q,mode==='waits'||mode==='ukeire'?a:[a[0]])).toBe(true);await new Promise<void>(r=>setImmediate(r));}});
 it('按种子复现，生成听牌可拆，七对可双计四张',async()=>{for(let seed=10;seed<35;seed++){expect(exercise({mode:'discard',seed})).toEqual(exercise({mode:'discard',seed}));const q=exercise({mode:'waits',seed});expect(analyze(q.context).waits.length).toBeGreaterThan(0);await new Promise<void>(r=>setImmediate(r));}expect(QUIZ_MODES.filter(m=>m==='discard')).toHaveLength(10);expect(QUIZ_MODES.filter(m=>m==='defense')).toHaveLength(4);});
 it('重判客户端正确率，拒绝重复证据和非法牌',()=>{const list=Array.from({length:20},(_,i)=>make(i));const s=snapshot(list);expect(validateSnapshot(s).attempts.every(a=>a.correct)).toBe(true);expect(()=>validateSnapshot({...s,attempts:[...s.attempts.slice(0,19),s.attempts[0]]})).toThrow();expect(()=>validateSnapshot({...s,attempts:s.attempts.map((a,i)=>i? a:{...a,answer:['1m']})})).toThrow();});
 it('重复题、提示题和复习不增加独立样本',()=>{const a=make(0),b={...a,id:'another-000',at:new Date(2026,10,1).toISOString()},c={...make(1),assisted:true},d={...make(2),review:true};expect(uniqueAttempts([a,b,c,d])).toHaveLength(1);expect(dimensions([a])[0].accuracy).toBeNull();});
 it('一次作答或12道何切即可生成初步报告，零记录不可提交',()=>{expect(()=>snapshot([])).toThrow();expect(validateSnapshot(snapshot([make(0)])).attempts).toHaveLength(1);expect(validateSnapshot(snapshot(Array.from({length:12},(_,i)=>make(i)))).dimensions[0].count).toBe(12);});
 it('全部历史超过100题仍保留，早期错题进入压缩证据与全量统计',()=>{
   const list=Array.from({length:112},(_,i)=>({...make(i),...(i===0?{answer:[]}:{} )}));
   const checked=validateSnapshot(snapshot(list)),compressed=compressLearningEvidence(checked.attempts);
   expect(checked.attempts).toHaveLength(112);expect(checked.attempts[0].correct).toBe(false);
   expect(compressed.totals.independent).toBe(112);expect(compressed.totals.independentCorrect).toBe(111);expect(compressed.evidence.some(a=>a.id===list[0].id)).toBe(true);
   expect(compressed.periods.reduce((n,p)=>n+p.attempts,0)).toBe(112);expect(compressed.evidence.length).toBeLessThanOrEqual(40);
 });
 it('提示和重复复习参与统计但不扩大独立样本，防止换种子重复计算攻防题',()=>{
   const a=make(0),hint={...make(1),assisted:true};
   const repeats=Array.from({length:120},(_,i)=>({...a,id:`repeat-${i}-history`,review:false,at:new Date(Date.parse(a.at)+(i+10)*1000).toISOString()}));
   const q=exercise({mode:'defense',seed:0}),b={...a,id:'defense-evidence-0',ref:q.ref,answer:[answers(q)[0]],exerciseId:q.id},alias={...b,id:'defense-evidence-40',ref:{mode:'defense' as const,seed:40}};
   const checked=validateSnapshot(snapshot([a,hint,...repeats,b,alias])),compressed=compressLearningEvidence(checked.attempts);
   expect(compressed.totals.attempts).toBe(124);expect(compressed.totals.independent).toBe(2);expect(compressed.totals.assisted).toBe(1);expect(compressed.totals.reviews).toBe(121);
   const p={summary:'初步记录',strengths:[{mode:'discard',text:'不能用重复题凑足证据',evidenceIds:[a.id]}],weaknesses:[],uncertainties:[],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-10',mode:'discard',task:'练习'}))};
   expect(()=>validateProfile(p,checked.snapshot)).toThrow(/证据/);
   expect(JSON.stringify(compressed).length).toBeLessThan(20000);
 });
 it('无损压缩可重判分，拒绝损坏的位图；兼容旧版报告备份',()=>{
   const s=snapshot(Array.from({length:12},(_,i)=>make(i))),packed=packSnapshot(s);
   expect(validateSnapshot(packed)).toEqual(validateSnapshot(s));
   expect(()=>validateSnapshot({...packed,attempts:[[...packed.attempts[0].slice(0,3),-1,...packed.attempts[0].slice(4)]]})).toThrow();
   const legacy={...s,schemaVersion:1,attempts:s.attempts.map(({review,...a})=>a)},profile={summary:'旧版报告',strengths:[{mode:'discard',text:'有真实证据',evidenceIds:[s.attempts[0].id]}],weaknesses:[],uncertainties:[],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-10',mode:'discard',task:'练习'}))};
   const imported=importData({...emptyData(),attempts:[],profiles:[{reportId:'legacy-report',at:new Date().toISOString(),snapshot:legacy,profile}]});
   expect(imported.profiles[0].profile.summary).toBe('旧版报告');expect(validateSnapshot(imported.profiles[0].snapshot).attempts).toHaveLength(12);
 });
 it('错题按本地日历分阶段安排，导入不相信正确率',()=>{let d=recordAttempt(emptyData(),{...make(0),answer:['1p']});expect(d.mistakes).toHaveLength(1);d=recordAttempt(d,make(0));expect(d.mistakes[0].stage).toBe(1);expect(d.mistakes[0].due).toBe(dueDate(1));const clean=importData({...emptyData(),attempts:[make(0)]});expect(clean.attempts[0].correct).toBe(true);});
 it('IndexedDB事务保存可重新读取',async()=>{const r=new LearningRepository();await r.open();const d=recordAttempt(emptyData(),make(0));await r.save(d);r.close();const next=new LearningRepository();expect((await next.open()).attempts).toHaveLength(1);next.close();});
 it('拒绝不在课程或证据中的模型引用',()=>{const s=snapshot(Array.from({length:20},(_,i)=>make(i)));const p={summary:'练习表现',strengths:[{text:'有依据',evidenceIds:['unknown']}],weaknesses:[],uncertainties:['没有实战数据'],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-01',mode:'discard',task:'练习'}))};expect(()=>validateProfile(p,s)).toThrow(/证据/);});
});
