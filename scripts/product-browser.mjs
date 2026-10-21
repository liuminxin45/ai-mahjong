import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {competitionPapers,exercise,publicQuestion,grade} from '../lib/learning/index.js';
import {sorted} from '../lib/engine/index.js';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5188',base=process.env.MAHJONG_ROUTE_BASE||'',dir=process.env.MAHJONG_PRODUCT_ARTIFACTS||'artifacts/product-browser';
await mkdir(dir,{recursive:true});const results=[];
const saved=async page=>page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);});const data=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('learning');r.onsuccess=()=>resolve(r.result);});db.close();return data;});
const untilSaved=async(page,test)=>{for(let i=0;i<100;i++){const data=await saved(page);if(test(data))return;await page.waitForTimeout(20);}throw Error('Draft was not persisted');};
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 for(const theme of ['light','dark'])for(const width of (process.env.MAHJONG_PRODUCT_WIDTHS||'1280,390,320').split(',').map(Number)){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('neo-mahjong-theme-v1',theme);},theme);
  const runs=new Map(),requests=new Map();let active=null,created=0,loseStart=false,loseAnswer=false,restores=0;
  const view=run=>({runId:run.id,paperId:run.paper.id,startedAt:new Date(run.started).toISOString(),expiresAt:new Date(run.started+86400000).toISOString(),serverNow:new Date().toISOString(),index:run.items.length,status:run.status,question:run.status==='active'?publicQuestion(exercise(run.paper.refs[run.items.length])):undefined});
  await page.route('**/api/assistant/mahjong/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname.replace('/api/assistant/mahjong','');let output={};
   if(path==='/session')output={cookieConfirmed:true};
   else if(path==='/competitions')output={papers:competitionPapers};
   else if(path.endsWith('/leaderboard'))output={entries:[{rank:1,publicId:'other',alias:'牌友 A1B2C3D4',score:100,durationMs:187234,mine:false},{rank:2,publicId:'mine',alias:'牌友 E5F6G7H8',score:90,durationMs:263500,mine:true}],mine:{rank:2,score:90,durationMs:263500},total:2,archived:false};
   else if(path.endsWith('/runs')){
    const body=req.postDataJSON();let run=requests.get(body.requestId);
    if(!run){run={id:crypto.randomUUID(),paper:competitionPapers.find(p=>path.includes(p.id)),started:Date.now()-2000,items:[],status:'active'};runs.set(run.id,run);requests.set(body.requestId,run);active=run;created++;}
    output=view(run);if(loseStart){loseStart=false;await route.abort('failed');return;}
   }else if(path.includes('/competition-runs/')){
    const id=path.split('/')[2],run=runs.get(id);assert.ok(run,'Run exists');
    if(path.endsWith('/abandon')){run.status='abandoned';if(active===run)active=null;}
    else if(path.endsWith('/answers')){const body=req.postDataJSON();assert.equal(body.index,run.items.length);const q=exercise(run.paper.refs[body.index]);run.items.push({answer:body.answer,correct:grade(q,body.answer)});if(loseAnswer){loseAnswer=false;await route.abort('failed');return;}}
    else restores++;
    output=view(run);
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(output)});
  });
  const check=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);const text=await page.locator('#mahjong-main').innerText();for(const removed of ['同卷挑战 · 匿名参赛','恢复服务器进度','服务端连续计时','成都麻将 · 缺门后的专项训练','选择一张手牌后提交。'])assert.ok(!text.includes(removed));};
  await page.goto(origin+base+'/leaderboard');await page.getByRole('heading',{name:'排位赛',exact:true}).waitFor();const github=page.getByRole('link',{name:'GitHub 项目',exact:true});await github.waitFor();assert.equal(await github.count(),1);assert.equal(await github.locator('svg').count(),1);assert.equal((await github.innerText()).trim(),'');assert.equal(await github.getAttribute('target'),'_blank');assert.equal(await page.locator('.mj-brand-mark').count(),0);await check();await page.screenshot({path:`${dir}/${engine}-${theme}-${width}-ranking.png`});
  await page.getByRole('button',{name:'开始排位',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'开始比赛',exact:true}).click();await page.getByText('入门 · 1/20',{exact:true}).waitFor();
  const hand=page.locator('.mj-question > .mj-hand'),tile=sorted(exercise(competitionPapers[0].refs[0]).context.hand)[0];await hand.getByRole('button').nth(0).click();await untilSaved(page,d=>d.drafts['competition-selection']?.selected[0]===tile);
  await page.reload();await page.getByText('入门 · 1/20',{exact:true}).waitFor();await hand.locator('[aria-pressed="true"]').waitFor();assert.equal(await hand.locator('[aria-pressed="true"]').count(),1);
  const before=restores;await Promise.all([page.waitForResponse(r=>r.url().includes('/competition-runs/')&&r.request().method()==='GET'),page.evaluate(()=>window.dispatchEvent(new Event('focus')))]);assert.ok(restores>before);assert.equal(await hand.locator('[aria-pressed="true"]').count(),1);
  await context.setOffline(true);await page.getByText('已离线，联网后自动继续。',{exact:true}).waitFor();assert.equal(await hand.locator('[aria-pressed="true"]').count(),1);await context.setOffline(false);await page.getByText('已离线，联网后自动继续。',{exact:true}).waitFor({state:'hidden'});assert.equal(await hand.locator('[aria-pressed="true"]').count(),1);
  loseAnswer=true;await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('入门 · 2/20',{exact:true}).waitFor();assert.equal(active.items.length,1);assert.equal(await hand.locator('[aria-pressed="true"]').count(),0);
  await hand.getByRole('button').nth(0).click();await page.getByRole('button',{name:'重新挑战',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'继续本轮',exact:true}).click();assert.equal(await hand.locator('[aria-pressed="true"]').count(),1);
  const old=active.id;loseStart=true;await page.getByRole('button',{name:'重新挑战',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'重新挑战',exact:true}).click();await page.getByText('连接中断，恢复后会自动继续。',{exact:true}).waitFor();await untilSaved(page,d=>!!d.drafts['competition-start']?.abandonId);
  await page.reload();await page.getByText('入门 · 1/20',{exact:true}).waitFor();assert.equal(created,2);assert.notEqual(active.id,old);assert.equal(runs.get(old).status,'abandoned');assert.equal(await hand.locator('[aria-pressed="true"]').count(),0);assert.equal((await saved(page)).drafts['competition-start'],null);await check();await page.screenshot({path:`${dir}/${engine}-${theme}-${width}-match.png`});
  results.push({engine,theme,width,oneGithub:true,noLogo:true,renamed:true,refreshChoice:true,onlineRecovery:true,focusKeepsChoice:true,lostAnswerRecovered:true,restartCancelKeepsChoice:true,lostRestartIdempotent:true});await context.close();
 }
 await browser.close();
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} product flows passed: automatic recovery, retained selection, lost responses, safe restart and compact ranking UI.`);
