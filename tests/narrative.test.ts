import {describe,expect,it} from 'vitest';
import {emptyDecision} from '../src/decision/core.js';
import {accepted,assessedStory,branchPair,emptyStory,independentStory,nextStory,nodeFor,outcome,patchJourney,restoreStory,startJourney,startNarrativeJourney,storyObservations,storySnapshot,submitStory,validateStorySnapshot,type StoryState} from '../src/story/core.js';
import {siblingStory,story,storyNode} from '../src/story/definition.js';
import {NARRATIVE_VERSION,chapterClosings,endingPages,narrativeResponse,narrativeScene,openingLines,premise,readingDuration} from '../src/story/narrative.js';

const now=new Date('2026-10-23T12:00:00Z');
function play(count=25,split=false,loss=false,ending='draw',initial=emptyStory(),id='sibling-test-journey'):StoryState{
  const gate=siblingStory.nodes.find(n=>n.position===20)!,final=siblingStory.nodes.find(n=>n.position===25&&n.variant===(loss?'loss':'clear'))!;
  let seed=0;for(;seed<10000;seed++)if(gate.certificate!.options.some(o=>(outcome(gate,{seed},o.tile)!.kind==='opponent')===loss)&&final.certificate!.options.some(o=>outcome(final,{seed},o.tile)!.kind===ending))break;
  let state=startNarrativeJourney(initial,id,seed,now);
  for(let p=1;p<=count;p++){const j=state.journeys.at(-1)!,n=nodeFor(j),hand=n.question.context.hand;let tile=accepted(n)[0];if(p===10)tile=split?branchPair(n):hand.find(t=>t!==branchPair(n))!;if(p===20)tile=n.certificate!.options.find(o=>(outcome(n,j,o.tile)!.kind==='opponent')===loss)!.tile;if(p===25)tile=n.certificate!.options.find(o=>outcome(n,j,o.tile)!.kind===ending)!.tile;state=submitStory(state,j.id,hand.indexOf(tile),2400,new Date(+now+p*1000));if(p<count){state=nextStory(state,j.id);if(state.journeys.at(-1)!.phase==='chapter')state=nextStory(state,j.id);}}
  return state;
}

describe('authored sibling record',()=>{
  it('has complete authored scenes for all 35 legal nodes, without grading in dialogue',()=>{
    expect(siblingStory.nodes).toHaveLength(35);const all=[];
    for(const n of siblingStory.nodes){const scene=narrativeScene(n,{splitPair:n.variant==='changed',lost:n.variant==='loss'});expect(scene.before.length).toBeGreaterThanOrEqual(3);expect(scene.after.length).toBeGreaterThanOrEqual(2);expect(scene.next).not.toMatch(/下一步|下一手/);all.push(...scene.before,...scene.after);for(const t of new Set(n.question.context.hand)){const lines=narrativeResponse(n,{seed:17},t);expect(lines[0]).toMatch(/^我把/);expect(lines.join('')).not.toMatch(/最优|答对|答错|推荐|净分/);}}
    expect(all.join('')).not.toMatch(/向听|LLM|正确率|人格|当年的注记|看清这一手/);
    expect(openingLines.join('')).toContain('餐边柜');expect(openingLines.join('')).toContain('纸箱');expect(openingLines.join('')).toContain('赢了算我的');expect(premise.loss).toContain('因病');
    expect(()=>narrativeScene({...siblingStory.nodes[0],position:36},{})).toThrow();
  });
  it('allows the first two chapters to establish a living, competitive sister before the revelation',()=>{
    const early=siblingStory.nodes.filter(n=>n.position<=10).flatMap(n=>{const s=narrativeScene(n,{});return [...s.before,...s.after];}).concat(openingLines,chapterClosings[1].lines,chapterClosings[2].lines).join('');
    expect(early).not.toMatch(/墓园|病|去世|遗言|来不及|最后一晚/);expect(early).toContain('橘子');expect(early).toContain('反正这一手是你打的');expect(early).toContain('赢');expect(early).toContain('问');
    expect(chapterClosings[3].lines.join('')).toContain('墓园');expect(chapterClosings[4].lines.join('')).toContain('给哥留着');expect(endingPages.flatMap(p=>p.lines).join('')).toContain('放进自己的包');
  });
  it('binds meaningful reactions to physical choices, not to a moral score',()=>{
    const n4=siblingStory.nodes.find(n=>n.position===4)!,pair=n4.question.context.hand.find(t=>n4.question.context.hand.filter(x=>x===t).length===2)!,other=n4.question.context.hand.find(t=>n4.question.context.hand.filter(x=>x===t).length!==2)!;
    expect(narrativeResponse(n4,{seed:1},pair).join('')).toContain('想把那张拦回来');expect(narrativeResponse(n4,{seed:1},other).join('')).toContain('松开');
    const n10=siblingStory.nodes.find(n=>n.position===10)!,t=branchPair(n10);expect(narrativeResponse(n10,{seed:1},t).join('')).toContain('分开的那对');expect(narrativeResponse(n10,{seed:1},n10.question.context.hand.find(x=>x!==t)!).join('')).toContain('并在一起');
    const n3=siblingStory.nodes.find(n=>n.position===3)!;expect(n3.question.context.visible?.['7s']).toBe(4);expect(narrativeResponse(n3,{seed:1},accepted(n3)[0]).join('')).toContain('四张七条');
    const first=siblingStory.nodes.find(n=>n.position===1)!;for(const last of siblingStory.nodes.filter(n=>n.position===25)){expect(last.question.context.hand).toEqual(first.question.context.hand);expect(accepted(last).some(t=>accepted(first).includes(t))).toBe(false);expect(narrativeScene(last,{}).before.join('')).toContain('已经打出的牌');}
  });
  it('keeps the present distinct from memory and does not predict a later player choice',()=>{
    for(const n of siblingStory.nodes.filter(n=>n.position>=21))for(let seed=0;seed<20;seed++)for(const t of new Set(n.question.context.hand)){const text=narrativeResponse(n,{seed},t).join('');expect(text).not.toMatch(/妹妹赶|她先笑|她在纸上写.*你/);const result=outcome(n,{seed},t)!;expect(text).toContain({you:'我这一席先和',opponent:'对面那一席',draw:'没有人和',unfinished:'只记到这里'}[result.kind]);}
    const n=siblingStory.nodes.find(n=>n.position===21)!;expect(narrativeScene(n,{lost:true}).before.join('')).toContain('我没有往回翻');expect(narrativeScene(n,{lost:false}).before.join('')).toContain('我把它拢好');
    expect(readingDuration('短句')).toBe(2100);expect(readingDuration('字'.repeat(200))).toBe(5800);
  });
});

