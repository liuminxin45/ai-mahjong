import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { emptyStory, startJourney, nodeFor, nodeSeed, accepted, branchPair, outcome, validateStorySnapshot, composeStoryProfile } from '../lib/story/index.js';
import { story } from '../lib/story/definition.js';
const base=process.env.MAHJONG_PREVIEW_URL??'http://127.0.0.1:5197';
await mkdir('artifacts/story',{recursive:true});
const audio=JSON.parse(await readFile('assets/audio/manifest.json','utf8'));
const files=new Map(await Promise.all(audio.files.map(async a=>[a.path,{body:await readFile(a.path),type:a.mime}])));
const logs=[];
async function saved(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('learning');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
async function persist(page,data){await page.evaluate(data=>new Promise((resolve,reject)=>{const r=indexedDB.open('neo-mahjong-learning-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(data,'learning');tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>reject(tx.error);};}),data);}
async function waitSaved(page,test){for(let i=0;i<100;i++){const data=await saved(page);if(test(data))return data;await page.waitForTimeout(30);}throw Error('Progress was not saved');}
function seedFor(loss,ending){const gate=story.nodes.find(n=>n.position===20),last=story.nodes.find(n=>n.position===25&&n.variant===(loss?'loss':'clear'));for(let seed=0;seed<10000;seed++)if(gate.certificate.options.some(o=>(outcome(gate,{seed},o.tile).kind==='opponent')===loss)&&last.certificate.options.some(o=>outcome(last,{seed},o.tile).kind===ending))return seed;throw Error('No seed');}
async function setup(browser,options={}){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',...options}),page=await context.newPage(),errors=[],requests=[];
  // Playwright's Windows WebKit build has no audio backend. Linux CI exercises real decoding.
  if(process.platform==='win32'&&browser.browserType().name()==='webkit')await context.addInitScript(assets=>{
    class Media {src='';currentTime=0;volume=0;loop=false;preload='';play(){return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
    class Context {currentTime=0;destination={};resume(){return Promise.resolve();}suspend(){return Promise.resolve();}decodeAudioData(bytes){return Promise.resolve({length:100,duration:assets.find(a=>a.bytes===bytes.byteLength)?.duration??0});}createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},connect(){return {};}};}createMediaElementSource(){return {connect(){return {connect(){}};}};}createBufferSource(){return {buffer:null,connect(){return {connect(){}};},start(){}};}}
    window.Audio=Media;window.AudioContext=Context;
  },audio.files);
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://raw.githubusercontent.com/liuminxin45/ai-mahjong/**',async route=>{const path=new URL(route.request().url()).pathname.split('/').slice(4).join('/'),asset=files.get(path);requests.push(path);assert.ok(asset,'Unexpected audio URL '+path);await route.fulfill({status:200,body:asset.body,contentType:asset.type,headers:{'Access-Control-Allow-Origin':'*'}});});
  await page.goto(base);try{await page.getByRole('button',{name:'落座',exact:true}).waitFor({timeout:60000});}catch(e){console.error(JSON.stringify({browser:browser.browserType().name(),errors,requests:requests.length,text:await page.locator('body').innerText()}));await page.screenshot({path:'artifacts/story/loading-error-'+browser.browserType().name()+'.png'});await context.close();throw e;}
  assert.equal(requests.length,11);assert.equal(await page.locator('.mj-resource-progress').count(),0);
  const cacheAvailable=await page.evaluate(async()=>{try{return (await(await caches.open('neo-mahjong-media-v1')).keys()).length===31;}catch{return false;}});
  return {context,page,errors,requests,cacheAvailable};
}
async function journey(browser,label,split,loss,ending){
  const {context,page,errors,requests,cacheAvailable}=await setup(browser),seed=seedFor(loss,ending);
  await page.getByRole('button',{name:'落座',exact:true}).click();await page.locator('[data-node]').waitFor();
  let data=await waitSaved(page,d=>!!d?.story?.journeys.length);data.story=startJourney(emptyStory(),'browser-journey-'+label,seed);await persist(page,data);await page.reload();await page.getByRole('button',{name:'回到牌桌',exact:true}).click();
  for(let p=1;p<=25;p++){
    data=await waitSaved(page,d=>d?.story?.journeys.at(-1)?.position===p);const j=data.story.journeys.at(-1),n=nodeFor(j),round=page.locator('[data-node="'+n.id+'"]');await round.waitFor();
    let tile=accepted(n)[0];if(p===10)tile=split?branchPair(n):n.question.context.hand.find(t=>t!==branchPair(n));if(p===20)tile=n.certificate.options.find(o=>(outcome(n,j,o.tile).kind==='opponent')===loss).tile;if(p===25)tile=n.certificate.options.find(o=>outcome(n,j,o.tile).kind===ending).tile;
    const buttons=round.locator(':scope > .mj-hand button');await buttons.nth(n.question.context.hand.indexOf(tile)).click();assert.equal(await buttons.filter({has:page.locator('.mj-tile-selection')}).count(),1);
    if(p===1){const duplicate=n.question.context.hand.find(t=>n.question.context.hand.filter(x=>x===t).length>1),indices=n.question.context.hand.flatMap((t,i)=>t===duplicate?[i]:[]);await buttons.nth(indices[0]).click();assert.equal(await buttons.filter({has:page.locator('.mj-tile-selection')}).count(),1);await buttons.nth(indices[1]).click();assert.equal(await buttons.nth(indices[0]).getAttribute('aria-pressed'),'false');assert.equal(await buttons.nth(indices[1]).getAttribute('aria-pressed'),'true');await buttons.first().focus();await page.keyboard.press('ArrowRight');assert.equal(await buttons.nth(1).evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Home');await page.keyboard.press('Space');assert.equal(await buttons.filter({has:page.locator('.mj-tile-selection')}).count(),1);await buttons.nth(n.question.context.hand.indexOf(tile)).click();}
    await round.getByRole('button',{name:'打'+(await buttons.nth(n.question.context.hand.indexOf(tile)).getAttribute('aria-label')),exact:true}).click();
    await round.locator('.mj-experience-response').waitFor();await waitSaved(page,d=>d?.story?.attempts.length===p);
    if(p===1){await page.reload();await page.getByRole('button',{name:'回到牌桌',exact:true}).click();await page.locator('[data-node]').waitFor();assert.equal(await page.locator('.mj-experience-response').count(),1);if(cacheAvailable&&!(process.platform==='win32'&&browser.browserType().name()==='webkit'))assert.equal(requests.length,11,'Warm reload redownloaded audio');}
    if(p===16)await page.screenshot({path:'artifacts/story/opponent-'+label+'.png'});
    await page.getByRole('button',{name:p===25?'翻到最后一页':p%5===0?'收起这五手':'下一手',exact:true}).click();
    if(p%5===0&&p<25)await page.getByRole('button',{name:'继续翻页',exact:true}).click();
  }
  for(const name of ['翻到背面','再看那张牌','读完附言','合上牌谱']){await page.getByRole('button',{name,exact:true}).click();}
  await page.getByRole('heading',{name:'周六我在。老位置。',exact:true}).waitFor();
  data=await waitSaved(page,d=>d?.story?.journeys.at(-1)?.phase==='done');assert.equal(data.story.attempts.length,25);assert.equal(data.story.journeys.at(-1).splitPair,split);assert.equal(data.story.journeys.at(-1).lost,loss);
  let uploads=0,deletes=0;
  await page.route('**/api/assistant/mahjong/session',route=>route.fulfill({json:{cookieConfirmed:true}}));
  await page.route('**/api/assistant/mahjong/profile**',async route=>{if(route.request().method()==='DELETE'){deletes++;return route.fulfill({json:{ok:true}});}uploads++;const checked=validateStorySnapshot(route.request().postDataJSON().snapshot);await route.fulfill({json:{reportId:'6e3a01c3-f071-4db4-a4fa-6a18d19cce7f',at:new Date().toISOString(),profile:composeStoryProfile(checked.facts[0],'again')}});});
  await page.getByRole('button',{name:'我的取舍',exact:true}).last().click();await page.getByRole('button',{name:'再看一层',exact:true}).click();assert.equal(uploads,0);await page.getByRole('button',{name:'确认回望',exact:true}).click();await page.getByText('过往',{exact:true}).waitFor();assert.equal(uploads,1);await page.getByText('过往',{exact:true}).click();await page.getByRole('button',{name:'删除这份云端回望',exact:true}).click();assert.equal(deletes,0);await page.getByRole('button',{name:'删除',exact:true}).click();await page.waitForTimeout(100);assert.equal(deletes,1);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'再来五手',exact:true}).click();await page.getByRole('heading',{name:'这一手，打哪张？',exact:true}).waitFor();
  for(let i=0;i<5;i++){const b=page.locator('.mj-decision-practice > .mj-hand button');await b.first().click();await page.locator('.mj-decision-answer button').first().click();await page.getByRole('button',{name:i===4?'走完这一轮':'下一手',exact:true}).click();if(i===0){await waitSaved(page,d=>d?.experience?.groups.at(-1)?.index===1);await page.reload();await page.getByRole('button',{name:'回到牌桌',exact:true}).click();await page.getByRole('heading',{name:'这一手，打哪张？',exact:true}).waitFor();assert.equal((await saved(page)).experience.groups.at(-1).index,1);}}
  await page.getByRole('button',{name:'再走五手',exact:true}).waitFor();
  assert.deepEqual(errors,[]);logs.push({browser:label,split,loss,ending,hands:25,continuation:5,audioRequests:requests.length,persistentCache:cacheAvailable,cacheSurvivedReload:requests.length===11,consent:true,delete:true,errors});await context.close();
}
async function layouts(browser,label){
 const {context,page,errors}=await setup(browser);await page.getByRole('button',{name:'落座',exact:true}).click();await page.locator('[data-node]').waitFor();
 for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme});for(const width of [1920,1280,768,390,360,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,min:Math.min(...[...document.querySelectorAll('[data-node]>.mj-hand button')].map(e=>e.getBoundingClientRect().width))}));assert.ok(metrics.scroll<=width,label+': overflow '+width);assert.ok(metrics.min>=44,label+': tile touch width '+JSON.stringify(metrics));await page.screenshot({path:`artifacts/story/${label}-${colorScheme}-${width}.png`});}}
 await page.getByRole('button',{name:'局面条件',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:'局面条件',exact:true}).evaluate(e=>e===document.activeElement),true);assert.deepEqual(errors,[]);logs.push({browser:label,widths:6,themes:2,errors});await context.close();
}
async function motion(browser){
 const {context,page,errors}=await setup(browser,{reducedMotion:'no-preference',recordVideo:{dir:'artifacts/story/motion',size:{width:1280,height:900}}});
 await page.getByRole('button',{name:'落座',exact:true}).click();await page.locator('.mj-experience-intro').waitFor();await page.keyboard.press('Escape');await page.locator('[data-node][data-presenting=false]').waitFor();assert.equal(await page.locator('[data-node]>.mj-hand [aria-pressed=true]').count(),0);
 await page.locator('[data-node]>.mj-hand button').first().click();await page.locator('.mj-story-action button').click();await page.getByRole('button',{name:'下一手',exact:true}).click();await page.locator('[data-node][data-presenting=true]').waitFor();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.ok(await page.evaluate(()=>document.getAnimations().every(a=>a.playState!=='running')));await page.waitForTimeout(100);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.keyboard.press('Space');await page.locator('[data-node][data-presenting=false]').waitFor();assert.equal(await page.locator('[data-node]>.mj-hand [aria-pressed=true]').count(),0);assert.deepEqual(errors,[]);logs.push({browser:'chromium',motion:true,skipConsumed:true,backgroundPaused:true,video:'artifacts/story/motion'});await context.close();
}
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:!(name==='webkit'&&process.env.MAHJONG_WEBKIT_HEADED==='1')});try{await layouts(browser,name);await journey(browser,name+'-a',false,name==='webkit',name==='webkit'?'opponent':'you');await journey(browser,name+'-b',true,name==='chromium','draw');if(name==='chromium')await motion(browser);}finally{await browser.close();}
}
await writeFile('artifacts/story/browser-verification.json',JSON.stringify({at:new Date().toISOString(),base,simulated:true,realDevice:false,windowsWebkitAudioFixture:process.platform==='win32',logs},null,2));console.log(JSON.stringify(logs));
