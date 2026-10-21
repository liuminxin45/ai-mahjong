import { chromium, webkit } from 'playwright';
import { returningLearner } from './browser-helpers.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5173';
await mkdir('artifacts/browser',{recursive:true});const results=[];
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await returningLearner(page);
 for(const theme of ['light','dark'])for(const width of [1920,1280,768,390,360,320]){
  await page.setViewportSize({width,height:width>767?900:844});await page.goto(base+'/practice');await page.evaluate(theme=>localStorage.setItem('neo-mahjong-theme-v1',theme),theme);
  for(const route of ['practice','analysis','manual','quiz','review','profile']){
   await page.goto(base+'/'+route);await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(70);
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,broken:[...document.querySelectorAll('img')].filter(i=>!i.complete||!i.naturalWidth).length}));assert.ok(dimensions.scroll<=width+1,`${name}/${theme}/${width}/${route}: page overflow ${dimensions.scroll}`);assert.equal(dimensions.broken,0,'All tile assets must load');
   const heading=page.locator('.mj-page-heading h1');if(await heading.count())assert.ok((await heading.boundingBox()).height<46,'Page title must remain one line');
   if(width<768&&route==='practice'){const target=await page.locator('.mj-hand button').first().boundingBox();assert.ok(target.width>=44&&target.height>=44,'Phone tile targets must be at least 44px');}
   if(width===1920||width===390)await page.screenshot({path:`artifacts/browser/${name}-${theme}-${width}-${route}.png`});
   results.push({browser:name,theme,width,route,...dimensions});
  }
 }
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'/practice?mode=discard&seed=0');await page.getByRole('heading',{level:1}).waitFor();await page.locator('.mj-hand').first().getByRole('button',{name:'九条',exact:true}).click();await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('判断正确',{exact:true}).waitFor();await page.reload();await page.getByText('判断正确',{exact:true}).waitFor();await page.getByRole('button',{name:'下一题',exact:true}).click();assert.equal(await page.getByRole('button',{name:'提交答案',exact:true}).count(),1);
 await page.goto(base+'/manual/lesson-01');await page.getByRole('link',{name:'把例子送到分析器 →'}).click();await page.getByRole('heading',{name:'手牌分析',exact:true}).waitFor();assert.ok(page.url().includes('/analysis?hand='));
 await page.getByRole('button',{name:'数据与设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/practice');await page.getByRole('button',{name:'切换导航',exact:true}).click();await page.getByRole('link',{name:'手牌分析',exact:true}).click();await page.getByRole('heading',{name:'手牌分析',exact:true}).waitFor();
 assert.deepEqual(errors,[],`${name}: uncaught browser errors`);await browser.close();
}
await writeFile('artifacts/browser/results.json',JSON.stringify(results,null,2));console.log(`${results.length} route/theme/viewport probes and interaction checks passed.`);
