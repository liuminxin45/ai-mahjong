import { packSnapshot, type LearningProfile, type LearningSnapshot } from './learning/index.js';
import type { CompetitionClient } from './learning/competition.js';
import type { TrainingSnapshot,SavedBrief } from './training/core.js';
import type { DecisionSnapshot,SavedDecisionProfile } from './decision/core.js';
import type { ExperienceSnapshot, SavedInsight } from './experience/core.js';
import type { StorySnapshot, SavedStoryProfile } from './story/core.js';
import type {TableSnapshot,SavedTableProfile} from './journey/core.js';
import type {PracticeSnapshot,SavedPracticeProfile} from './practice/core.js';
export type PracticeClient={generate(snapshot:PracticeSnapshot):Promise<SavedPracticeProfile>;read(id:string):Promise<SavedPracticeProfile>;remove(id:string):Promise<void>};
export type TableClient={generate(snapshot:TableSnapshot):Promise<SavedTableProfile>;read(id:string):Promise<SavedTableProfile>;remove(id:string):Promise<void>};
export type StoryClient={generate(snapshot:StorySnapshot):Promise<SavedStoryProfile>;read(id:string):Promise<SavedStoryProfile>;remove(id:string):Promise<void>};
export type InsightClient={generate(snapshot:ExperienceSnapshot):Promise<SavedInsight>;read(id:string):Promise<SavedInsight>;remove(id:string):Promise<void>};
export type DecisionClient={generate(snapshot:DecisionSnapshot):Promise<SavedDecisionProfile>;read(id:string):Promise<SavedDecisionProfile>;remove(id:string):Promise<void>};
export type TrainingClient={generate(snapshot:TrainingSnapshot):Promise<SavedBrief>;read(id:string):Promise<SavedBrief>;remove(id:string):Promise<void>};
export type ProfileReport={reportId:string;profile:LearningProfile;at:string};
export type ProfileClient={generate(snapshot:LearningSnapshot):Promise<ProfileReport>;read(id:string):Promise<ProfileReport>;remove(id:string):Promise<void>};
const sessions=new Map<string,Promise<void>>();
export function ensureVisitor(base='/api/assistant/mahjong'):Promise<void>{
 const saved=sessions.get(base);if(saved)return saved;
 const handshake=async()=>{for(let i=0;i<2;i++){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);try{const r=await fetch(base+'/session',{credentials:'same-origin',signal:abort.signal});if(!r.ok)throw new Error('访客身份服务暂不可用，仍可继续本地练习。');const data=await r.json();if(data.cookieConfirmed)return;}finally{clearTimeout(timer);}}throw new Error('请允许浏览器保留本站访客Cookie后再使用在线功能。');};
 // Share the host metrics lock across tabs; no model request holds this lock.
 const pending=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('neo-metrics-identity',handshake):handshake()).then(()=>{}).catch(e=>{sessions.delete(base);throw e;});
 sessions.set(base,pending);return pending;
}
function profileRequest(base:string,beforeRequest?:()=>Promise<unknown>|void){
  const request=async(path:string,method:string,body?:unknown)=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);
    try{await beforeRequest?.();await ensureVisitor(base);const r=await fetch(base+path,{method,credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error||'画像服务暂时不可用。'),{status:r.status});return data;}
    catch(e){if(controller.signal.aborted)throw new Error('画像生成超时，练习记录仍保存在本地。');if(e instanceof SyntaxError)throw new Error('画像需要本站在线服务，普通练习仍可在本地继续。');throw e;}finally{clearTimeout(timeout);}
  };
  return request;
}
export function createPracticeClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):PracticeClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{try{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}catch(e){if((e as Error & {status?:number}).status!==404)throw e;}}};}
export function createProfileClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):ProfileClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:packSnapshot(s)}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};}
export function createTrainingClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):TrainingClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};}
export function createDecisionClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):DecisionClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};}
export function createInsightClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):InsightClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};}
export function createStoryClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):StoryClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};}
export function createTableClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):TableClient{const request=profileRequest(base,beforeRequest);return {generate:s=>request('/profile','POST',{snapshot:s}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{try{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}catch(e){if((e as Error & {status?:number}).status!==404)throw e;}}};}
export function createCompetitionClient(base='/api/assistant/mahjong',beforeRequest?:()=>Promise<unknown>|void):CompetitionClient{
 const request=async(path:string,method='GET',body?:unknown)=>{
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
  try{await beforeRequest?.();await ensureVisitor(base);const response=await fetch(base+path,{method,credentials:'same-origin',signal:abort.signal,headers:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok){if(data.code==='COOKIE_REQUIRED')sessions.delete(base);throw Object.assign(new Error(data.error||'比赛服务暂不可用。'),{runId:data.runId,status:response.status,code:data.code});}return data;}
  catch(e){if(abort.signal.aborted)throw new Error('连接比赛服务超时。若已开赛，服务端计时会继续；可恢复服务器进度。');if(e instanceof SyntaxError)throw new Error('比赛需要本站在线服务；可以继续本地专项练习。');throw e;}finally{clearTimeout(timer);}
 };
 return {papers:async()=>{const data=await request('/competitions');return [...data.papers,...(data.archived??[]).map((p:object)=>({...p,refs:[]}))];},start:(id,requestId)=>request(`/competitions/${encodeURIComponent(id)}/runs`,'POST',{requestId}),resume:id=>request(`/competition-runs/${encodeURIComponent(id)}`),answer:(id,index,answer)=>request(`/competition-runs/${encodeURIComponent(id)}/answers`,'POST',{index,answer}),abandon:async id=>{await request(`/competition-runs/${encodeURIComponent(id)}/abandon`,'POST',{});},board:(id,offset=0)=>request(`/competitions/${encodeURIComponent(id)}/leaderboard?offset=${offset}`)};
}
