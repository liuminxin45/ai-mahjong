import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5190',base=process.env.MAHJONG_ROUTE_BASE||'',results=[];await mkdir('artifacts/decision-routes',{recursive:true});
for(const[engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch({headless:engine!=='webkit'||process.env.MAHJONG_WEBKIT_HEADED!=='1'}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['analysis','quiz','leaderboard','review','learn','manual/lesson-01','profile','progress']){
  console.log('Checking retired route '+engine+'/'+path);await page.goto(origin+base+'/'+path);if(['learn','manual/lesson-01','profile','progress'].includes(path)){await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});}await page.getByRole('heading',{name:'练会每一手的取舍',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'摆一手自己的牌',exact:true}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);results.push({engine,path,redirect:true});
 }
 await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('menuitem',{name:'调整难度',exact:true}).click();await page.getByRole('combobox',{name:'练习阶段',exact:true}).click();await page.getByRole('option',{name:'权衡快与大',exact:true}).click();await page.getByRole('combobox',{name:'深度题',exact:true}).click();await page.getByRole('option',{name:'加入4—6次摸打题',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'开始练习',exact:true}).click();await page.getByRole('heading',{name:'这一手，打哪张？',exact:true}).waitFor();await page.getByText('本题只从这些牌摸',{exact:true}).waitFor();await page.screenshot({path:'artifacts/decision-routes/'+engine+'-advanced.png'});assert.deepEqual(errors,[]);await context.close();await browser.close();
}
await writeFile('artifacts/decision-routes/results.json',JSON.stringify(results,null,2));console.log('Retired route and advanced opt-in checks passed.');
