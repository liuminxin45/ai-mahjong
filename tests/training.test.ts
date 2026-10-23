import {describe,it,expect,vi} from 'vitest';
import {analyze,countsOf,setTiles,TILES,validateContext,type TileId} from '../src/engine/index.js';
import {targetOracle} from '../scripts/target-oracle.js';
import {trainingQuestions,question,structure,feedback,explainChoice,checkAnswer,available} from '../src/training/questions.js';
import {topics,oldLessonTopics,topic,TRAINING_VERSION} from '../src/training/topics.js';
import {compressedTraining,createSession,emptyTraining,evidenceFacts,firstAttempts,importTraining,legacyQuestion,migrateTraining,recordTraining,recommendedTopic,resolveQuestion,sessionQuestion,topicStats,trainingSnapshot,validateBrief,validateTrainingSnapshot,type TrainingState} from '../src/training/core.js';
import {emptyData,importData,localDate} from '../src/learning/storage.js';
import {exercise,answers} from '../src/learning/index.js';
import {questionBank} from '../src/learning/bank.js';
const qs=trainingQuestions.filter(q=>q.topic==='shape').slice(1);
const input=(q=qs[0],i=0,good=true)=>({id:`training-evidence-${i}`,questionId:q.id,answer:good?q.accepted[0]:q.context.hand.find(t=>!q.accepted.includes(t))!,assisted:false,durationMs:1500,at:new Date(1700000000000+i*1000).toISOString()});
const add=(s:TrainingState,q=qs[0],i=0,good=true)=>recordTraining(s,input(q,i,good));
describe('统一舍牌题库',()=>{
 it('8课各12种非等价牌形，前七课全暗手，已成牌不强制舍牌',async()=>{
  expect(trainingQuestions).toHaveLength(96);expect(new Set(trainingQuestions.map(q=>q.family)).size).toBe(96);
  for(const t of topics)expect(trainingQuestions.filter(q=>q.topic===t.id)).toHaveLength(12);
  for(const q of trainingQuestions){validateContext(q.context);expect(q.family).toBe(structure(q.context));expect(q.context.fixedSets?.some(s=>s.kind==='sequence')).toBeFalsy();if(q.topic!=='combined')expect(q.context.hand).toHaveLength(14);if(q.topic!=='visible')expect(q.context.visible).toBeUndefined();expect(question(q.id)).toBe(q);for(const t of available(q.context))expect(checkAnswer(q,t)).toBe(q.accepted.includes(t));await new Promise<void>(r=>setImmediate(r));}
  expect(()=>question('unknown')).toThrow();expect(topic('unknown').id).toBe('shape');expect(Object.keys(oldLessonTopics)).toHaveLength(24);
  const q=qs[0];expect(structure({hand:q.context.hand.map(t=>t[1]==='p'?`${10-Number(t[0])}p` as TileId:t)})).toBe(q.family);
 });
 it('96题逐舍牌与独立完整目标枚举器对照，余量正确，接受全部精确并列',async()=>{
  let tied=0;
  for(const q of trainingQuestions){
   const fixed=q.context.fixedSets??[],physical=countsOf(fixed.flatMap(setTiles)),known=countsOf([...q.context.hand,...fixed.flatMap(setTiles)]);for(const [t,n] of Object.entries(q.context.visible??{}))known[TILES.indexOf(t as TileId)]+=n!;
   const result=analyze(q.context);expect(result.shanten).toBeGreaterThanOrEqual(0);const rows=result.discards;
   for(const d of rows){const hand=[...q.context.hand];hand.splice(hand.indexOf(d.tile),1);const c=countsOf(hand);const normal=targetOracle(c,fixed.length,physical),seven=fixed.length?99:6-c.reduce((n,c)=>n+Math.floor(c/2),0),expected=Math.min(normal,seven);expect(d.shanten,`${q.id} discard ${d.tile} ${JSON.stringify(q.context)}`).toBe(expected);let ukeire=0;
    for(let i=0;i<18;i++){if(known[i]===4)continue;c[i]++;const after=Math.min(targetOracle(c,fixed.length,physical),fixed.length?99:6-c.reduce((n,c)=>n+Math.floor(c/2),0));c[i]--;if(after<expected)ukeire+=4-known[i];}expect(d.ukeire,`${q.id} discard ${d.tile}`).toBe(ukeire);
   }
   expect(q.accepted.slice().sort()).toEqual(rows.filter(d=>d.best).map(d=>d.tile).sort());if(q.accepted.length>1)tied++;await new Promise<void>(r=>setImmediate(r));
  }
  expect(tied).toBeGreaterThan(0);
 },600000);
 it('反馈只陈述距离与机会，不推测思考原因',()=>{
  let distance=false,chances=false,tie=false;
  for(const q of trainingQuestions){expect(explainChoice(q)).toMatch(/打掉/);const r=analyze(q.context);for(const d of r.discards){const text=feedback(q,d.tile);if(d.best){expect(text).toMatch(/相同|最多/);if(q.accepted.length>1)tie=true;}else if(d.shanten>r.discards[0].shanten){expect(text).toMatch(/多\d步/);distance=true;}else{expect(text).toMatch(/多保留了\d+张/);chances=true;}}}
  expect([distance,chances,tie]).toEqual([true,true,true]);expect(()=>feedback(qs[0],TILES.find(t=>!qs[0].context.hand.includes(t))!)).toThrow();
  for(const base of [qs[0],trainingQuestions.find(q=>analyze(q.context).discards[0].shanten>0)!]){const count=countsOf(base.context.hand),dead={...base,context:{...base.context,visible:Object.fromEntries(TILES.map((t,i)=>[t,4-count[i]]))}};expect(explainChoice(dead)).toMatch(/见尽|没有仍有余量/);}
 });
});
describe('独立样本、分组和历史迁移',()=>{
 it('提示与反复作答不增加独立样本，重复提交幂等；复习采用本地1/3/7天',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,22,15));let s=add(emptyTraining(),qs[0],0,false);expect(s.reviews[0].due).toBe('2026-10-22');expect(add(s,qs[0],0)).toBe(s);
  s=add(s,qs[0],1);expect(s.reviews[0].due).toBe('2026-10-23');s=add(s,qs[0],2);expect(s.reviews[0].due).toBe('2026-10-25');s=add(s,qs[0],3);expect(s.reviews[0].due).toBe('2026-10-29');s=add(s,qs[0],4);expect(s.reviews[0].stage).toBe(3);expect(firstAttempts(s.attempts)).toHaveLength(1);
  s=recordTraining(s,{...input(qs[1],5),assisted:true});s=add(s,qs[1],6);expect(firstAttempts(s.attempts)).toHaveLength(1);expect(s.reviews.find(m=>m.questionId===qs[1].id)?.stage).toBe(1);
  expect(()=>recordTraining(s,{...input(qs[2],7),answer:TILES.find(t=>!qs[2].context.hand.includes(t))!})).toThrow();vi.useRealTimers();
 });
 it('3当前新题、1到期复习、1新结构；无错题补新，例题不当作独立测量',()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,22,12));try{
  let s=add(emptyTraining(),qs[0],0,false);const x=createSession(s,'pairs',false,new Date(2026,9,22),'session-01');expect(x.questions).toHaveLength(5);expect(x.questions[3]).toBe(qs[0].id);expect(new Set(x.questions).size).toBe(5);expect(sessionQuestion(s,x).topic).toBe('pairs');expect(x.questions.some(id=>id.endsWith(':01'))).toBe(false);
  expect(createSession(s,'pairs',true).questions[0]).toBe(qs[0].id);expect(createSession(emptyTraining()).questions).toHaveLength(5);
  for(let i=1;i<11;i++)s=add(s,qs[i],i);const exhausted=createSession(s,'shape');expect(exhausted.questions).toHaveLength(5);
  }finally{vi.useRealTimers();}
 });
 it('最近10种结构8正确才引入下一课，手动指定优先，阅读不当作掌握',()=>{
  let s=emptyTraining();s.read=topics.map(t=>t.id);expect(recommendedTopic(s)).toBe('shape');
  for(let i=0;i<9;i++)s=add(s,qs[i],i,i<8);expect(recommendedTopic(s)).toBe('shape');s=add(s,qs[9],9,false);expect(recommendedTopic(s)).toBe('pairs');expect(createSession(s,'shape').questions.some(id=>question(id).topic==='pairs')).toBe(true);expect(createSession(s,'seven').topic).toBe('seven');
  let weak=emptyTraining();for(let i=0;i<5;i++)weak=add(weak,qs[i],i,false);expect(topicStats(weak)[0].status).toBe('建议复习');expect(evidenceFacts(weak).length).toBeGreaterThan(0);
  let all=emptyTraining();let i=0;for(const t of topics)for(const q of trainingQuestions.filter(q=>q.topic===t.id).slice(1,11))all=add(all,q,i++);expect(recommendedTopic(all)).toBe('combined');
 });
 it('只接纳同目标的旧何切；旧答卷、非何切与多步仍完整存档',()=>{
  const legacy=questionBank.find(q=>q.ref.mode==='discard'&&!q.deep&&q.metadata.pool==='practice')!,deep=questionBank.find(q=>q.ref.mode==='discard'&&q.deep)!,competition=questionBank.find(q=>q.ref.mode==='discard'&&q.metadata.pool==='competition')!;
  for(const q of [deep,competition,questionBank.find(q=>q.ref.mode==='defense')!])expect(()=>legacyQuestion(q.ref)).toThrow();
  const old=exercise({mode:'discard',seed:0}),data=emptyData();data.drafts.quiz={index:2};
  data.attempts=[legacy,deep,competition,old].map((q,i)=>({id:`legacy-attempt-${i}`,ref:q.ref,answer:[answers(q)[0]],assisted:false,review:false,durationMs:1000,at:new Date(1700000000000+i*1000).toISOString(),exerciseId:q.id,correct:false}));
  const s=migrateTraining(data);expect(s.attempts).toHaveLength(2);expect(s.attempts.every(a=>a.correct)).toBe(true);expect(data.attempts).toHaveLength(4);expect(data.drafts.quiz).toEqual({index:2});expect(migrateTraining({...data,training:s})).toBe(s);expect(()=>resolveQuestion('forged',old.ref)).toThrow();
  data.training=s;const imported=importData(JSON.parse(JSON.stringify(data)));expect(imported.training?.attempts).toHaveLength(2);expect(imported.drafts.quiz).toEqual({index:2});
  const archived=emptyData();archived.attempts=[...data.attempts.map(a=>({...a,source:'competition' as const})),{...data.attempts[0],answer:[]}];expect(migrateTraining(archived).attempts).toHaveLength(0);
  const wrong={...data.attempts[0],id:'legacy-browser-wrong',answer:[legacy.context.hand.find(t=>!legacy.accepted!.includes(t))!]};const withReview={...emptyData(),attempts:[wrong],mistakes:[{ref:legacy.ref,exerciseId:legacy.id,stage:2,due:'2026-10-25',favorite:true}]};expect(migrateTraining(withReview).reviews[0].stage).toBe(2);expect(migrateTraining({...withReview,mistakes:[]}).reviews[0].stage).toBe(0);expect(legacyQuestion(legacy.ref)).toBe(legacyQuestion(legacy.ref));
 });
 it('新版备份校验并恢复单张选择、提示、已答状态与课程进度',()=>{
  let s=add(emptyTraining());s.read=['shape','bogus'];s.session=createSession(s);s.session.selected=2;s.session.assisted=true;s.session.attemptIds=[];
  const restored=importTraining(JSON.parse(JSON.stringify(s)));expect(restored.session).toEqual(s.session);expect(restored.read).toEqual(['shape']);expect(()=>importTraining({...s,session:{...s.session,selected:99}})).toThrow();expect(()=>importTraining({...s,reviews:[{questionId:qs[0].id,stage:7,due:localDate()}]})).toThrow();expect(()=>importTraining({})).toThrow();
  expect(()=>importTraining({...s,session:{...s.session,attemptIds:[s.attempts[0].id]}})).toThrow();
  let complete=emptyTraining();const session=createSession(complete);for(let i=0;i<5;i++){const q=question(session.questions[i]);complete=add(complete,q,i);session.attemptIds.push(complete.attempts.at(-1)!.id);session.index=i;session.selected=q.context.hand.indexOf(q.accepted[0]);session.submitted=true;complete.session={...session};expect(importTraining(complete).session?.submitted).toBe(true);}
  expect(()=>importTraining({...complete,session:{...session,selected:null}})).toThrow();expect(()=>importTraining({...complete,session:{...session,assisted:true}})).toThrow();expect(()=>importTraining({...complete,session:{...session,attemptIds:[...session.attemptIds.slice(0,4),'missing-attempt']}})).toThrow();session.index=5;session.selected=null;session.submitted=false;complete.session=session;expect(importTraining(complete).session?.index).toBe(5);expect(()=>importTraining({...complete,session:{...session,selected:0}})).toThrow();expect(()=>importTraining({...complete,session:{...session,questions:[]}})).toThrow();
 });
});
describe('学习小结证据边界',()=>{
 it('全历史重判与压缩，不能信任客户端正确率或伪造知识点',()=>{
  let s=emptyTraining();for(let i=0;i<11;i++)s=add(s,qs[i],i,i<8);for(let i=11;i<211;i++)s=add(s,qs[0],i);
  const snap=trainingSnapshot(s),checked=validateTrainingSnapshot({...snap,attempts:snap.attempts.map(a=>({...a,correct:true,topic:'combined'}))});expect(checked.state.attempts).toHaveLength(211);expect(firstAttempts(checked.state.attempts)).toHaveLength(11);expect(checked.state.attempts.filter(a=>!a.correct)).toHaveLength(3);const compressed=compressedTraining(checked.state);expect(compressed.total).toBe(211);expect(compressed.cases.length).toBeLessThanOrEqual(20);expect(JSON.stringify(compressed).length).toBeLessThan(15000);
  const p={version:3,summary:'学习小结',facts:checked.facts,suggestion:'先看例题，再试一组舍牌。',topic:checked.topic,uncertainties:['尚不能说明实战能力。']};expect(validateBrief(p)).toEqual(p);expect(()=>validateBrief({...p,topic:'fake'})).toThrow();expect(()=>validateBrief({...p,facts:[{text:'无证据'}]})).toThrow();
  expect(importTraining({...s,reports:[{reportId:'report-old',profile:p,at:new Date().toISOString()}]}).reports).toHaveLength(1);expect(()=>importTraining({...s,reports:[{profile:p,at:'bad'}]})).toThrow();
  for(const patch of [{summary:5},{summary:'a'.repeat(601)},{suggestion:5},{suggestion:'a'.repeat(301)},{facts:Array(21).fill({text:'a',evidenceIds:[]})},{facts:[{text:5,evidenceIds:[]}]},{facts:[{text:'a',evidenceIds:[1]}]},{uncertainties:Array(11).fill('a')},{uncertainties:[1]}])expect(()=>validateBrief({...p,...patch})).toThrow();
 });
 it('拒绝空记录、重复ID、未来题号、第五花色、非法时长与伪造旧题',()=>{
  const snap=trainingSnapshot(add(emptyTraining()));expect(()=>validateTrainingSnapshot({...snap,attempts:[]})).toThrow();expect(()=>validateTrainingSnapshot({...snap,version:'future'})).toThrow();expect(()=>validateTrainingSnapshot({...snap,attempts:[...snap.attempts,...snap.attempts]})).toThrow();
  for(const patch of [{answer:'1m'},{questionId:'future:1'},{durationMs:-1},{durationMs:1800001},{durationMs:1.2},{at:'bad'},{assisted:1},{review:1},{id:'x'},{legacyRef:questionBank.find(q=>q.deep)!.ref}])expect(()=>validateTrainingSnapshot({...snap,attempts:[{...snap.attempts[0],...patch}]})).toThrow();
 });
});
