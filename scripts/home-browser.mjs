import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { answers,exercise } from '../lib/learning/index.js';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:4177',base=process.env.MAHJONG_ROUTE_BASE||'';
const widths=(process.env.MAHJONG_HOME_WIDTHS||'1920,1280,768,390,360,320').split(',').map(Number);
const dir=process.env.MAHJONG_HOME_ARTIFACTS||'artifacts/home-browser';await mkdir(dir,{recursive:true});const results=[];
const empty=()=>({version:1,attempts:[],mistakes:[],completed:[],profiles:[],drafts:{}});
const put=async(page,data)=>page.evaluate(async data=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();},data);
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 for(const theme of ['light','dark'])for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:width===320?568:900},deviceScaleFactor:1.25}),page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('neo-mahjong-theme-v1',theme);},theme);
  if(base){
   await page.goto(origin+'/');await page.locator('.home-page').waitFor();assert.equal(await page.locator('.home-page .thought-row').count(),1);assert.equal(await page.locator('.home-page .work-preview').count(),1);assert.equal(await page.locator('.home-page .work-preview').getAttribute('href'),'/works/mahjong');assert.ok(!requests.some(url=>/\/assets\/Mahjong-[^/]+\.js/.test(url)),'Site home must not eagerly load the learning tool');
   await page.locator('.home-page .work-preview').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/site-${name}-${theme}-${width}.png`});await page.getByRole('link',{name:'全部造物 →',exact:true}).click();await page.locator('.works-page').waitFor();const cards=page.locator('.works-page .work-preview');assert.equal(await cards.count(),4);const boxes=await cards.evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return{top:r.top,bottom:r.bottom};}));for(let i=1;i<boxes.length;i++)assert.ok(boxes[i].top-boxes[i-1].bottom>=16,'Works entries must have space between them');
  }
  await page.goto(origin+base+'/');await page.getByRole('heading',{name:'麻将研习',level:1,exact:true}).waitFor();assert.ok(!page.url().includes('/practice'));assert.equal(await page.locator('.mj-question').count(),0);const home=page.locator('.mj-home');await home.getByRole('button',{name:'从认牌开始',exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.mj-home img')].every(i=>i.complete&&i.naturalWidth));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${dir}/tool-${name}-${theme}-${width}.png`});
  const github=page.getByRole('link',{name:'GitHub 项目',exact:true});assert.equal(await github.count(),1);assert.equal(await github.getAttribute('href'),'https://github.com/liuminxin45/ai-mahjong');assert.equal(await github.getAttribute('target'),'_blank');assert.ok((await github.getAttribute('rel')).includes('noopener'));
  if(width<768)await page.getByRole('button',{name:'切换导航',exact:true}).click();const sidebar=page.locator('.mj-sidebar');assert.equal(await sidebar.locator('nav .mj-nav-active').count(),1);assert.equal(await sidebar.locator('nav .mj-nav-active').textContent(),'首页');
  if(width<768)await page.keyboard.press('Escape');await home.getByRole('button',{name:'从认牌开始',exact:true}).click();await page.getByRole('heading',{name:'双花色牌组',exact:true}).waitFor();assert.ok(page.url().endsWith('/manual/lesson-01'));
  await page.locator('#mahjong-main').evaluate(el=>el.scrollTop=el.scrollHeight);if(width<768)await page.getByRole('button',{name:'切换导航',exact:true}).click();await sidebar.getByRole('link',{name:'首页',exact:true}).click();await home.waitFor();assert.equal(await page.locator('#mahjong-main').evaluate(el=>el.scrollTop),0);
  const q=exercise({mode:'discard',seed:0}),answer=[answers(q)[0]],attempt={id:'home-evidence-000',ref:q.ref,answer,assisted:false,review:false,durationMs:12000,at:new Date().toISOString(),correct:true,exerciseId:q.id};
  await put(page,{...empty(),attempts:[attempt],completed:['lesson-01','lesson-02'],mistakes:[{ref:q.ref,exerciseId:q.id,stage:0,due:'2000-01-01',favorite:false}],drafts:{'practice:discard':{seed:0,selected:answer,submitted:false,hint:false}}});
  await page.goto(origin+base+'/');await home.getByRole('button',{name:'继续练习',exact:true}).waitFor();assert.deepEqual(await home.locator('.mj-stat-line strong').allTextContents(),['2/24','1','1']);await home.getByRole('button',{name:'继续练习',exact:true}).click();await page.getByRole('heading',{name:'专项练习',exact:true}).waitFor();assert.equal(await page.locator('.mj-question button[aria-pressed="true"]').count(),1);
  await put(page,{...empty(),drafts:{quiz:{seed:111,index:1,answers:[attempt]}}});await page.goto(origin+base+'/');await home.getByRole('button',{name:'继续旧版测验',exact:true}).click();await page.getByRole('heading',{name:'阶段测验',exact:true}).waitFor();await page.getByText('2 / 20',{exact:true}).waitFor();
  if(width<768)await page.getByRole('button',{name:'切换导航',exact:true}).click();await sidebar.getByRole('link',{name:'首页',exact:true}).click();await home.getByRole('button',{name:'继续旧版测验',exact:true}).waitFor();assert.equal(await sidebar.locator('nav .mj-nav-active').textContent(),'首页');assert.deepEqual(errors,[]);results.push({browser:name,theme,width,home:true,github:true,learningEntry:true,practiceRestored:true,quizRestored:true,...(base?{siteLatestOnly:true,worksCount:4,lazyTool:true}:{})});await context.close();
 }
 await browser.close();
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} homepage checks passed: first visit, progress, course/practice/quiz entries, GitHub, responsive navigation${base?', latest-only site home and complete spaced works list':''}.`);
