import {it,expect,vi} from 'vitest';
import {oldReports,forgetReport} from '../src/journey/archive.js';
import {emptyData,type LearningData} from '../src/learning/storage.js';
import {createTableClient} from '../src/client.js';
it('keeps old report text separate and deduplicates copies without reinterpreting answers',()=>{
 const data={...emptyData(),story:{reports:[{reportId:'same',at:'2026-01-01',profile:{observation:{text:'旧选择'},reflection:{text:'旧问题'}}}]},experience:{reports:[{reportId:'same',at:'2026-01-01',profile:{observation:{text:'重复副本'},reflection:{text:'重复问题'}}}]},decision:{reports:[{reportId:'decision',at:'2026-02-01',profile:{summary:'旧路线',suggestion:'原建议'}}]},training:{reports:[{reportId:'training',at:'2026-03-01',profile:{summary:'旧牌效',suggestion:'旧建议'}}]},profiles:[{reportId:'oldest',at:'invalid',profile:{summary:'最初记录'}}]} as unknown as LearningData;
 expect(oldReports(emptyData())).toEqual([]);expect(oldReports(data).map(r=>r.reportId)).toEqual(['training','decision','same','oldest']);expect(oldReports(data).find(r=>r.reportId==='same')!.text).toBe('旧选择 旧问题');
});
it('deletes cloud report copies across versions while keeping attempts, drafts, reading and other reports',()=>{
 const keep={reportId:'keep'},remove={reportId:'remove'},reports=[keep,remove],attempts=[{id:'answer'}],data={...emptyData(),drafts:{old:'stay'},profiles:reports,tables:{journeys:[{id:'journey'}],reports},story:{attempts,journeys:[{id:'past'}],reports},experience:{groups:[{id:'group'}],reports},decision:{attempts,reports},training:{attempts,reports}} as unknown as LearningData;
 const clean=forgetReport(data,'remove');for(const field of ['tables','story','experience','decision','training'] as const)expect(clean[field]!.reports).toEqual([keep]);expect(clean.profiles).toEqual([keep]);expect(clean.story!.attempts).toBe(attempts);expect(clean.tables!.journeys).toBe(data.tables!.journeys);expect(clean.drafts).toBe(data.drafts);expect(data.story!.reports).toHaveLength(2);expect(forgetReport(emptyData(),'absent')).toEqual(emptyData());
});
it('forgets an already expired remote report but keeps authorization and server failures visible',async()=>{
 let status=404;vi.stubGlobal('fetch',async(url:string)=>new Response(JSON.stringify(url.endsWith('/session')?{cookieConfirmed:true}:{error:'远端记录'}),{status:url.endsWith('/session')?200:status}));
 try{const c=createTableClient('/api/archive-test');await expect(c.remove('expired')).resolves.toBeUndefined();await expect(c.read('expired')).rejects.toMatchObject({status:404});status=403;await expect(c.remove('foreign')).rejects.toMatchObject({status:403});status=503;await expect(c.remove('unavailable')).rejects.toMatchObject({status:503});}finally{vi.unstubAllGlobals();}
});
