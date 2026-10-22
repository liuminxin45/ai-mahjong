import { afterEach, expect, it, vi } from 'vitest';
import { createCompetitionClient, createProfileClient,createTrainingClient } from '../src/client.js';
import {emptyTraining,recordTraining,trainingQuestions,trainingSnapshot} from '../src/training/index.js';
import { snapshot, exercise, answers } from '../src/learning/index.js';
const q=exercise({mode:'discard',seed:0}),s=snapshot([{id:'client-test-evidence',ref:q.ref,answer:[answers(q)[0]],assisted:false,review:false,durationMs:1000,at:new Date().toISOString(),correct:true,exerciseId:q.id}]);
afterEach(()=>vi.unstubAllGlobals());
it('舍牌小结上传完整v4证据并复用签名身份，读取与删除保持同一接口',async()=>{
 const q=trainingQuestions[1],state=recordTraining(emptyTraining(),{id:'client-training-evidence',questionId:q.id,answer:q.accepted[0],assisted:false,durationMs:1234,at:new Date().toISOString()}),snap=trainingSnapshot(state),calls:{url:string;method:string;body?:string}[]=[];
 vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push({url,method:init?.method??'GET',body:init?.body as string});return new Response(JSON.stringify(url.endsWith('/session')?{cookieConfirmed:true}:{reportId:'report',profile:{version:3},at:new Date().toISOString()}));}));
 const c=createTrainingClient('/test-training');await c.generate(snap);await c.read('report');await c.remove('report');expect(JSON.parse(calls[1].body!).snapshot).toEqual(snap);expect(calls.map(c=>c.method)).toEqual(['GET','POST','GET','DELETE']);expect(calls.filter(c=>c.url.endsWith('/session'))).toHaveLength(1);
});
it('画像和排行榜共用一次短身份握手，第二次请求确认Cookie后才发送业务',async()=>{
 const paths:string[]=[],locks:string[]=[];let session=0;
 vi.stubGlobal('navigator',{locks:{request:async(name:string,fn:()=>Promise<void>)=>{locks.push(name);await fn();}}});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{paths.push(url);return new Response(JSON.stringify(url.endsWith('/session')?{cookieConfirmed:++session>1}:url.endsWith('/competitions')?{papers:[]}:{reportId:'test',profile:{},at:new Date().toISOString()}),{headers:{'Content-Type':'application/json'}});}));
 const p=createProfileClient('/test-shared'),c=createCompetitionClient('/test-shared');await Promise.all([p.generate(s),c.papers()]);
 expect(paths.filter(p=>p.endsWith('/session'))).toHaveLength(2);expect(paths.slice(0,2)).toEqual(['/test-shared/session','/test-shared/session']);expect(locks).toEqual(['neo-metrics-identity']);
});
it('Cookie未保留时拒绝开赛并允许重试，不上传答卷',async()=>{
 let allow=false;const calls:string[]=[];vi.stubGlobal('navigator',{});vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/session')?{cookieConfirmed:allow}:{runId:'resumed'}));}));
 const c=createCompetitionClient('/test-blocked');await expect(c.start('paper','request')).rejects.toThrow(/Cookie/);expect(calls.every(p=>p.endsWith('/session'))).toBe(true);allow=true;await c.start('paper','request');expect(calls.at(-1)).toContain('/runs');
});
it('宿主身份初始化完成前不发起自己的握手，避免无锁浏览器中的同页竞争',async()=>{
 let finish!:()=>void;const gate=new Promise<void>(r=>finish=r),fetcher=vi.fn(async()=>new Response(JSON.stringify({cookieConfirmed:true,papers:[]})));vi.stubGlobal('fetch',fetcher);vi.stubGlobal('navigator',{});
 const c=createCompetitionClient('/test-host',()=>gate),pending=c.papers();await Promise.resolve();expect(fetcher).not.toHaveBeenCalled();finish();await pending;expect(fetcher).toHaveBeenCalledTimes(2);
});
