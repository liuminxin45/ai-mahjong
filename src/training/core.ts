import { analyze, TILES, type TileId } from '../engine/index.js';
import { exercise, answers as oldAnswers, type ExerciseRef } from '../learning/index.js';
import type { LearningData } from '../learning/storage.js';
import { dueDate, localDate } from '../learning/storage.js';
import { feedback, question, structure, trainingQuestions, type TrainingQuestion } from './questions.js';
import { oldLessonTopics, topic, topics, TRAINING_VERSION, type TopicId } from './topics.js';
export type TrainingAttempt={id:string;questionId:string;answer:TileId;assisted:boolean;durationMs:number;at:string;correct:boolean;review:boolean;topic:TopicId;family:string;legacyRef?:ExerciseRef};
export type ReviewItem={questionId:string;stage:number;due:string;legacyRef?:ExerciseRef};
export type TrainingSession={id:string;topic:TopicId;questions:string[];index:number;selected:number|null;assisted:boolean;submitted:boolean;attemptIds:string[]};
export type BriefReport={version:3;summary:string;facts:{text:string;evidenceIds:string[]}[];suggestion:string;topic:TopicId;uncertainties:string[]};
export type SavedBrief={reportId:string;profile:BriefReport;at:string};
export type TrainingState={version:1;attempts:TrainingAttempt[];reviews:ReviewItem[];read:string[];session?:TrainingSession;reports:SavedBrief[];migrated:boolean};
export const emptyTraining=():TrainingState=>({version:1,attempts:[],reviews:[],read:[],reports:[],migrated:true});
const legacyCache=new Map<string,TrainingQuestion>();
export function legacyQuestion(ref:ExerciseRef):TrainingQuestion{
 const key=JSON.stringify([ref.mode,ref.seed,ref.version]);const cached=legacyCache.get(key);if(cached)return cached;
 const q=exercise(ref),r=analyze(q.context),accepted=r.discards.filter(d=>d.best).map(d=>d.tile);
 if(q.ref.mode!=='discard'||q.deep||q.scenario||q.context.fixedSets?.some(s=>s.kind==='sequence')||q.metadata?.pool==='competition'||q.metadata?.response==='judgment'||!accepted.length||r.shanten<0||(oldAnswers(q).length!==accepted.length||oldAnswers(q).some(t=>!accepted.includes(t))))throw new Error('这道旧题不属于相同目标的舍牌练习。');
 const result:TrainingQuestion={id:q.id,topic:q.context.fixedSets?.length?'combined':Object.values(q.context.visible??{}).some(n=>n!>0)?'visible':oldLessonTopics[q.lessonId]??'distance',context:q.context,family:structure(q.context),accepted,note:'这是一道沿用相同舍牌目标的旧题。先比较距离，再比较改善机会。',exampleGroups:[]};legacyCache.set(key,result);return result;
}
export function resolveQuestion(id:string,ref?:ExerciseRef){const q=ref?legacyQuestion(ref):question(id);if(q.id!==id)throw new Error('题目编号不匹配。');return q;}
export function migrateTraining(data:LearningData):TrainingState{
 if(data.training)return data.training;
 const candidates:TrainingSnapshot['attempts']=[];
 for(const a of [...data.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
  if(a.source==='competition'||a.ref.mode!=='discard'||a.answer.length!==1)continue;
  try{const q=legacyQuestion(a.ref);if(!q.context.hand.includes(a.answer[0]))continue;candidates.push({id:a.id,questionId:q.id,answer:a.answer[0],assisted:a.assisted,durationMs:a.durationMs,at:a.at,legacyRef:a.ref,review:a.review});}catch{/* Keep incompatible records in the untouched legacy archive. */}
 }
 const state=candidates.length?validateTrainingSnapshot({schemaVersion:4,version:TRAINING_VERSION,attempts:candidates}).state:emptyTraining();
 const old=new Map(data.mistakes.map(m=>[m.exerciseId,m])),reviews=new Map<string,ReviewItem>();
 for(const a of state.attempts){const m=old.get(a.questionId);if(m)reviews.set(a.questionId,{questionId:a.questionId,legacyRef:a.legacyRef,stage:m.stage,due:m.due});else if(!a.correct||a.assisted)reviews.set(a.questionId,{questionId:a.questionId,legacyRef:a.legacyRef,stage:0,due:localDate()});}
 state.reviews=[...reviews.values()];
 return state;
}
export function firstAttempts(attempts:TrainingAttempt[]){const seen=new Set<string>();return [...attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).filter(a=>{if(a.review||a.assisted||seen.has(a.family))return false;seen.add(a.family);return true;});}
export function recordTraining(state:TrainingState,input:Omit<TrainingAttempt,'correct'|'topic'|'family'|'review'>&{review?:boolean}):TrainingState{
 if(state.attempts.some(a=>a.id===input.id))return state;
 const q=resolveQuestion(input.questionId,input.legacyRef);
 if(!q.context.hand.includes(input.answer))throw new Error('答案必须是手牌中的一张。');
 const a:TrainingAttempt={...input,topic:q.topic,family:q.family,correct:q.accepted.includes(input.answer),review:!!input.review||state.attempts.some(a=>a.family===q.family)};
 let reviews=[...state.reviews];const old=reviews.find(m=>m.questionId===q.id);
 if(!a.correct||a.assisted){reviews=reviews.filter(m=>m.questionId!==q.id).concat({questionId:q.id,stage:0,due:localDate(),...(a.legacyRef?{legacyRef:a.legacyRef}:{})});}
 else if(old){reviews=reviews.map(m=>m===old?{...m,stage:Math.min(3,m.stage+1),due:dueDate([1,3,7,7][m.stage])}:m);}
 return {...state,attempts:[...state.attempts,a],reviews};
}
export function topicStats(state:TrainingState){const first=firstAttempts(state.attempts);return topics.map(t=>{const all=first.filter(a=>a.topic===t.id),recent=all.slice(-10),correct=recent.filter(a=>a.correct).length;return {topic:t.id,count:all.length,correct:all.filter(a=>a.correct).length,recent:recent.length,recentCorrect:correct,status:recent.length>=10&&correct>=8?'最近较稳定':recent.length>=5&&correct/recent.length<.5?'建议复习':'正在学'};});}
export function recommendedTopic(state:TrainingState):TopicId{const stats=topicStats(state);return stats.find(s=>s.status!=='最近较稳定')?.topic??topics.at(-1)!.id;}
export function createSession(state:TrainingState,chosen:TopicId=recommendedTopic(state),reviewOnly=false,now=new Date(),id:string=crypto.randomUUID()):TrainingSession{
 const seen=new Set(state.attempts.map(a=>a.family)),selected:string[]=[],count=new Map<string,number>();for(const a of state.attempts)count.set(a.questionId,(count.get(a.questionId)??0)+1);
 const pool=(tid:TopicId)=>trainingQuestions.filter(q=>q.topic===tid&&q.id!==trainingQuestions.find(q=>q.topic===tid)!.id).sort((a,b)=>Number(seen.has(a.family))-Number(seen.has(b.family))||(count.get(a.id)??0)-(count.get(b.id)??0)||a.id.localeCompare(b.id));
 const due=state.reviews.filter(m=>m.due<=localDate(now)&&(reviewOnly||topic(resolveQuestion(m.questionId,m.legacyRef).topic).stage<=topic(chosen).stage)).sort((a,b)=>a.due.localeCompare(b.due));
 const push=(qid:string)=>{if(selected.length<5&&!selected.includes(qid))selected.push(qid);};
 if(reviewOnly)due.forEach(m=>push(m.questionId));
 const current=pool(chosen);current.slice(0,reviewOnly?0:3).forEach(q=>push(q.id));
 due.slice(0,1).forEach(m=>push(m.questionId));
 // A fourth unseen structure provides transfer within the same topic; after 8/10,
 // introduce the next lesson. Never select a suit/mirror variant as a new sample.
 const pos=topics.findIndex(t=>t.id===chosen),stable=topicStats(state).find(s=>s.topic===chosen)?.status==='最近较稳定';
 pool(stable?topics[Math.min(pos+1,topics.length-1)].id:chosen).forEach(q=>push(q.id));
 current.forEach(q=>push(q.id));
 return {id,topic:chosen,questions:selected,index:0,selected:null,assisted:false,submitted:false,attemptIds:[]};
}
export function sessionQuestion(state:TrainingState,session:TrainingSession){const id=session.questions[session.index],old=state.reviews.find(m=>m.questionId===id)?.legacyRef??state.attempts.find(a=>a.questionId===id)?.legacyRef;return resolveQuestion(id,old);}
export function evidenceFacts(state:TrainingState){
 const first=firstAttempts(state.attempts),facts:{text:string;evidenceIds:string[]}[]=[];
 for(const s of topicStats(state).filter(s=>s.count>=5)){
  const a=first.filter(a=>a.topic===s.topic),recent=a.slice(-10);
  facts.push({text:`${topic(s.topic).title}：${a.length}道首次独立作答，${a.filter(x=>x.correct).length}道正确；最近${recent.length}道答对${recent.filter(x=>x.correct).length}道。`,evidenceIds:recent.slice(-3).map(x=>x.id)});
 }
 const wrong=first.filter(a=>!a.correct).slice(-3);for(const a of wrong){try{facts.push({text:feedback(resolveQuestion(a.questionId,a.legacyRef),a.answer),evidenceIds:[a.id]});}catch{}}
 return facts;
}
export type TrainingSnapshot={schemaVersion:4;version:typeof TRAINING_VERSION;attempts:{id:string;questionId:string;answer:TileId;assisted:boolean;durationMs:number;at:string;review:boolean;legacyRef?:ExerciseRef}[]};
export function trainingSnapshot(state:TrainingState):TrainingSnapshot{return {schemaVersion:4,version:TRAINING_VERSION,attempts:state.attempts.map(({id,questionId,answer,assisted,durationMs,at,review,legacyRef})=>({id,questionId,answer,assisted,durationMs,at,review,...(legacyRef?{legacyRef}:{})}))};}
export function validateTrainingSnapshot(raw:unknown){
 const s=raw as TrainingSnapshot;if(!s||s.schemaVersion!==4||s.version!==TRAINING_VERSION||!Array.isArray(s.attempts)||!s.attempts.length||s.attempts.length>50000)throw new Error('学习记录格式或版本无效。');
 let state=emptyTraining();const ids=new Set<string>();
 for(const a of s.attempts){if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(a.id)||ids.has(a.id)||typeof a.questionId!=='string'||!TILES.includes(a.answer)||typeof a.assisted!=='boolean'||typeof a.review!=='boolean'||!Number.isInteger(a.durationMs)||a.durationMs<0||a.durationMs>1800000||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))throw new Error('包含无效作答证据。');ids.add(a.id);}
 const families=new Set<string>();for(const a of [...s.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){const q=resolveQuestion(a.questionId,a.legacyRef);if(!q.context.hand.includes(a.answer))throw new Error('答案必须是手牌中的一张。');state.attempts.push({id:a.id,questionId:q.id,answer:a.answer,assisted:a.assisted,durationMs:a.durationMs,at:new Date(a.at).toISOString(),correct:q.accepted.includes(a.answer),topic:q.topic,family:q.family,review:a.review||families.has(q.family),...(a.legacyRef?{legacyRef:a.legacyRef}:{})});families.add(q.family);}
 return {state,snapshot:trainingSnapshot(state),facts:evidenceFacts(state),topic:recommendedTopic(state)};
}
export function compressedTraining(state:TrainingState){const first=firstAttempts(state.attempts),cases=[...first.filter(a=>!a.correct).slice(-12),...first.filter(a=>a.correct).slice(-8)];return {total:state.attempts.length,independent:first.length,topics:topicStats(state),facts:evidenceFacts(state),cases:cases.map(a=>({id:a.id,topic:a.topic,correct:a.correct,reason:feedback(resolveQuestion(a.questionId,a.legacyRef),a.answer)})),nextTopic:recommendedTopic(state)};}
export function validateBrief(raw:unknown):BriefReport {const p=raw as BriefReport;if(!p||p.version!==3||!topics.some(t=>t.id===p.topic)||typeof p.summary!=='string'||p.summary.length>600||typeof p.suggestion!=='string'||p.suggestion.length>300||!Array.isArray(p.facts)||p.facts.length>20||p.facts.some(f=>typeof f.text!=='string'||f.text.length>600||!Array.isArray(f.evidenceIds)||f.evidenceIds.some(id=>typeof id!=='string'))||!Array.isArray(p.uncertainties)||p.uncertainties.length>10||p.uncertainties.some(t=>typeof t!=='string'||t.length>600))throw new Error('学习总结格式无效。');return p;}
export function importTraining(raw:unknown):TrainingState{
 const s=raw as TrainingState;if(!s||s.version!==1||!Array.isArray(s.attempts)||!Array.isArray(s.reviews)||!Array.isArray(s.read)||!Array.isArray(s.reports))throw new Error('舍牌练习备份无效。');
 const clean=s.attempts.length?validateTrainingSnapshot({schemaVersion:4,version:TRAINING_VERSION,attempts:s.attempts}).state:emptyTraining();
 clean.reviews=s.reviews.map(m=>{resolveQuestion(m.questionId,m.legacyRef);if(!Number.isInteger(m.stage)||m.stage<0||m.stage>3||!/^\d{4}-\d{2}-\d{2}$/.test(m.due))throw new Error('复习日期无效。');return {...m};});
 clean.read=s.read.filter(id=>topics.some(t=>t.id===id));
 clean.reports=s.reports.slice(-30).map(p=>{if(typeof p.reportId!=='string'||!Number.isFinite(Date.parse(p.at)))throw new Error('总结备份无效。');return {...p,profile:validateBrief(p.profile)};});
 // A draft is restored only when every reference and selected physical position is valid.
 if(s.session){
  const x=s.session;
  if(typeof x.id!=='string'||!topics.some(t=>t.id===x.topic)||!Array.isArray(x.questions)||x.questions.length!==5||new Set(x.questions).size!==5||!Number.isInteger(x.index)||x.index<0||x.index>5||typeof x.assisted!=='boolean'||typeof x.submitted!=='boolean'||!Array.isArray(x.attemptIds))throw new Error('练习进度无效。');
  for(const id of x.questions)resolveQuestion(id,clean.reviews.find(m=>m.questionId===id)?.legacyRef??clean.attempts.find(a=>a.questionId===id)?.legacyRef);
  const completed=x.index===5?5:x.index+(x.submitted?1:0);
  if(x.attemptIds.length!==completed||x.attemptIds.some((id,i)=>clean.attempts.find(a=>a.id===id)?.questionId!==x.questions[i]))throw new Error('已答进度与记录不一致。');
  if(x.index===5){if(x.selected!==null||x.submitted)throw new Error('已完成练习的状态无效。');}
  else{
   const q=sessionQuestion(clean,x);
   if(x.selected!==null&&(!Number.isInteger(x.selected)||x.selected<0||x.selected>=q.context.hand.length))throw new Error('所选手牌位置无效。');
   if(x.submitted){const a=clean.attempts.find(a=>a.id===x.attemptIds.at(-1))!;if(x.selected===null||a.answer!==q.context.hand[x.selected]||a.assisted!==x.assisted)throw new Error('已答选择与记录不一致。');}
  }
  clean.session={...x};
 }
 return clean;
}
