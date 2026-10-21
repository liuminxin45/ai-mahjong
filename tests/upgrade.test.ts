import { describe, it, expect } from 'vitest';
import { analyze, countsOf, parseHand, setTiles, TILES, validateContext, type TileId } from '../src/engine/index.js';
import { solveDrawModel } from '../src/engine/deep.js';
import { verifyModel } from '../scripts/verify-model.js';
import { answers, exercise, grade, snapshot, validateSnapshot, packSnapshot, MODES, type Attempt } from '../src/learning/index.js';
import { questionBank, practiceQuestions } from '../src/learning/bank.js';
import { BANK_VERSION, DIFFICULTIES, SKILLS, recommendation } from '../src/learning/curriculum.js';
import { diagnose, learningFacts, learningTrends, wilson } from '../src/learning/facts.js';
import { competitionPapers, publicQuestion } from '../src/learning/competition.js';
import { emptyData, importData, recordAttempt } from '../src/learning/storage.js';

const attempt=(q=questionBank[0],i=0,correct=true):Attempt=>({id:`upgrade-evidence-${q.ref.mode}-${q.ref.seed}-${i}`,ref:q.ref,answer:correct?(q.metadata.response==='judgment'||q.ref.mode==='waits'||q.ref.mode==='ukeire'?answers(q):[answers(q)[0]]):[],assisted:false,review:false,durationMs:1000+i*100,at:new Date(1700000000000+i*1000).toISOString(),correct,exerciseId:q.id,difficulty:q.metadata.difficulty,familyId:q.metadata.familyId});
describe('分级题库、统计与兼容',()=>{
 it('30个覆盖格各有20道练习和4道比赛，排除全部等价变换',()=>{
  expect(questionBank).toHaveLength(720);expect(new Set(questionBank.map(q=>q.metadata.familyId)).size).toBe(720);
  for(const mode of MODES)for(const level of DIFFICULTIES){expect(practiceQuestions(mode,level)).toHaveLength(20);expect(questionBank.filter(q=>q.ref.mode===mode&&q.metadata.difficulty===level&&q.metadata.pool==='competition')).toHaveLength(4);}
  for(const q of questionBank){validateContext(q.context);expect(q.context.fixedSets?.some(s=>s.kind==='sequence')??false).toBe(false);expect(q.metadata.skillIds.every(id=>SKILLS.some(s=>s.id===id))).toBe(true);expect(exercise(q.ref).id).toBe(q.id);}
 });
 it('六份比赛卷固定且五类各四题，不暴露提前解析或机器答案',()=>{
  expect(competitionPapers).toHaveLength(6);
  for(const p of competitionPapers){expect(p.refs).toHaveLength(20);for(const mode of MODES)expect(p.refs.filter(r=>r.mode===mode)).toHaveLength(4);}
  const q=questionBank.find(q=>q.deep)!;const view=publicQuestion(q);
  expect(view).not.toHaveProperty('accepted');expect(view).not.toHaveProperty('deep');expect(view.model?.horizon).toBe(2);
 });
 it('20题17正确升级，10正确不降级，9正确降级；提示重复和其他难度不混算',()=>{
  const l1=practiceQuestions('discard',1).map((q,i)=>attempt(q,i,i<17));expect(recommendation('discard',l1).level).toBe(2);
  expect(recommendation('discard',l1.slice(0,19)).level).toBe(1);
  const l2=practiceQuestions('discard',2).map((q,i)=>attempt(q,20+i,i<10));expect(recommendation('discard',[...l1,...l2]).level).toBe(2);
  expect(recommendation('discard',[...l1,...l2.map((a,i)=>i===9?{...a,correct:false}:a)]).level).toBe(1);
  expect(recommendation('discard',l1.map(a=>({...a,assisted:true}))).count).toBe(0);
  expect(recommendation('discard',Array.from({length:30},(_,i)=>({...l1[0],id:`duplicate-evidence-${i}`}))).count).toBe(1);
  const all=DIFFICULTIES.flatMap(l=>practiceQuestions('discard',l).map((q,i)=>attempt(q,l*20+i)));
  expect(recommendation('discard',all).level).toBe(5);
 });
 it('Wilson区间处理全对、全错、小样本与非法统计',()=>{
  expect(wilson(0,0)).toBeNull();expect(wilson(20,20)![0]).toBeCloseTo(.8388748,5);expect(wilson(0,20)![1]).toBeCloseTo(.1611252,5);expect(wilson(1,1)![0]).toBeCloseTo(.206549,5);
  expect(()=>wilson(2,1)).toThrow();expect(()=>wilson(-1,5)).toThrow();expect(()=>wilson(0,1.2)).toThrow();
 });
 it('知识点按难度分层，仅正确、独立、正常的练习时间参与速度统计',()=>{
  const low=practiceQuestions('discard',1).slice(0,10).map((q,i)=>attempt(q,i)),high=practiceQuestions('discard',2).slice(0,10).map((q,i)=>attempt(q,20+i,false));
  const fs=learningFacts([...low,...high,{...low[0],id:'hinted-evidence-00',assisted:true},{...low[1],id:'repeat-evidence-00'}]);
  expect(fs.find(f=>f.level===1&&f.skillId==='discard.distance')?.count).toBe(10);expect(fs.find(f=>f.level===2&&f.skillId==='discard.distance')?.correct).toBe(0);expect(fs.find(f=>f.level===2)?.medianMs).toBeNull();expect(learningTrends([...low,...high])).toHaveLength(0);
  expect(learningFacts(low.map(a=>({...a,source:'competition'})))[0].medianMs).toBeNull();
 });
 it('新快照无损保留版本，重判正确率并丢弃伪造难度；旧记录保持原题',()=>{
  const a=attempt(),old=exercise({mode:'discard',seed:0}),legacy={...a,id:'legacy-upgrade-evidence',ref:old.ref,exerciseId:old.id,difficulty:undefined,familyId:undefined};
  const s=snapshot([a,legacy]);expect(s.schemaVersion).toBe(3);const checked=validateSnapshot(packSnapshot(s));expect(checked.attempts[0].ref.version).toBe(BANK_VERSION);expect(checked.attempts[1].ref.version).toBeUndefined();
  expect(validateSnapshot({...s,attempts:s.attempts.map(x=>({...x,difficulty:6,correct:false}))}).attempts[0].difficulty).toBe(1);
  expect(()=>validateSnapshot({...s,attempts:[{...s.attempts[0],ref:{...a.ref,version:'future'}}]})).toThrow();
  expect(importData({...emptyData(),attempts:[a,legacy]}).attempts).toHaveLength(2);
 });
 it('提示后再答和重复挑战均只记复习，错误诊断来自答案差异',()=>{
  const a=attempt();let d=recordAttempt(emptyData(),{...a,assisted:true});d=recordAttempt(d,{...a,id:'after-hint-independent'});expect(d.attempts[1].review).toBe(true);
  const q=questionBank.find(q=>q.ref.mode==='waits'&&q.accepted.length>1)!;expect(diagnose({...attempt(q),correct:false,answer:q.accepted.slice(1)})).toContain('漏选1种');
  const f=learningFacts(practiceQuestions('discard',1).map((q,i)=>attempt(q,i,false)));expect(f.find(x=>x.skillId==='discard.distance')?.finding).toBe('weakness');
 });
 it('安全信息判断同时包含证据不足与明确当前集合，空答案表示主动选择信息不足',()=>{
  const unknown=questionBank.find(q=>q.metadata.response==='judgment'&&!q.accepted.length)!,known=questionBank.find(q=>q.metadata.response==='judgment'&&q.accepted.length)!;
  expect(grade(unknown,[])).toBe(true);expect(grade(unknown,[unknown.metadata.judgmentTile!])).toBe(false);expect(grade(known,[])).toBe(false);expect(grade(known,[known.metadata.judgmentTile!])).toBe(true);
  expect(validateSnapshot(snapshot([attempt(unknown)])).attempts[0].correct).toBe(true);
 });
});
describe('有限抽牌袋精确求解',()=>{
 it('提前成牌吸收后续路径，整数答案与独立路径枚举一致',()=>{
  const ctx={hand:parseHand('123456789p11129s')},model={version:1 as const,bag:parseHand('223s'),horizon:2,target:'win' as const,kind:'discard' as const};
  const solved=solveDrawModel(ctx,model);expect(solved.options.sort((a,b)=>a.tile.localeCompare(b.tile))).toEqual(verifyModel(ctx,model));expect(solved.answers).toContain('9s');expect(solved.branches.length).toBeGreaterThan(0);
 });
 it('条件首摸按相同分母比较；七对包含四张贡献两对',()=>{
  const ctx={hand:parseHand('1111223344p556s')},model={version:1 as const,bag:parseHand('566s'),horizon:2,target:'seven-pairs' as const,kind:'first-draw' as const};
  expect(solveDrawModel(ctx,model).options.sort((a,b)=>a.tile.localeCompare(b.tile))).toEqual(verifyModel(ctx,model));
 });
 it('固定碰杠和安全候选都遵守物理牌数；非法模型或预算耗尽不得发布',()=>{
  const ctx={hand:parseHand('123456p22s'),fixedSets:[{kind:'triplet' as const,tile:'9s' as const},{kind:'quad' as const,tile:'8s' as const}]};
  const model={version:1 as const,bag:parseHand('123p'),horizon:2,target:'win' as const,kind:'discard' as const,safeDiscards:['1p' as const]};expect(solveDrawModel(ctx,model).options).toHaveLength(1);
  expect(()=>solveDrawModel(ctx,{...model,bag:['8s','8s']})).toThrow(/四张/);expect(()=>solveDrawModel(ctx,{...model,horizon:7})).toThrow();expect(()=>solveDrawModel(ctx,{...model,target:'seven-pairs'})).toThrow();expect(()=>solveDrawModel(ctx,model,0)).toThrow(/预算/);
 });
 it('已发布大师和地狱题的独立校验包含6摸窗口与精确并列',()=>{
  for(const level of [5,6])for(const mode of ['discard','ukeire','seven-pairs','defense']){
   const q=questionBank.find(q=>q.ref.mode===mode&&q.metadata.difficulty===level&&q.deep&&(level===5||q.deep.model.horizon===6))!;
   expect(q.deep?.verified).toBe(true);expect(q.deep!.options.slice().sort((a,b)=>a.tile.localeCompare(b.tile))).toEqual(verifyModel(q.context,q.deep!.model));
  }
 },120000);
});
