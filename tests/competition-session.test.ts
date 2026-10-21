import { expect, it, vi } from 'vitest';
import { CompetitionSession, pendingCompetition, restoreCompetitionChoice, sameCompetitionQuestion } from '../src/competition-session.js';
import { exercise, publicQuestion } from '../src/learning/index.js';
import type { CompetitionClient, CompetitionRun } from '../src/learning/competition.js';
const id='c845cc64-5068-42eb-b080-96f533493a54';
const run=(index=0,runId=id,status:CompetitionRun['status']='active'):CompetitionRun=>({runId,paperId:'paper',status,index,startedAt:new Date().toISOString(),serverNow:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
const client=()=>({resume:vi.fn(async()=>run()),start:vi.fn(async()=>run()),answer:vi.fn(async()=>run(1)),abandon:vi.fn(async()=>{}),papers:vi.fn(async()=>[]),board:vi.fn()} as unknown as CompetitionClient);
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}

it('restores once for simultaneous focus/online events and preserves the same selected question',async()=>{
 const c=client(),gate=deferred<CompetitionRun>();vi.mocked(c.resume).mockReturnValue(gate.promise);const session=new CompetitionSession(c),a=session.restore(id),b=session.restore(id);expect(c.resume).toHaveBeenCalledTimes(1);gate.resolve(run());expect(await a).toBe(await b);expect(sameCompetitionQuestion(session.current,run())).toBe(true);expect(sameCompetitionQuestion(session.current,run(1))).toBe(false);
});
it('a restore started before restart cannot overwrite the new run',async()=>{
 const c=client(),gate=deferred<CompetitionRun>(),fresh=run(0,'b846cc64-5068-42eb-b080-96f533493a54');vi.mocked(c.resume).mockReturnValue(gate.promise);vi.mocked(c.start).mockResolvedValue(fresh);const session=new CompetitionSession(c),old=session.restore(id);await session.start({paperId:'paper',requestId:id,abandonId:id});gate.resolve(run(9));expect(await old).toBeNull();expect(session.current).toBe(fresh);expect(c.abandon).toHaveBeenCalledWith(id);
});
it('a restore started before answering cannot put the UI back on the previous question',async()=>{
 const c=client(),session=new CompetitionSession(c);await session.start({paperId:'paper',requestId:id});const gate=deferred<CompetitionRun>();vi.mocked(c.resume).mockReturnValue(gate.promise);const restore=session.restore(id);await session.answer(0,['1p']);gate.resolve(run(0));expect(await restore).toBeNull();expect(session.current?.index).toBe(1);
});
it('lost answer response is recovered automatically when the server already accepted it',async()=>{
 const c=client(),session=new CompetitionSession(c);await session.start({paperId:'paper',requestId:id});vi.mocked(c.answer).mockRejectedValue(Error('network'));vi.mocked(c.resume).mockResolvedValue(run(1));expect((await session.answer(0,['1p']))?.index).toBe(1);expect(c.answer).toHaveBeenCalledTimes(1);
});
it('failed, unaccepted answers remain on the current question for a deliberate retry',async()=>{
 const c=client(),session=new CompetitionSession(c);await session.start({paperId:'paper',requestId:id});vi.mocked(c.answer).mockRejectedValue(Error('offline'));await expect(session.answer(0,['1p'])).rejects.toThrow('offline');expect(session.current?.index).toBe(0);vi.mocked(c.resume).mockRejectedValue(Error('offline'));await expect(session.answer(0,['1p'])).rejects.toThrow('offline');expect(session.busy).toBe(false);
});
it('start collision automatically resumes the existing challenge; restart retry reuses its request',async()=>{
 const c=client(),session=new CompetitionSession(c),pending={paperId:'paper',requestId:id,abandonId:id};vi.mocked(c.start).mockRejectedValueOnce(Object.assign(Error('active'),{runId:id}));expect((await session.start(pending))?.runId).toBe(id);await session.start(pending);expect(c.start).toHaveBeenNthCalledWith(2,'paper',id);expect(c.abandon).toHaveBeenCalledTimes(2);
});
it('mutations block duplicate submissions and only valid saved starts can be retried',async()=>{
 const c=client(),session=new CompetitionSession(c),gate=deferred<CompetitionRun>();await session.start({paperId:'paper',requestId:id});vi.mocked(c.answer).mockReturnValue(gate.promise);const answer=session.answer(0,['1p']);expect(await session.answer(0,['2p'])).toBeNull();expect(await session.restore(id)).toBeNull();expect(await session.start({paperId:'paper',requestId:id})).toBeNull();gate.resolve(run(1));await answer;expect(await session.answer(0,['1p'])).toBeNull();expect(pendingCompetition({paperId:'paper',requestId:id,abandonId:id})).toEqual({paperId:'paper',requestId:id,abandonId:id});for(const value of [null,{},[],{paperId:'paper',requestId:'bad'},{paperId:'paper',requestId:id,abandonId:'bad'}])expect(pendingCompetition(value)).toBeNull();expect(sameCompetitionQuestion(run(0,id,'complete'),run())).toBe(false);
});

it('refresh restores one physical duplicate, multiple waits and a negative judgment only on the matching question',()=>{
 const question=publicQuestion(exercise({mode:'discard',seed:10})),r={...run(),question},choice={runId:id,index:0,selected:['6s'],selectedIndex:11,judgmentSelected:false};
 const restored=restoreCompetitionChoice(r,choice);expect(restored?.selected).toEqual(['6s']);expect(restored?.selectedIndex).toBe(11);
 for(const bad of [null,{}, {...choice,index:1},{...choice,runId:'other'},{...choice,selected:['1m']},{...choice,selected:['1p','1p']},{...choice,selected:['6s','7s']}, {...choice,selected:Array(19).fill('1p')}])expect(restoreCompetitionChoice(r,bad)).toBeNull();
 expect(restoreCompetitionChoice({...r,status:'complete'},choice)).toBeNull();expect(restoreCompetitionChoice({...r,question:undefined},choice)).toBeNull();
 const waits={...r,question:publicQuestion(exercise({mode:'waits',seed:0}))};expect(restoreCompetitionChoice(waits,{...choice,selected:['1p','2s']})?.selected).toEqual(['1p','2s']);
 const judgment={...r,question:{...question,metadata:{...question.metadata!,response:'judgment' as const,judgmentTile:'1p' as const}}};expect(restoreCompetitionChoice(judgment,{...choice,selected:[],judgmentSelected:true})?.judgmentSelected).toBe(true);expect(restoreCompetitionChoice(judgment,choice)).toBeNull();
});

it('a later restore wins across run identities and failures release the session for retry',async()=>{
 const c=client(),session=new CompetitionSession(c),gate=deferred<CompetitionRun>();expect(await session.answer(0,[])).toBeNull();vi.mocked(c.resume).mockReturnValueOnce(gate.promise).mockResolvedValueOnce(run(3,'new'));const old=session.restore(id);expect((await session.restore('new'))?.index).toBe(3);gate.resolve(run(0));expect(await old).toBeNull();expect(session.current?.runId).toBe('new');
 vi.mocked(c.start).mockRejectedValueOnce(Error('offline'));await expect(session.start({paperId:'paper',requestId:id})).rejects.toThrow('offline');expect(session.busy).toBe(false);vi.mocked(c.abandon).mockRejectedValueOnce(Error('offline'));await expect(session.start({paperId:'paper',requestId:id,abandonId:id})).rejects.toThrow('offline');expect(session.busy).toBe(false);
});
