import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { validateContext, analyze } from '../src/engine/index.js';
import { questionBank, canonicalFamily } from '../src/learning/bank.js';
import { answers, MODES } from '../src/learning/index.js';
import { DIFFICULTIES, SKILLS } from '../src/learning/curriculum.js';
import { verifyModel } from './verify-model.js';
let checked=0;const families=new Set<string>();
for(const q of questionBank){
 validateContext(q.context);if(q.context.fixedSets?.some(s=>s.kind==='sequence'))throw new Error('新题不能有公开顺子');
 const goal=q.metadata.response==='judgment'?`judgment:${!!q.accepted.length}`:q.scenario?.goal;
 const family='family-v2:'+createHash('sha256').update(canonicalFamily(q.ref.mode,q.context,goal,q.scenario?.waits,q.deep?.model,q.metadata.judgmentTile)).digest('hex');
 if(family!==q.metadata.familyId||families.has(family))throw new Error('题目身份不匹配或出现等价重复');families.add(family);
 if(q.metadata.skillIds.some(id=>!SKILLS.some(s=>s.id===id)))throw new Error('未知知识点');
 if(q.deep){const expected=verifyModel(q.context,q.deep.model);if(JSON.stringify(expected)!==JSON.stringify([...q.deep.options].sort((a,b)=>a.tile.localeCompare(b.tile))))throw new Error('多步证书不一致');const best=expected.reduce((v,o)=>BigInt(o.numerator)>v?BigInt(o.numerator):v,0n),tiles=expected.filter(o=>BigInt(o.numerator)===best).map(o=>o.tile).sort();if(JSON.stringify(tiles)!==JSON.stringify([...q.accepted].sort()))throw new Error('最优答案不一致');checked++;}
 else if(q.metadata.response==='judgment'){
  const known=q.accepted.length>0;if(known&&q.scenario!.waits.includes(q.metadata.judgmentTile!))throw new Error('已确认等待与结论矛盾');
  if(!known&&q.scenario!.waits.length)throw new Error('未知判断错误地提供了确认等待');
 }else{const actual=q.metadata.skillIds.includes('seven-pairs.routes')?analyze(q.context).discards.filter(d=>d.best).map(d=>d.tile):answers({...q,metadata:undefined});if(JSON.stringify([...actual].sort())!==JSON.stringify([...q.accepted].sort()))throw new Error('基础答案不一致');}
}
for(const mode of MODES)for(const level of DIFFICULTIES)for(const [pool,n] of [['practice',20],['competition',4]] as const)if(questionBank.filter(q=>q.ref.mode===mode&&q.metadata.difficulty===level&&q.metadata.pool===pool).length!==n)throw new Error('覆盖矩阵不完整');
console.log(`Verified ${questionBank.length} physical questions, ${checked} independent multi-step certificates, all identities and coverage cells.`);
