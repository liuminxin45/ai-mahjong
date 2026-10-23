import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {chromium,webkit} from 'playwright';
import {analyze} from '../lib/engine/index.js';
import {publicContext} from '../lib/journey/index.js';
const base=process.env.MAHJONG_PREVIEW_URL??'http://127.0.0.1:5198',dir='artifacts/journey';await mkdir(dir,{recursive:true});
const manifest=JSON.parse(await readFile('assets/audio/manifest.json','utf8')),files=new Map(await Promise.all(manifest.files.map(async a=>[a.path,{body:await readFile(a.path),type:a.mime}])));
const fixture=createServer((req,res)=>{const a=files.get(new URL(req.url,'http://fixture').pathname.slice(1));if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':a.type,'Content-Length':a.body.length,'Access-Control-Allow-Origin':'*'}).end(a.body);});await new Promise(r=>fixture.listen(0,'127.0.0.1',r));fixture.unref();const origin='http://127.0.0.1:'+fixture.address().port;
export async function saved(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('learning');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
async function until(page,predicate){for(let n=0;n<300;n++){const d=await saved(page);if(predicate(d))return d;await page.waitForTimeout(25);}throw Error('checkpoint timeout');}
async function readOne(page){const b=page.locator('.mj-novel-turn');await b.click();await page.waitForTimeout(30);}
const logs=[];
for(const type of process.env.MAHJONG_BROWSER==='chromium'?[chromium]:[chromium,webkit]){
 let context,browser,profile;
 try{
  if(type===webkit){profile=await mkdtemp(join(tmpdir(),'neo-table-webkit-'));context=await type.launchPersistentContext(profile,{headless:process.env.MAHJONG_WEBKIT_HEADED!=='1',viewport:{width:1280,height:900},reducedMotion:'reduce'});}
  else{browser=await type.launch();context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});}
  if(type===webkit&&process.platform==='win32')await context.addInitScript(assets=>{
   class Media{src='';currentTime=0;volume=0;play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
   class AudioContext{currentTime=0;destination={};resume(){return Promise.resolve();}suspend(){return Promise.resolve();}decodeAudioData(b){return Promise.resolve({length:100,duration:assets.find(a=>a.bytes===b.byteLength)?.duration??0});}createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},connect(){return {};}};}createMediaElementSource(){return {connect(){return {connect(){}};}};}createBufferSource(){return {connect(){return {connect(){}};},start(){}};}}
   window.Audio=Media;window.AudioContext=AudioContext;
  },manifest.files);
  await context.addInitScript(origin=>{const native=window.fetch.bind(window);window.fetch=(input,init)=>{const u=input instanceof Request?input.url:String(input);return native(u.startsWith('https://raw.githubusercontent.com/liuminxin45/ai-mahjong/')?origin+'/'+new URL(u).pathname.split('/').slice(4).join('/'):input,init);};},origin);
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().startsWith(origin))requests.push(r.url());});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'推门',exact:true}).waitFor({timeout:120000});assert.equal(requests.length,11);assert.doesNotMatch(await page.locator('body').innerText(),/\d+\s?MB|正在加载声音|准备声音|加载资源/);
  await page.screenshot({path:dir+'/'+type.name()+'-cover.png'});await page.getByRole('button',{name:'推门',exact:true}).click();
  let moves=0,chapters=new Set(),retainedChecked=false;
  for(let tick=0;tick<400;tick++){
   const d=await saved(page),j=d?.tables?.journeys.at(-1);if(j?.phase==='done')break;
   if(await page.locator('.mj-novel-turn').count()){await readOne(page);continue;}
   if(await page.getByRole('button',{name:'接过手牌',exact:true}).count()){await page.getByRole('button',{name:'接过手牌',exact:true}).click();continue;}
   if(!j){await page.waitForTimeout(25);continue;}chapters.add(j.chapter);const r=j.rounds[j.chapter-1];
   if(r?.phase==='over'){const end=page.getByRole('button',{name:'收起这一局',exact:true});if(await end.count()&&await end.isVisible())await end.click();else await page.waitForTimeout(30);continue;}
   const buttons=page.locator('.mj-continuous-hand button');if(!await buttons.count()||!await buttons.first().isEnabled()){await page.waitForTimeout(40);continue;}
   const best=analyze(publicContext(r)).discards[0].tile,index=r.hands[0].findIndex(t=>t.tile===best),target=buttons.nth(index);await target.click();assert.equal(await page.locator('.mj-continuous-hand button[aria-pressed=true]').count(),1);
   const kept=await page.locator('.mj-physical-tile').nth((index+1)%14).elementHandle(),keptId=await kept.getAttribute('data-tile-id');
   await page.getByRole('button',{name:'打出'+(await target.getAttribute('aria-label')),exact:true}).click();moves++;
   await until(page,x=>{const current=x?.tables?.journeys.at(-1)?.rounds[j.chapter-1];return current?.commands.length>r.commands.length&&['player','over'].includes(current.phase);});
   if(j.chapter===1&&r.commands.length===0){await page.waitForTimeout(200);if(await page.locator('.mj-novel-turn').count())await readOne(page);await page.waitForTimeout(100);assert.ok(await kept.evaluate(e=>e.isConnected));assert.ok(await page.locator(`[data-tile-id="${keptId}"]`).count());retainedChecked=true;await page.screenshot({path:dir+'/'+type.name()+'-round.png'});}
   await page.waitForTimeout(80);
  }
  const final=await until(page,d=>d?.tables?.journeys.at(-1)?.phase==='done');assert.deepEqual([...chapters].sort(),[1,2,3,4,5]);assert.ok(retainedChecked);assert.equal(final.tables.journeys.at(-1).rounds.length,5);assert.ok(moves>=6);await page.screenshot({path:dir+'/'+type.name()+'-ending.png'});
  const downloadCount=requests.length;await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'回到这一页',exact:true}).waitFor({timeout:120000});assert.equal(requests.length,downloadCount,'unchanged media must be reused from cache');await page.getByRole('button',{name:'回到这一页',exact:true}).click();await page.locator('.mj-novel-end').waitFor();
  for(const theme of ['light','dark'])for(const width of [1920,1280,768,390,360,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'我的取舍',exact:true}).click();assert.equal(await page.locator('[role=dialog]').count(),1);await page.getByRole('button',{name:'回到那一手',exact:true}).click();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.mj-novel-shell,.mj-small-mirror')].some(e=>e.scrollWidth>e.clientWidth+1));assert.equal(overflow,false,type.name()+':'+theme+':'+width);await page.screenshot({path:dir+'/'+type.name()+'-'+theme+'-'+width+'.png'});await page.keyboard.press('Escape');}
  await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'从头读起',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'从头读起',exact:true}).click();
  for(let n=0;n<50;n++){if(await page.getByRole('button',{name:'接过手牌',exact:true}).count()){await page.getByRole('button',{name:'接过手牌',exact:true}).click();break;}await readOne(page);}
  await page.locator('.mj-continuous-hand button').first().waitFor();
  for(const theme of ['light','dark'])for(const width of [1920,1280,768,390,360,320]){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});const geometry=await page.locator('.mj-continuous-hand button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};}));assert.ok(geometry.every(r=>r.width>=43.9&&r.height>=44&&r.left>=0&&r.right<=width),JSON.stringify({theme,width,geometry}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+'/'+type.name()+'-table-'+theme+'-'+width+'.png'});}
  const start=await saved(page),fresh=start.tables.journeys.at(-1),r=fresh.rounds[0],buttons=page.locator('.mj-continuous-hand button');await buttons.first().click();
  const confirm=page.getByRole('button',{name:'打出'+(await buttons.first().getAttribute('aria-label')),exact:true});await confirm.evaluate(b=>{b.click();b.click();});
  await page.getByRole('button',{name:'更多',exact:true}).click();const pausedSeq=await page.locator('.mj-novel-table').getAttribute('data-seq');await page.waitForTimeout(600);assert.equal(await page.locator('.mj-novel-table').getAttribute('data-seq'),pausedSeq);const savedMove=await until(page,d=>d?.tables?.journeys.at(-1)?.rounds[0]?.commands.length===1);assert.equal(savedMove.tables.journeys.at(-1).rounds[0].commands.length,1);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'回到这一页',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'回到这一页',exact:true}).click();const restored=await until(page,d=>d?.tables?.journeys.at(-1)?.rounds[0]?.phase==='player');assert.equal(restored.tables.journeys.at(-1).rounds[0].cursor,4);assert.equal(restored.tables.journeys.at(-1).rounds[0].commands.length,1);assert.equal(requests.length,downloadCount);
  const archiveData=await saved(page),oldId='6285e979-b3f6-49d5-bdd3-7a9ea9981011';archiveData.story={version:1,journeys:[],attempts:[],reports:[{reportId:oldId,at:'2026-01-01T00:00:00Z',profile:{version:5,observation:{id:'old-observation',text:'旧版留在这里的一手。',kind:'cost',scope:'single',dimension:'效率',evidenceIds:['old-evidence']},reflection:{id:'again',text:'当时你留下了什么？'},evidenceIds:['old-evidence']}}]};
  await page.evaluate(data=>new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),archiveData);
  let deleted=0;await page.route('**/api/assistant/mahjong/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cookieConfirmed:true})}));await page.route('**/api/assistant/mahjong/profile/'+oldId,route=>{assert.equal(route.request().method(),'DELETE');deleted++;return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'回望已过期'})});});
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'回到这一页',exact:true}).waitFor({timeout:120000});await page.getByRole('button',{name:'回到这一页',exact:true}).click();await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'我的取舍',exact:true}).click();await page.getByRole('button',{name:'回到那一手',exact:true}).click();assert.ok(await page.getByText(/95% Wilson 参考区间/).count());await page.getByRole('button',{name:'过往',exact:true}).click();await page.getByText('旧版留在这里的一手。 当时你留下了什么？',{exact:true}).waitFor();await page.getByRole('button',{name:'删除这份回望',exact:true}).click();assert.equal(deleted,0);await page.getByRole('button',{name:'删除',exact:true}).click();await until(page,d=>d?.story?.reports.length===0);assert.equal(deleted,1);assert.equal((await saved(page)).tables.journeys.at(-1).rounds[0].commands.length,1);
  assert.deepEqual(errors,[]);logs.push({browser:type.name(),moves,chapters:[...chapters],retainedTileNode:true,refreshMidRound:true,menuPause:true,duplicateSubmit:true,legacyExpiredDelete:true,warmReloadAudioRequests:requests.length-downloadCount,errors,simulated:true,nativeAudio:type===chromium||process.platform!=='win32'});
 }finally{await context?.close();await browser?.close();if(profile){if(dirname(resolve(profile))!==resolve(tmpdir())||!basename(profile).startsWith('neo-table-webkit-'))throw Error('Unsafe profile path');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}
}
fixture.close();await writeFile(dir+'/results.json',JSON.stringify(logs,null,2)+'\n');console.log(JSON.stringify(logs));
