import {chromium,webkit} from 'playwright';
import {mkdir,writeFile,mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.MAHJONG_PREVIEW_URL??'http://127.0.0.1:5199';
await mkdir('artifacts/practice',{recursive:true});const results=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const profile=await mkdtemp(path.join(os.tmpdir(),'mahjong-practice-'));
 const context=await engine.launchPersistentContext(profile,{headless:name!=='webkit'||process.env.MAHJONG_WEBKIT_HEADED!=='1',viewport:{width:1280,height:900}});
 try{const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/practice');
 const board=page.locator('[data-segment]');await board.locator('[data-ready=true]').waitFor();
 const read=()=>page.evaluate(async()=>new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1');r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('learning');q.onsuccess=()=>{resolve(q.result.practice);db.close();};q.onerror=()=>reject(q.error);};}));
 await page.getByRole('button',{name:'知道了',exact:true}).click();await page.screenshot({path:`artifacts/practice/${name}-start.png`});
 const pieces=await board.locator('[data-piece]').evaluateAll(els=>els.map(e=>e.dataset.piece));
 let duplicate=pieces.find(id=>pieces.filter(x=>x.split(':')[0]===id.split(':')[0]).length>1);assert.ok(duplicate);
 await board.locator(`[data-piece="${duplicate}"] button`).click();await board.locator('[aria-pressed=true]').waitFor();assert.equal(await board.locator('[aria-pressed=true]').count(),1);
 const same=await board.locator('[data-piece]').evaluateAll(els=>els.map(e=>e.dataset.piece));await page.getByRole('button',{name:/^打出/}).click();await page.getByRole('button',{name:'继续',exact:true}).waitFor();assert.deepEqual(await board.locator('[data-piece]').evaluateAll(els=>els.map(e=>e.dataset.piece)),same);
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'继续',exact:true}).waitFor();assert.deepEqual(await board.locator('[data-piece]').evaluateAll(els=>els.map(e=>e.dataset.piece)),same);
 await page.getByRole('button',{name:'为什么',exact:true}).click();await page.getByRole('button',{name:'比较其他出法',exact:true}).click();assert.ok(await page.locator('table tbody tr').count());
 for(const width of [1920,1280,768,390,360,320])for(const theme of ['light','dark']){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});await page.waitForFunction(theme=>document.querySelector('.mahjong-app')?.getAttribute('data-theme')===theme,theme);await page.waitForFunction(()=>getComputedStyle(document.querySelector('header nav button:nth-child(2)')).color===getComputedStyle(document.querySelector('.mahjong-app')).color);const targets=await board.locator('[data-piece] button').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));assert.ok(targets.every(r=>r.w>=44&&r.h>=44));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} ${width} overflow`);assert.ok((await board.boundingBox()).width<=width);await page.screenshot({path:`artifacts/practice/${name}-${width}-${theme}.png`});}
 await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'继续',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-segment]')?.getAttribute('data-phase')!=='feedback');await board.locator('[data-ready=true]').waitFor();
 const next=await board.locator('[data-piece]').evaluateAll(els=>els.map(e=>e.dataset.piece));const after=await read(),current=after.segments.find(x=>x.id===after.group.ids[after.group.index]);assert.equal(next.filter(id=>same.includes(id)).length,13);assert.equal(next.includes(current.choices[0].tileId),false);
 await page.getByRole('button',{name:'给一点提示',exact:true}).click();await page.waitForFunction(()=>document.querySelector('button[disabled]')&&[...document.querySelectorAll('button')].find(b=>b.textContent==='给一点提示')?.disabled);await page.reload({waitUntil:'domcontentloaded'});await board.locator('[data-ready=true]').waitFor();assert.equal(await page.getByRole('button',{name:'给一点提示'}).isDisabled(),true);
 for(let n=0;n<35;n++){
  if(await page.getByRole('button',{name:'再练五副',exact:true}).count())break;
  const b=page.locator('[data-segment]');await b.waitFor();const phase=await b.getAttribute('data-phase');
  if(phase==='choose'){await b.locator('[data-ready=true]').waitFor();await b.locator('[data-piece] button').first().click();await page.getByRole('button',{name:/^打出/}).click();await page.locator('[data-phase=feedback]').waitFor();}
  else if(phase==='feedback'){await page.getByRole('button',{name:'继续',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-segment]')?.getAttribute('data-phase')!=='feedback');}
  else {const id=await b.getAttribute('data-segment');await page.getByRole('button',{name:/换一副起手|看看这一组/}).click();await page.waitForFunction(id=>document.querySelector('[data-segment]')?.getAttribute('data-segment')!==id,id);}
 }
 await page.getByRole('button',{name:'再练五副',exact:true}).waitFor();const saved=await read();assert.equal(saved.group.index,5);assert.equal(saved.segments.filter(s=>s.choices.length).length,5);
 await page.getByRole('button',{name:'我的进步',exact:true}).click();await page.getByRole('heading',{name:'我的进步'}).waitFor();await page.getByRole('button',{name:'让 AI 再看一层'}).click();await page.getByRole('dialog',{name:'再看一层'}).waitFor();assert.equal(requests.some(u=>u.includes('/profile')),false);await page.getByRole('button',{name:'暂不',exact:true}).click();
 assert.equal(requests.some(u=>/\.mp3|\.wav|\/journey\/|\/scenes\//.test(u)),false,'startup must not fetch audio or story art');assert.deepEqual(errors,[]);await page.route('https://raw.githubusercontent.com/liuminxin45/ai-mahjong/**',async route=>{const path=new URL(route.request().url()).pathname.split('/').slice(4).join('/');await route.fulfill({body:await readFile(path),contentType:'audio/mpeg'});});await page.getByRole('button',{name:'更多',exact:true}).click();const audioRequest=page.waitForRequest(r=>r.url().endsWith('.mp3'));await page.getByRole('button',{name:'听一点音乐',exact:true}).click();await audioRequest;await page.getByRole('button',{name:'练牌',exact:true}).click();await page.getByRole('button',{name:'再练五副',exact:true}).waitFor();results.push({browser:name,segments:5,choices:saved.segments.reduce((n,s)=>n+s.choices.length,0),responsive:12,network:{startupAudio:0,storyArt:0,optInMusic:1},errors});
 }finally{await context.close();const resolved=path.resolve(profile);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('mahjong-practice-'));await rm(resolved,{recursive:true,force:true});}
}
await writeFile('artifacts/practice/browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
