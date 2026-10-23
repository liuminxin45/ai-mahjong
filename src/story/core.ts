import { tileName, type TileId } from '../engine/index.js';
import { decimal } from '../decision/solver.js';
import { decisionQuestion } from '../decision/questions.js';
import { compressedDecisions, decisionSnapshot, emptyDecision, independentDecisions, validateDecisionSnapshot, wilson, type DecisionSnapshot, type DecisionState } from '../decision/core.js';
import { challengeKinds, reflections, type ChallengeKind } from '../experience/definitions.js';
import { STORY_VERSION, story, storyNode, type DecisionNode } from './definition.js';
import { realizedOutcome, type Ending } from './model.js';

export type StoryAttempt = { id: string; journeyId: string; nodeId: string; answer: TileId; assisted: boolean; durationMs: number; at: string };
export type JourneyState = { id: string; seed: number; position: number; phase: 'round'|'chapter'|'ending'|'done'; selected: number|null; submitted: boolean; assisted: boolean; introSeen: number[]; presented: string[]; attemptIds: string[]; splitPair?: boolean; lost?: boolean; endingStep: number; startedAt: string };
export type StoryObservation = { id: string; text: string; kind: ChallengeKind; evidenceIds: string[]; scope: 'single'|'pattern'|'paired'; dimension: string };
export type StoryProfile = { version: 5; observation: StoryObservation; reflection: { id: string; text: string }; evidenceIds: string[] };
export type SavedStoryProfile = { reportId: string; at: string; profile: StoryProfile;sourceCount?:number };
export type StoryState = { version: 1; journeys: JourneyState[]; attempts: StoryAttempt[]; reports: SavedStoryProfile[] };
export type StorySnapshot = Omit<DecisionSnapshot,'schemaVersion'|'version'> & { schemaVersion: 6; version: typeof STORY_VERSION; journeys: Pick<JourneyState,'id'|'seed'|'startedAt'|'attemptIds'>[]; storyAttempts: StoryAttempt[] };
export const emptyStory = (): StoryState => ({ version:1,journeys:[],attempts:[],reports:[] });
export const dimensions=['效率计算','收益取舍','信息更新','对手回应','得失后的后续选择'];
const validId = (x:unknown): x is string => typeof x==='string' && /^[a-zA-Z0-9_:-]{8,150}$/.test(x);
export function nodeFor(j: Pick<JourneyState,'position'|'splitPair'|'lost'>): DecisionNode {
  const variant=j.position>=11&&j.position<=15?(j.splitPair?'changed':'kept'):j.position>=21?(j.lost?'loss':'clear'):'shared';
  const n=story.nodes.find(n=>n.position===j.position&&n.variant===variant);if(!n)throw Error('牌谱的下一页尚未准备好。');return n;
}
export function startJourney(state:StoryState,id:string=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0],now=new Date()):StoryState {
  const j:JourneyState={id,seed,position:1,phase:'round',selected:null,submitted:false,assisted:false,introSeen:[],presented:[],attemptIds:[],endingStep:0,startedAt:now.toISOString()};
  return {...state,journeys:[...state.journeys,j]};
}
export function patchJourney(state:StoryState,id:string,patch:Partial<JourneyState>):StoryState {return {...state,journeys:state.journeys.map(j=>j.id===id?{...j,...patch}:j)};}
export function nodeSeed(seed:number,id:string):number {let x=seed>>>0;for(const c of id)x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;return x;}
export function accepted(n:DecisionNode):TileId[]{return n.certificate?.accepted??n.question.certificate.accepted;}
export function recommended(n:DecisionNode):TileId{return n.certificate?.recommended??n.question.certificate.recommended;}
export function expected(n:DecisionNode,tile:TileId):{score:string;denominator:string}{if(n.certificate){const o=n.certificate.options.find(o=>o.tile===tile);if(!o)throw Error('这张牌不能打出。');return {score:o.score,denominator:n.certificate.denominator};}const o=n.question.certificate.options.find(o=>o.tile===tile);if(!o)throw Error('这张牌不能打出。');return {score:o.value.score,denominator:n.question.certificate.denominator};}
export function decisionLoss(n:DecisionNode,tile:TileId):number {const values=n.certificate?n.certificate.options.map(o=>BigInt(o.score)):n.question.certificate.options.map(o=>BigInt(o.value.score));const max=values.reduce((a,b)=>a>b?a:b),min=values.reduce((a,b)=>a<b?a:b);return max===min?0:Number((max-BigInt(expected(n,tile).score))*1000000n/(max-min))/1000000;}
export function branchPair(n:DecisionNode):TileId {const hand=n.question.context.hand;const t=n.challenge.proof.tiles.find(t=>hand.filter(x=>x===t).length===2)??hand.find(t=>hand.filter(x=>x===t).length===2);if(!t)throw Error('分支对子不存在。');return t;}
export function outcome(n:DecisionNode,j:Pick<JourneyState,'seed'>,answer:TileId){return n.certificate?realizedOutcome(n.certificate,answer,nodeSeed(j.seed,n.id)):undefined;}
export function submitStory(state:StoryState,journeyId:string,index:number,durationMs:number,now=new Date()):StoryState {
  const j=state.journeys.find(j=>j.id===journeyId);if(!j||j.phase!=='round'||j.submitted)return state;
  const n=nodeFor(j),answer=n.question.context.hand[index];if(!answer||!Number.isInteger(index))throw Error('请先选一张牌。');
  const id=j.id+':'+j.position;if(state.attempts.some(a=>a.id===id))return state;
  const attempt:StoryAttempt={id,journeyId:j.id,nodeId:n.id,answer,assisted:j.assisted,durationMs:Math.max(0,Math.min(1800000,Math.round(durationMs))),at:now.toISOString()};
  const patch:Partial<JourneyState>={selected:index,submitted:true,attemptIds:[...j.attemptIds,id]};
  if(j.position===10)patch.splitPair=answer===branchPair(n);
  if(j.position===20)patch.lost=outcome(n,j,answer)?.kind==='opponent';
  return patchJourney({...state,attempts:[...state.attempts,attempt]},j.id,patch);
}
export function nextStory(state:StoryState,id:string):StoryState {
  const j=state.journeys.find(j=>j.id===id);if(!j)return state;
  if(j.phase==='round'&&!j.submitted)return state;
  if(j.phase==='round'&&j.position===25)return patchJourney(state,id,{phase:'ending',endingStep:0});
  if(j.phase==='round'&&j.position%5===0)return patchJourney(state,id,{phase:'chapter'});
  if(j.phase==='ending')return patchJourney(state,id,{endingStep:Math.min(4,j.endingStep+1),...(j.endingStep>=3?{phase:'done' as const}:{})});
  if(j.phase==='done')return state;
  return patchJourney(state,id,{position:j.position+1,phase:'round',selected:null,submitted:false,assisted:false});
}
export function response(n:DecisionNode,answer:TileId):string {
  const best=recommended(n),a=expected(n,answer),b=expected(n,best);
  if(accepted(n).includes(answer))return `打${tileName(answer)}，保留了题设中最高的平均净分。`;
  const delta=String(BigInt(b.score)-BigInt(a.score));return `打${tileName(best)}，平均净分比打${tileName(answer)}高${decimal(delta,b.denominator)}。`;
}
export function endLabel(kind:Ending){return {you:'这一局，你先和了。',opponent:'这一局，他先和了。',draw:'牌墙见底，这一局没有人和。',unfinished:'这一段推演，到这里停下。'}[kind];}

