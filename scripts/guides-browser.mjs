import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {answers,competitionPapers,exercise,MODE_NAMES,MODES,practiceQuestions,publicQuestion} from '../lib/learning/index.js';
import {tileName} from '../lib/engine/index.js';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5189',base=process.env.MAHJONG_ROUTE_BASE||'',dir=process.env.MAHJONG_GUIDE_ARTIFACTS||'artifacts/guides-browser';
const widths=(process.env.MAHJONG_GUIDE_WIDTHS||'1920,1280,768,390,360,320').split(',').map(Number),results=[];
await mkdir(dir,{recursive:true});
const saved=page=>page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);});const data=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('learning');r.onsuccess=()=>resolve(r.result);});db.close();return data;});
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 try{for(const theme of ['light','dark'])for(const width of widths){
  const height=width===320?568:900,context=await browser.newContext({viewport:{width,height},hasTouch:width<768}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('neo-mahjong-theme-v1',theme);},theme);
  const timed=engine==='chromium'&&theme==='light'&&width===390;let starts=0,runId=null,started=0;
  await page.route('**/api/assistant/mahjong/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname.replace('/api/assistant/mahjong','');let output={};
   if(path==='/session')output={cookieConfirmed:true};else if(path==='/competitions')output={papers:competitionPapers};else if(path.endsWith('/leaderboard'))output={entries:[],mine:null,total:0,archived:false};
   else if(path.endsWith('/runs')){starts++;runId=crypto.randomUUID();started=Date.now();}
   if(path.endsWith('/runs')||path.includes('/competition-runs/'))output={runId,paperId:competitionPapers[0].id,startedAt:new Date(started).toISOString(),expiresAt:new Date(started+86400000).toISOString(),serverNow:new Date().toISOString(),index:0,status:'active',question:publicQuestion(exercise(competitionPapers[0].refs[0]))};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(output)});
  });
  const dialog=page.getByRole('dialog'),check=async()=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,JSON.stringify(bounds));
   assert.equal(await dialog.locator('.desktop-dialog__body').evaluate(el=>el.scrollWidth>el.clientWidth),false);assert.deepEqual(errors,[]);
   const footer=await dialog.locator('footer').boundingBox();assert.ok(footer.y+footer.height<=height+1);
  };
  try{
   await page.goto(origin+base+'/practice?mode=ukeire&level=1');await dialog.getByRole('heading',{name:'有效进张 · 规则与示例',exact:true}).waitFor();await check();assert.equal(await dialog.locator('.desktop-dialog__body').evaluate(el=>el.scrollTop),0);
   assert.ok((await dialog.innerText()).includes('综合向听'));assert.ok((await dialog.innerText()).includes('1向听 → 0向听'));
   await page.screenshot({path:`${dir}/${engine}-${theme}-${width}-ukeire.png`});
   const seen=dialog.getByRole('combobox',{name:'示例已见四条'});await seen.click();await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);assert.equal(await page.getByRole('option').count(),0);
   await seen.click();await page.getByRole('option',{name:'3张',exact:true}).click();await dialog.getByRole('status').getByText('四条还剩1张，七条还剩4张：应选两种，共5张。',{exact:true}).waitFor();
   await seen.click();await page.getByRole('option',{name:'4张',exact:true}).click();await dialog.getByRole('status').getByText('四条已经四张全见，不再选它；只选七条，共4张。',{exact:true}).waitFor();assert.equal(await dialog.locator('.mj-guide-answer img[alt="四条"]').count(),0);assert.equal(await dialog.locator('.mj-guide-answer img[alt="七条"]').count(),1);await check();
   if(timed){await page.clock.install();await page.clock.runFor(20000);}
   await dialog.getByRole('button',{name:'明白了，开始练习',exact:true}).click();await dialog.waitFor({state:'hidden'});
   if(timed)await page.clock.runFor(2000);
   const q=practiceQuestions('ukeire',1)[0],palette=page.locator('.mj-palette');for(const tile of answers(q))await palette.getByRole('button',{name:tileName(tile),exact:true}).click();const selected=await palette.locator('[aria-pressed="true"]').count();assert.ok(selected>0);
   const help=page.getByRole('button',{name:'规则与示例',exact:true});await help.click();await dialog.waitFor();if(timed)await page.clock.runFor(15000);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await palette.locator('[aria-pressed="true"]').count(),selected);await page.waitForFunction(()=>document.activeElement?.textContent==='规则与示例');
   if(timed){await page.clock.runFor(1000);await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('判断正确',{exact:true}).waitFor();await page.clock.runFor(1000);const data=await saved(page),attempt=data.attempts.at(-1);assert.equal(attempt.assisted,false);assert.ok(attempt.durationMs>=3000&&attempt.durationMs<5000,JSON.stringify(attempt));await page.clock.resume();}
   await page.reload();await page.locator('.mj-question').waitFor();assert.equal(await dialog.count(),0);assert.equal(await palette.locator('[aria-pressed="true"]').count(),selected);
   for(const mode of MODES.filter(m=>m!=='ukeire')){
    await page.goto(origin+base+'/practice?mode='+mode+'&level=1');await dialog.getByRole('heading',{name:`${MODE_NAMES[mode]} · 规则与示例`,exact:true}).waitFor();assert.ok(await dialog.locator('img').count()>0);await check();
    if(mode==='waits')assert.ok((await dialog.innerText()).includes('本专项仍选四条和七条'));
    if(mode==='seven-pairs')assert.ok((await dialog.innerText()).includes('合计六对'));
    if(mode!=='waits'){await dialog.getByText('遇到「未来几次摸牌」的题',{exact:true}).click();assert.ok((await dialog.innerText()).includes('摸过的牌不放回'));}
    await dialog.getByRole('button',{name:'明白了，开始练习',exact:true}).click();await dialog.waitFor({state:'hidden'});
   }
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('neo-mahjong-guides-v1')).length),5);
   await page.goto(origin+base+'/leaderboard');await page.getByRole('button',{name:'开始排位',exact:true}).click();await dialog.getByRole('heading',{name:'排位赛 · 规则与示例',exact:true}).waitFor();assert.equal(starts,0);await check();
   for(const mode of MODES){await dialog.getByRole('combobox',{name:'查看题型说明'}).click();await page.getByRole('option',{name:MODE_NAMES[mode],exact:true}).click();await dialog.getByRole('heading',{name:'怎么作答',exact:true}).waitFor();assert.ok(await dialog.locator('img').count()>0);await check();}
   await page.screenshot({path:`${dir}/${engine}-${theme}-${width}-competition.png`});await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(starts,0);await page.waitForFunction(()=>document.activeElement?.textContent==='开始排位');
   await page.getByRole('button',{name:'开始排位',exact:true}).click();await dialog.getByRole('button',{name:'开始比赛',exact:true}).click();await page.getByText('入门 · 1/20',{exact:true}).waitFor();assert.equal(starts,1);
   await page.getByRole('button',{name:'规则与示例',exact:true}).click();await dialog.getByText('比赛计时仍在继续。这里的例子独立于本轮题目。',{exact:true}).waitFor();assert.ok((await dialog.innerText()).includes('比赛已经开始，查看这份说明也会计时'));await dialog.getByRole('button',{name:'明白了',exact:true}).click();assert.equal(starts,1);await page.getByText('入门 · 1/20',{exact:true}).waitFor();assert.deepEqual(errors,[]);
   results.push({engine,theme,width,firstVisit:true,retainedChoice:true,allFiveExamples:true,nestedEscape:true,focusReturn:true,preStartNoUpload:true,rankedRules:true,...(timed?{readingExcludedFromPracticeTime:true}:{})});console.log(`${engine} ${theme} ${width}: five practice guides, examples, focus and ranked rules passed.`);
  }finally{await context.close();}
 }
 // A blocked preference store must not trap a learner in the same intro on every SPA remount.
 const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='neo-mahjong-guides-v1')throw Error('blocked');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='neo-mahjong-guides-v1')throw Error('blocked');return set.call(this,key,value);};});
 try{await page.goto(origin+base+'/practice?mode=discard&level=1');await page.getByRole('dialog').getByRole('button',{name:'明白了，开始练习',exact:true}).click();await page.getByRole('combobox',{name:'练习难度'}).click();await page.getByRole('option',{name:'基础',exact:true}).click();await page.locator('.mj-question').waitFor();assert.equal(await page.getByRole('dialog').count(),0);}finally{await context.close();}
 }finally{await browser.close();}
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} guide combinations plus blocked-storage checks passed.`);
