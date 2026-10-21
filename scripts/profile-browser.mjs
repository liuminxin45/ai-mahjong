import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { answers, exercise, snapshot, validateSnapshot } from '../lib/learning/index.js';
const base=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:4177';
const path=process.env.MAHJONG_PROFILE_PATH||'/profile';
const attempts=Array.from({length:12},(_,seed)=>{const q=exercise({mode:'discard',seed});return {id:`browser-profile-${seed}`,ref:q.ref,answer:[answers(q)[0]],correct:true,assisted:false,review:false,durationMs:12000+seed*1000,at:new Date(2026,9,1,0,seed).toISOString(),exerciseId:q.id};});
const data={version:1,attempts,mistakes:[],completed:[],profiles:[],drafts:{}};
await mkdir('artifacts/profile-browser',{recursive:true});const results=[];
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 for(const theme of ['light','dark'])for(const width of [1280,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1.25}),page=await context.newPage();let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/assistant/mahjong/session',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cookieConfirmed:true})}));
  await page.route('**/api/assistant/mahjong/profile',async route=>{calls++;const submitted=validateSnapshot(route.request().postDataJSON().snapshot);assert.equal(submitted.attempts.length,12);assert.equal(submitted.dimensions[0].count,12);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({reportId:'browser-report',at:new Date().toISOString(),profile:{summary:'已分析全部12道何切。',strengths:[],weaknesses:[],uncertainties:['其他专项证据不足。'],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-10',mode:'discard',task:'练习舍牌判断。'}))}})});});
  await page.goto(base+path);await page.getByRole('heading',{level:1,name:'学习画像',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'生成学习报告',exact:true}).isDisabled(),true);
  await page.evaluate(async({data,theme})=>{localStorage.setItem('neo-mahjong-theme-v1',theme);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();},{data,theme});
  await page.reload();const button=page.getByRole('button',{name:'生成学习报告',exact:true});await button.waitFor();assert.equal(await button.isEnabled(),true);assert.equal(calls,0);await page.getByText('本次包含12次作答',{exact:false}).waitFor();
  assert.ok(await page.getByText('不足5道独立作答',{exact:false}).count());
  await button.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.ok(await dialog.getByText('全部12次答题记录',{exact:false}).count());assert.equal(calls,0);
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(calls,0);assert.equal(await button.evaluate(el=>document.activeElement===el),true);
  await button.click();await dialog.getByRole('button',{name:'提交并生成',exact:true}).click();await page.getByRole('heading',{name:'你的学习报告',exact:true}).waitFor();assert.equal(calls,1);
  await page.reload();await page.getByRole('heading',{name:'你的学习报告',exact:true}).waitFor();assert.equal(calls,1);
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=width+1);assert.deepEqual(errors,[]);
  await page.locator('.mj-profile-generate').scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/profile-browser/${name}-${theme}-${width}.png`,fullPage:true});results.push({browser:name,theme,width,records:12,confirmedUploads:calls,refreshRetained:true});await context.close();
 }
 await browser.close();
}
await writeFile('artifacts/profile-browser/results.json',JSON.stringify(results,null,2));console.log(`${results.length} profile viewport/theme/browser cases passed, including 12-answer unlock, confirmation, compact upload and saved report.`);