export function independentStory(state:StoryState,decision=emptyDecision()):StoryAttempt[]{
  const seen=new Set(independentDecisions(decision.attempts).map(a=>a.family));
  return [...state.attempts].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)).filter(a=>{const n=storyNode(a.nodeId);if(a.assisted||n.position===25||seen.has(n.question.family))return false;seen.add(n.question.family);return true;});
}
export function storyObservations(state:StoryState,decision=emptyDecision()):StoryObservation[]{
  const result:StoryObservation[]=[],first=independentStory(state,decision),attemptsById=new Map(state.attempts.map(a=>[a.id,a])),times=new Map([...state.attempts,...decision.attempts].map(a=>[a.id,a.at]));
  for(const a of first){const n=storyNode(a.nodeId);result.push({id:'story:'+a.id,text:response(n,a.answer),kind:n.challenge.kind,evidenceIds:[a.id],scope:'single',dimension:dimensions[n.chapter-1]});}
  const cohorts=new Map<string,StoryAttempt[]>();
  for(const a of first){const n=storyNode(a.nodeId),key=[n.chapter,n.question.level,n.scenario?'opponent':'solo',n.scenario?.draws??n.question.model.horizon].join(':');const xs=cohorts.get(key)??[];xs.push(a);cohorts.set(key,xs);}
  for(const [key,xs] of cohorts){const wrong=xs.filter(a=>!accepted(storyNode(a.nodeId)).includes(a.answer));if(xs.length>=5&&wrong.length>=3){const n=storyNode(xs[0].nodeId);result.unshift({id:'pattern:'+key,text:`这${xs.length}手同档同条件题中，有${wrong.length}次放弃了更高的平均净分。`,kind:n.challenge.kind,evidenceIds:xs.map(a=>a.id),scope:'pattern',dimension:dimensions[n.chapter-1]});}}
  for(const j of state.journeys){const xs=j.attemptIds.map(id=>attemptsById.get(id)!);const a=xs.find(a=>storyNode(a.nodeId).position===1),b=xs.find(a=>storyNode(a.nodeId).position===25);if(a&&b&&!a.assisted&&!b.assisted)result.push({id:'pair:'+j.id,text:a.answer===b.answer?`同一副牌，你两次都打${tileName(a.answer)}；新的条件下，平均净分为${decimal(expected(storyNode(b.nodeId),b.answer).score,expected(storyNode(b.nodeId),b.answer).denominator)}。`:accepted(storyNode(a.nodeId)).includes(a.answer)&&accepted(storyNode(b.nodeId)).includes(b.answer)?'同一副牌，你随条件换了舍牌，两次都保留了最高的平均净分。':`最初打${tileName(a.answer)}，这次打${tileName(b.answer)}；两次选择的条件不同。`,kind:'adaptability',evidenceIds:[a.id,b.id],scope:'paired',dimension:'信息更新'});}
  for(const a of independentDecisions(decision.attempts)){const q=decisionQuestion(a.questionId),n={question:q} as DecisionNode,best=q.certificate.recommended,chosen=q.certificate.options.find(o=>o.tile===a.answer)!,top=q.certificate.options.find(o=>o.tile===best)!;const kind:ChallengeKind=['flush','pungs','seven','tradeoff','cap','root'].includes(q.skill)?'temptation':['visible','dead','count'].includes(q.skill)?'gap':['overlap','open'].includes(q.skill)?'entanglement':'cost';result.push({id:'legacy:'+a.id,text:q.certificate.accepted.includes(a.answer)?`这一手，打${tileName(a.answer)}保留了最高的题设平均分。`:`打${tileName(best)}，比打${tileName(a.answer)}平均高${decimal(String(BigInt(top.value.score)-BigInt(chosen.value.score)),q.certificate.denominator)}分。`,kind,evidenceIds:[a.id],scope:'single',dimension:'既有舍牌练习'});void n;}
  return result.sort((a,b)=>(a.scope==='pattern'?-2:a.scope==='paired'?-1:0)-(b.scope==='pattern'?-2:b.scope==='paired'?-1:0)||Date.parse(times.get(b.evidenceIds[0])!)-Date.parse(times.get(a.evidenceIds[0])!)).slice(0,64);
}
export function allowedStoryReflections(kind:ChallengeKind){if(!challengeKinds.includes(kind))throw Error('未知的考验。');return [{id:kind,text:reflections[kind]},{id:'again',text:'若再遇到这一手，你还会这样选吗？'},{id:'possibility',text:'还有哪一种可能，值得你再看一眼？'}];}
export function composeStoryProfile(observation:StoryObservation,reflectionId:string):StoryProfile{const reflection=allowedStoryReflections(observation.kind).find(r=>r.id===reflectionId);if(!reflection)throw Error('自问不属于这条证据。');return {version:5,observation,reflection,evidenceIds:[...observation.evidenceIds]};}
export function validateStoryProfile(raw:unknown):StoryProfile {const p=raw as StoryProfile;if(!p||p.version!==5||!p.observation||!validId(p.observation.id)||!['single','paired','pattern'].includes(p.observation.scope)||typeof p.observation.text!=='string'||p.observation.text.length>65||!Array.isArray(p.observation.evidenceIds)||!p.observation.evidenceIds.length||p.observation.evidenceIds.some(id=>!validId(id))||typeof p.observation.dimension!=='string'||!p.reflection||!allowedStoryReflections(p.observation.kind).some(r=>r.id===p.reflection.id&&r.text===p.reflection.text)||JSON.stringify(p.evidenceIds)!==JSON.stringify(p.observation.evidenceIds))throw Error('这份回望无法识别。');return p;}
export function storySnapshot(decision:DecisionState,state:StoryState,legacy?:DecisionSnapshot['legacy']):StorySnapshot{return {...decisionSnapshot(decision,legacy),schemaVersion:6,version:STORY_VERSION,journeys:state.journeys.map(({id,seed,startedAt,attemptIds})=>({id,seed,startedAt,attemptIds})),storyAttempts:state.attempts};}
export function validateStorySnapshot(raw:unknown){
  const s=raw as StorySnapshot;if(!s||s.schemaVersion!==6||s.version!==STORY_VERSION||!Array.isArray(s.journeys)||s.journeys.length>10000||!Array.isArray(s.storyAttempts)||s.storyAttempts.length>50000)throw Error('牌谱记录的版本或格式无效。');
  const checked=validateDecisionSnapshot({...s,schemaVersion:5,version:'discard-value-1'}),state=emptyStory(),ids=new Set<string>(),used=new Set<string>(),answersById=new Map(s.storyAttempts.map(a=>[a?.id,a])),claimed=new Set<string>();
  for(const a of s.storyAttempts){if(!a||!validId(a.id)||ids.has(a.id)||!validId(a.journeyId)||!validId(a.nodeId)||typeof a.assisted!=='boolean'||!Number.isInteger(a.durationMs)||a.durationMs<0||a.durationMs>1800000||!Number.isFinite(Date.parse(a.at)))throw Error('包含无效舍牌证据。');storyNode(a.nodeId);ids.add(a.id);}
  for(const receipt of s.journeys){if(!receipt||!validId(receipt.id)||used.has(receipt.id)||!Number.isInteger(receipt.seed)||receipt.seed<0||receipt.seed>0xffffffff||!Number.isFinite(Date.parse(receipt.startedAt))||!Array.isArray(receipt.attemptIds)||receipt.attemptIds.length>25)throw Error('旅程记录无效。');used.add(receipt.id);
    let replay=startJourney(emptyStory(),receipt.id,receipt.seed,new Date(receipt.startedAt));
    for(let i=0;i<receipt.attemptIds.length;i++){const a=answersById.get(receipt.attemptIds[i]),j=replay.journeys[0],n=nodeFor(j);if(!a||a.journeyId!==j.id||a.nodeId!==n.id||a.id!==j.id+':'+(i+1)||claimed.has(a.id))throw Error('舍牌与剧情路径不一致。');const index=n.question.context.hand.indexOf(a.answer);if(index<0)throw Error('舍牌不在手中。');claimed.add(a.id);replay=patchJourney(replay,j.id,{assisted:a.assisted});replay=submitStory(replay,j.id,index,a.durationMs,new Date(a.at));if(i<receipt.attemptIds.length-1){replay=nextStory(replay,j.id);if(replay.journeys[0].phase==='chapter')replay=nextStory(replay,j.id);}}
    state.journeys.push(replay.journeys[0]);state.attempts.push(...replay.attempts);
  }
  if(state.attempts.length!==s.storyAttempts.length)throw Error('存在不属于旅程的答题。');
  const facts=storyObservations(state,checked.state),independent=independentStory(state,checked.state);
  const groups=new Map<string,StoryAttempt[]>();for(const a of independent){const n=storyNode(a.nodeId),key=[n.chapter,n.question.level,n.scenario?'opponent':'solo',n.scenario?.draws??n.question.model.horizon].join(':');const xs=groups.get(key)??[];xs.push(a);groups.set(key,xs);}
  const cohorts=[...groups.values()].map(xs=>{const n=storyNode(xs[0].nodeId),right=xs.filter(a=>accepted(storyNode(a.nodeId)).includes(a.answer)).length,times=xs.filter(a=>accepted(storyNode(a.nodeId)).includes(a.answer)&&a.durationMs>=300&&a.durationMs<1800000).map(a=>a.durationMs).sort((a,b)=>a-b),middle=Math.floor(times.length/2),medianTime=times.length<5?null:times.length%2?times[middle]:(times[middle-1]+times[middle])/2;return {dimension:dimensions[n.chapter-1],level:n.question.level,model:n.scenario?'opponent':'solo',window:n.scenario?.draws??n.question.model.horizon,count:xs.length,correct:right,medianTime,validCorrectTimes:times.length,interval:wilson(right,xs.length),status:xs.length<5?'证据不足':xs.length<20?'初步观察':'已有较多样本'};});
  return {...checked,story:state,facts,snapshot:storySnapshot(checked.state,state,checked.snapshot.legacy),compressed:{...compressedDecisions(checked.state),legacyEfficiency:checked.legacy??null,story:{total:state.attempts.length,independent:independent.length,assisted:state.attempts.filter(a=>a.assisted).length,repeat:state.attempts.length-independent.length-state.attempts.filter(a=>a.assisted).length,cohorts,paired:state.journeys.filter(j=>j.attemptIds.length===25).length},limits:['这些记录不证明动机、人格、情绪状态或完整实战能力。','不同难度、计算窗口、提示、复习和配对观察分开解释。']}};
}
export function restoreStory(raw:unknown):StoryState{
  if(raw===undefined||raw===null)return emptyStory();const s=raw as StoryState;
  if(s.version!==1||!Array.isArray(s.journeys)||!Array.isArray(s.attempts)||!Array.isArray(s.reports))throw Error('旧牌谱记录无法续接。');
  const checked=validateStorySnapshot(storySnapshot(emptyDecision(),s));
  for(const j of s.journeys){const replay=checked.story.journeys.find(x=>x.id===j.id)!,count=j.attemptIds.length;
    if(!['round','chapter','ending','done'].includes(j.phase)||typeof j.submitted!=='boolean'||typeof j.assisted!=='boolean'||!Number.isInteger(j.position)||j.position<1||j.position>25||!Number.isInteger(j.endingStep)||j.endingStep<0||j.endingStep>4||j.splitPair!==replay.splitPair||j.lost!==replay.lost||!Array.isArray(j.introSeen)||new Set(j.introSeen).size!==j.introSeen.length||j.introSeen.some(x=>!Number.isInteger(x)||x<1||x>Math.ceil(j.position/5))||!Array.isArray(j.presented)||new Set(j.presented).size!==j.presented.length||j.presented.some(id=>storyNode(id).position>j.position))throw Error('旧牌谱进度无效。');
    if(j.phase==='round'&&(j.position!==(j.submitted?count:count+1)||j.endingStep!==0)||j.phase==='chapter'&&(!j.submitted||count%5!==0||count===0||j.position!==count||count===25||j.endingStep!==0)||['ending','done'].includes(j.phase)&&(count!==25||j.position!==25||!j.submitted)||j.phase==='ending'&&j.endingStep===4||j.phase==='done'&&j.endingStep!==4)throw Error('旧牌谱阶段不一致。');
    const n=nodeFor(j);if(j.selected!==null&&(!Number.isInteger(j.selected)||j.selected<0||j.selected>=n.question.context.hand.length))throw Error('旧牌谱选牌无效。');
    if(j.submitted){const a=s.attempts.find(a=>a.id===j.attemptIds.at(-1))!;if(j.selected===null||n.question.context.hand[j.selected]!==a.answer||a.assisted!==j.assisted)throw Error('已答牌与记录不一致。');}
  }
  for(const p of s.reports){if(!p||!validId(p.reportId)||!Number.isFinite(Date.parse(p.at))||p.sourceCount!==undefined&&(!Number.isInteger(p.sourceCount)||p.sourceCount<0))throw Error('回望存档无效。');validateStoryProfile(p.profile);}
  return s;
}
