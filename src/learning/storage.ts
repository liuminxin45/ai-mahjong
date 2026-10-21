import { exercise, grade, MODES, packSnapshot, validateProfile, validateSnapshot, type Attempt, type ExerciseRef, type LearningProfile } from './index.js';
import { TILES, type TileId } from '../engine/index.js';
export type Mistake={ref:ExerciseRef;exerciseId:string;stage:number;due:string;favorite:boolean};
export type SavedProfile={reportId:string;profile:LearningProfile;at:string;snapshot?:unknown};
export type LearningData={version:1;attempts:Attempt[];mistakes:Mistake[];completed:string[];profiles:SavedProfile[];drafts:Record<string,unknown>};
export const emptyData=():LearningData=>({version:1,attempts:[],mistakes:[],completed:[],profiles:[],drafts:{}});
export function localDate(date=new Date()):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function dueDate(days:number,now=new Date()):string{const d=new Date(now);d.setDate(d.getDate()+days);return localDate(d);}
export function recordAttempt(data:LearningData,a:Attempt):LearningData{
  const q=exercise(a.ref);const family=q.metadata?.familyId??q.id;const {difficulty:ignoredLevel,familyId:ignoredFamily,...plain}=a;const checked={...plain,exerciseId:q.id,correct:grade(q,a.answer),review:a.review||data.attempts.some(x=>(x.familyId??x.exerciseId)===family),...(q.metadata?{difficulty:q.metadata.difficulty,familyId:family}:{})};
  let mistakes=[...data.mistakes];const old=mistakes.find(m=>m.exerciseId===q.id);
  if(!checked.correct||checked.assisted){const m={ref:q.ref,exerciseId:q.id,stage:0,due:localDate(),favorite:old?.favorite??false};mistakes=mistakes.filter(x=>x.exerciseId!==q.id).concat(m);}
  else if(old){const stage=Math.min(old.stage+1,3);mistakes=mistakes.map(m=>m===old?{...m,stage,due:dueDate([1,3,7,7][old.stage])}:m);}
  return {...data,attempts:[...data.attempts,checked],mistakes};
}
export function importData(raw:unknown):LearningData{
  const d=raw as LearningData;
  if(!d||d.version!==1||!Array.isArray(d.attempts)||d.attempts.length>50000||!Array.isArray(d.mistakes)||!Array.isArray(d.completed)||!Array.isArray(d.profiles)||!d.drafts||typeof d.drafts!=='object')throw new Error('不是有效的麻将研习备份。');
  const ids=new Set<string>();let clean=emptyData();
  for(const a of d.attempts){
    if(!a||typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(a.id)||ids.has(a.id)||!MODES.includes(a.ref?.mode)||!Array.isArray(a.answer)||a.answer.length>18||new Set(a.answer).size!==a.answer.length||a.answer.some((t:TileId)=>!TILES.includes(t))||typeof a.assisted!=='boolean'||typeof a.review!=='boolean'||!Number.isInteger(a.durationMs)||a.durationMs<0||a.durationMs>1800000||!Number.isFinite(Date.parse(a.at)))throw new Error('备份包含无效答题记录。');
    ids.add(a.id);clean=recordAttempt(clean,a);
  }
  clean.completed=[...new Set(d.completed.filter(x=>typeof x==='string'&&/^lesson-(0[1-9]|1[0-9]|2[0-4])$/.test(x)))];
  // Restore scheduling/favourites only for real reconstructed questions; never trust imported correctness.
  clean.mistakes=d.mistakes.map(m=>{
    const q=exercise(m.ref);if(m.exerciseId!==q.id||!Number.isInteger(m.stage)||m.stage<0||m.stage>3||!/^\d{4}-\d{2}-\d{2}$/.test(m.due)||typeof m.favorite!=='boolean')throw new Error('错题复习信息无效。');
    return {...m};
  });
  // Imported reports are intentionally kept as plain user data, never injected into HTML or uploaded as evidence.
  clean.profiles=d.profiles.slice(-30).map(p=>{if(!p||typeof p.reportId!=='string'||!Number.isFinite(Date.parse(p.at))||!p.snapshot)throw new Error('画像备份不完整。');const s=validateSnapshot(p.snapshot).snapshot;return {...p,profile:validateProfile(p.profile,s),snapshot:packSnapshot(s)};});
  return clean;
}
export class LearningRepository{
  private db:IDBDatabase|null=null;
  temporary=false;
  async open():Promise<LearningData>{
    try{
      if(typeof indexedDB==='undefined')throw new Error('unavailable');
      this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('blocked'));});
      const saved=await new Promise<LearningData|undefined>((resolve,reject)=>{const tx=this.db!.transaction('state');const r=tx.objectStore('state').get('learning');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      return saved?.version===1?saved:emptyData();
    }catch{this.temporary=true;return emptyData();}
  }
  async save(data:LearningData):Promise<void>{
    if(!this.db){this.temporary=true;return;}
    try{await new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
    catch{this.temporary=true;throw new Error('本地保存失败，请导出备份；当前练习仍可继续。');}
  }
  close(){this.db?.close();this.db=null;}
}
