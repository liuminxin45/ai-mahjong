import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { competitionPapers,publicQuestion,exercise,answers,grade,practiceQuestions,MODE_NAMES } from '../lib/learning/index.js';
import { tileName } from '../lib/engine/index.js';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5188',base=process.env.MAHJONG_ROUTE_BASE||'';
const widths=(process.env.MAHJONG_UPGRADE_WIDTHS||'1920,1280,768,390,360,320').split(',').map(Number);
const dir=process.env.MAHJONG_UPGRADE_ARTIFACTS||'artifacts/upgrade-browser';await mkdir(dir,{recursive:true});const results=[];
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch();
 for(const theme of ['light','dark'])for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:width===320?568:900},hasTouch:width<768}),page=await context.newPage(),errors=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('neo-mahjong-theme-v1',theme);},theme);
  let run=null;const view=()=>{const v={runId:run.id,paperId:run.paper.id,startedAt:new Date(run.started).toISOString(),expiresAt:new Date(run.started+86400000).toISOString(),serverNow:new Date().toISOString(),index:run.items.length,status:run.items.length===20?'complete':'active'};
   if(v.status==='active')v.question=publicQuestion(exercise(run.paper.refs[v.index]));else{v.score=run.items.filter(a=>a.correct).length*5;v.durationMs=Date.now()-run.started;v.attempts=run.items;}return v;};
  await page.route('**/api/assistant/mahjong/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/assistant/mahjong','');let output={};
   if(path==='/session')output={cookieConfirmed:true};
   else if(path==='/competitions')output={papers:competitionPapers};
   else if(path.endsWith('/leaderboard')){const done=run?.items.length===20;const row=done?{rank:1,publicId:'public-preview',alias:'牌友 PREVIEW',score:100,durationMs:Date.now()-run.started,achievedAt:new Date().toISOString(),mine:true}:null;output={entries:row?[row]:[],mine:row,total:row?1:0,archived:false};}
   else if(path.endsWith('/runs')){const paper=competitionPapers.find(p=>path.includes(p.id));run={id:crypto.randomUUID(),paper,started:Date.now()-1500,items:[]};output=view();}
   else if(path.endsWith('/answers')){const body=req.postDataJSON(),q=exercise(run.paper.refs[run.items.length]);assert.equal(body.index,run.items.length);run.items.push({id:`${run.id}-${String(body.index).padStart(2,'0')}`,ref:q.ref,answer:body.answer,correct:grade(q,body.answer),assisted:false,review:false,durationMs:0,at:new Date().toISOString(),exerciseId:q.id,source:'competition',competitionRunId:run.id});output=view();}
   else if(path.includes('/competition-runs/'))output=view();
   else if(path==='/profile'){uploads.push(req.postDataJSON());output={reportId:crypto.randomUUID(),at:new Date().toISOString(),profile:{summary:'预览报告：使用完整历史的分层统计。',strengths:[],weaknesses:[],uncertainties:['这是一份浏览器测试报告'],plan:Array.from({length:7},(_,i)=>({day:i+1,lessonId:'lesson-07',mode:'discard',task:'验证不同牌形的向听。'}))}};}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(output)});
  });
  const checkPage=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${engine}/${theme}/${width}: page overflow`);assert.deepEqual(errors,[]);};
  await page.goto(origin+base+'/practice');await page.getByRole('heading',{name:'专项练习',exact:true}).waitFor();await page.getByRole('combobox',{name:'练习难度'}).waitFor();assert.ok(await page.locator('.mj-public-groups .mj-hand').count()>0);await checkPage();
  const q=practiceQuestions('discard',1)[0];await page.locator('.mj-question > .mj-hand').getByRole('button',{name:tileName(answers(q)[0]),exact:true}).first().click();await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('判断正确',{exact:true}).waitFor();
  await page.reload();await page.getByText('判断正确',{exact:true}).waitFor();
  await page.goto(origin+base+'/practice?mode=discard&level=6');await page.locator('.mj-draw-bag').waitFor();const hard=practiceQuestions('discard',6)[0];await page.locator('.mj-question > .mj-hand').getByRole('button',{name:tileName(answers(hard)[0]),exact:true}).first().click();await page.getByRole('button',{name:'提交答案',exact:true}).click();await page.getByText('判断正确',{exact:true}).waitFor();await page.getByText('后续怎么选',{exact:true}).click();await checkPage();
  await page.goto(origin+base+'/practice?mode=discard&level=1&skill=discard.planning');await page.getByRole('heading',{name:'换一个难度继续',exact:true}).waitFor();await page.getByRole('button',{name:'大师',exact:true}).click();await page.locator('.mj-question').waitFor();await checkPage();
  await page.goto(origin+base+'/manual/lesson-17');await page.getByRole('heading',{name:'公开组合与题设',exact:true}).waitFor();assert.ok((await page.locator('main').innerText()).includes('不能吃牌'));await page.getByText('规则来源与工具约定',{exact:true}).click();await page.getByRole('link',{name:'MIL 四川麻将规则纲要',exact:true}).waitFor();await checkPage();
  await page.goto(origin+base+'/profile');await page.getByRole('heading',{name:'专项表现'}).waitFor();assert.equal(await page.getByRole('button',{name:'生成学习报告',exact:true}).isEnabled(),true);assert.equal(uploads.length,0);await checkPage();
  await page.goto(origin+base+'/quiz');await page.getByRole('heading',{name:'排位赛',exact:true}).waitFor();assert.ok(page.url().endsWith('/leaderboard'));await page.getByRole('button',{name:'开始排位',exact:true}).click();await page.getByRole('button',{name:'开始比赛',exact:true}).click();await page.getByRole('button',{name:'提交答案',exact:true}).waitFor();
  const full=(width===1280&&theme==='light')||(width===390&&theme==='dark');const count=full?20:2;
  for(let i=0;i<count;i++){
   const q=exercise(competitionPapers[0].refs[i]),expected=answers(q),multi=['waits','ukeire'].includes(q.ref.mode);
   if(q.metadata?.response==='judgment'){await page.getByRole('button',{name:expected.length?'题设足以保证':'信息不足，无法保证',exact:true}).click();}
   else if(multi){for(const tile of expected)await page.locator('.mj-palette').getByRole('button',{name:tileName(tile),exact:true}).click();}
   else await page.locator('.mj-question > .mj-hand').getByRole('button',{name:tileName(expected[0]),exact:true}).first().click();
   await page.getByRole('button',{name:i===19?'提交并交卷':'提交答案',exact:true}).click();
   if(i<19)await page.getByText(new RegExp(`· ${i+2}/20$`)).waitFor();
   if(i===0){await page.reload();await page.getByText('入门 · 2/20',{exact:true}).waitFor();assert.equal(await page.locator('button[aria-pressed="true"]').count(),0);}
  }
  if(full){await page.getByRole('heading',{name:'本次成绩 · 100分',exact:true}).waitFor();await page.getByText('最好成绩',{exact:true}).waitFor();assert.ok((await page.locator('main').innerText()).includes('本人'));}
  await checkPage();await page.screenshot({path:`${dir}/${engine}-${theme}-${width}.png`});results.push({engine,theme,width,practice:true,hell:true,manualSource:true,profile:true,legacyRedirect:true,serverResume:true,completedFullPaper:full});await context.close();
 }
 await browser.close();
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} upgrade browser cases passed; mocked competition transport, real scoring covered by database tests.`);