describe('versioned narrative receipts and fair assessment',()=>{
  it('plays all paths and endings while keeping the old published question identities intact',()=>{
    for(const split of [false,true])for(const loss of [false,true])for(const ending of ['you','opponent','draw']){const state=play(25,split,loss,ending),j=state.journeys[0];expect(j.edition).toBe(NARRATIVE_VERSION);expect(j.splitPair).toBe(split);expect(j.lost).toBe(loss);expect(state.attempts).toHaveLength(25);const snap=storySnapshot(emptyDecision(),state);expect(snap.schemaVersion).toBe(7);expect(validateStorySnapshot(snap).story.attempts).toHaveLength(25);expect(state.attempts.every(a=>a.nodeId.startsWith(NARRATIVE_VERSION))).toBe(true);}
    expect(story.nodes).toHaveLength(35);expect(story.nodes.every(n=>n.id.startsWith('unfinished-record-1:'))).toBe(true);
  });
  it('excludes hidden opponent assumptions from capability statistics without discarding the choices',()=>{
    const state=play(),checked=validateStorySnapshot(storySnapshot(emptyDecision(),state));expect(independentStory(state).length).toBeGreaterThan(assessedStory(state).length);expect(assessedStory(state).every(a=>!storyNode(a.nodeId).scenario)).toBe(true);expect(checked.compressed.story.assessed).toBe(assessedStory(state).length);expect(checked.compressed.story.conditionalOnly).toBeGreaterThan(0);expect(checked.compressed.story.total).toBe(25);expect(checked.compressed.story.cohorts.every(c=>c.model==='solo')).toBe(true);
    const pair=storyObservations(state).find(f=>f.scope==='paired')!;expect(pair.text).not.toMatch(/最优|最高|平均/);expect(pair.evidenceIds).toHaveLength(2);
  });
  it('retains old journeys and uses the same family identity to avoid counting a replay as new',()=>{
    let old=startJourney(emptyStory(),'older-record-journey',17,now);old=submitStory(old,old.journeys[0].id,0,1000,now);
    expect(storySnapshot(emptyDecision(),old).schemaVersion).toBe(6);expect(validateStorySnapshot(storySnapshot(emptyDecision(),old)).story.attempts).toHaveLength(1);
    const mixed=play(5,false,false,'draw',old),snapshot=storySnapshot(emptyDecision(),mixed),checked=validateStorySnapshot(snapshot);expect(checked.story.journeys).toHaveLength(2);expect(checked.story.attempts).toHaveLength(6);expect(independentStory(mixed)).toHaveLength(5);
    const forged=structuredClone(snapshot);forged.schemaVersion=6;forged.version='unfinished-record-1';expect(()=>validateStorySnapshot(forged)).toThrow();
    for(const receipt of [{...snapshot,version:'unknown'},{...snapshot,journeys:snapshot.journeys.map(j=>({...j,edition:'unknown'}))},{...snapshot,journeys:snapshot.journeys.map(j=>({...j,edition:undefined}))}])expect(()=>validateStorySnapshot(receipt)).toThrow();
  });
  it('restores local reading precisely but never sends narrative text, voice or reading pace as evidence',()=>{
    let state=play(1);const id=state.journeys[0].id;state=patchJourney(state,id,{opened:true,reading:{scene:'opening',revealed:7},readScenes:['opening'],readingLog:[{id:'opening:0',text:openingLines[0]}]});expect(restoreStory(state)).toEqual(state);
    const upload=JSON.stringify(storySnapshot(emptyDecision(),state));expect(upload).not.toContain(openingLines[0]);expect(upload).not.toContain('readingLog');expect(upload).not.toContain('opened');
    for(const patch of [{opened:'yes'},{readScenes:null},{readScenes:['x'.repeat(201)]},{readingLog:null},{readingLog:[{id:'bad',text:'x'.repeat(501)}]},{reading:{scene:'opening',revealed:-1}},{reading:{scene:'opening',revealed:1.5}},{reading:{scene:3,revealed:1}},{reading:{scene:'opening',revealed:101}}])expect(()=>restoreStory({...state,journeys:[{...state.journeys[0],...patch}]})).toThrow();
  });
});
