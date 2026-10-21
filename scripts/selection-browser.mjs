import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { exercise, grade } from '../lib/learning/index.js';
import { sorted } from '../lib/engine/index.js';
import { returningLearner } from './browser-helpers.mjs';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:4177',base=process.env.MAHJONG_ROUTE_BASE||'';
let seed=10;while(exercise({mode:'discard',seed}).context.hand.filter(t=>t==='9s').length<2)seed++;
const correct=grade(exercise({mode:'discard',seed}),['9s']);
const empty=()=>({version:1,attempts:[],mistakes:[],completed:[],profiles:[],drafts:{}});
const put=async(page,data)=>page.evaluate(async data=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();},data);
const read=async page=>page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);});const data=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('learning');r.onsuccess=()=>resolve(r.result);});db.close();return data;});
const untilSaved=async(page,check)=>{for(let i=0;i<100;i++){const data=await read(page);if(check(data))return data;await page.waitForTimeout(20);}throw new Error('Expected selection was not committed to IndexedDB');};
const dir=process.env.MAHJONG_SELECTION_ARTIFACTS||'artifacts/selection-browser';await mkdir(dir,{recursive:true});const results=[];
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 for(const theme of ['light','dark'])for(const width of [1920,1280,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1.25,hasTouch:width<768}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await returningLearner(page);await page.goto(origin+base+'/quiz/legacy');await page.getByRole('heading',{level:1}).waitFor();
  await page.evaluate(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('neo-mahjong-theme-v1',theme);},theme);
  await put(page,{...empty(),drafts:{quiz:{seed,index:0,answers:[]}}});await page.reload();await page.getByRole('heading',{name:'阶段测验',exact:true}).waitFor();
  const hand=page.locator('.mj-question > .mj-hand'),copies=hand.getByRole('button',{name:'九条',exact:true}),pressed=hand.locator('button[aria-pressed="true"]');
  assert.ok(await copies.count()>=2);assert.equal(await pressed.count(),0);
  await copies.nth(0).click();assert.equal(await pressed.count(),1,`${name}/${theme}/${width}: only the clicked copy is selected`);assert.equal(await copies.nth(0).getAttribute('aria-pressed'),'true');
  if(width<768)await copies.nth(1).tap();else await copies.nth(1).click();assert.equal(await pressed.count(),1);assert.equal(await copies.nth(0).getAttribute('aria-pressed'),'false');assert.equal(await copies.nth(1).getAttribute('aria-pressed'),'true');
  await copies.nth(0).focus();await page.keyboard.press('Enter');assert.equal(await pressed.count(),1);assert.equal(await copies.nth(0).getAttribute('aria-pressed'),'true');
  await copies.nth(1).focus();await page.keyboard.press('Space');assert.equal(await pressed.count(),1);assert.equal(await copies.nth(1).getAttribute('aria-pressed'),'true');
  const physicalIndex=sorted(exercise({mode:'discard',seed}).context.hand).indexOf('9s')+1;await untilSaved(page,d=>d.drafts['quiz-selection']?.selectedIndex===physicalIndex);
  await page.reload();await page.getByRole('heading',{name:'阶段测验',exact:true}).waitFor();assert.equal(await pressed.count(),1);assert.equal(await copies.nth(1).getAttribute('aria-pressed'),'true');
  // Returning to this question also preserves the physical tile, rather than all equal values.
  await page.goto(origin+base+'/analysis');await page.getByRole('heading',{name:'手牌分析',exact:true}).waitFor();await page.goto(origin+base+'/quiz/legacy');await page.getByRole('heading',{name:'阶段测验',exact:true}).waitFor();assert.equal(await copies.nth(1).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`${dir}/${name}-${theme}-${width}.png`});
  await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('答案已记录。',{exact:true}).waitFor();assert.equal(await pressed.count(),1);assert.equal(await copies.nth(1).isDisabled(),true);
  await untilSaved(page,d=>d.drafts.quiz.answers.length===1&&d.drafts['quiz-selection']?.submitted);
  await page.reload();await page.getByText('答案已记录。',{exact:true}).waitFor();assert.equal(await copies.nth(1).getAttribute('aria-pressed'),'true');const saved=await read(page);assert.deepEqual(saved.attempts.at(-1).answer,['9s']);assert.equal(saved.attempts.at(-1).correct,correct);assert.equal(saved.attempts.length,1);
  await page.getByRole('button',{name:'下一题',exact:true}).click();await page.getByRole('button',{name:'提交答案',exact:true}).waitFor();assert.equal(await pressed.count(),0);assert.equal(await page.getByRole('button',{name:'提交答案',exact:true}).isDisabled(),true);
  await untilSaved(page,d=>d.drafts.quiz.index===1);
  // Old value-only drafts remain usable and select one deterministic copy.
  await put(page,{...empty(),drafts:{'practice:discard':{seed,selected:['9s'],submitted:false,hint:false}}});await page.goto(origin+base+'/practice?mode=discard');await page.getByRole('heading',{name:'专项练习',exact:true}).waitFor();await page.getByRole('link',{name:'继续旧版练习',exact:true}).click();await pressed.waitFor();assert.equal(await pressed.count(),1);assert.equal(await copies.nth(0).getAttribute('aria-pressed'),'true');await copies.nth(1).click();assert.equal(await pressed.count(),1);
  // Waiting-tile answers still support multiple distinct tile values.
  await page.goto(origin+base+'/practice?mode=waits&seed=0');const palette=page.locator('.mj-palette');await palette.getByRole('button').nth(0).click();await palette.getByRole('button').nth(1).click();assert.equal(await palette.locator('[aria-pressed="true"]').count(),2);await palette.getByRole('button').nth(0).click();assert.equal(await palette.locator('[aria-pressed="true"]').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);results.push({browser:name,theme,width,seed,physicalSelection:true,keyboard:true,refresh:true,singleRecordedAnswer:true,multiSelect:true});await context.close();
 }
 await browser.close();
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} selection checks passed: duplicate copies, touch/keyboard, draft and submitted refresh, grading and multi-select.`);
