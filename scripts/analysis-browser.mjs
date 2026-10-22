import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.MAHJONG_PREVIEW_URL||'http://127.0.0.1:5189',base=process.env.MAHJONG_ROUTE_BASE||'';
const expandAdvanced=async page=>{const summary=page.getByText('更多设置：碰杠、已见牌与牌谱',{exact:true});if(!await summary.evaluate(e=>e.parentElement.open))await summary.click();};
const url=origin+base+'/analysis',dir='artifacts/analysis-editor';await mkdir(dir,{recursive:true});const results=[];
for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch(),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);const editor=page.getByRole('region',{name:'手牌编辑器'}),picker=page.getByRole('group',{name:'添加手牌'});
 await picker.waitFor();assert.equal(await page.getByRole('textbox').count(),0,'Typing must be optional');
 assert.equal(await page.getByText('条 · 筒 · 学习与判断',{exact:true}).count(),0);assert.equal(await page.getByText('双花色 · 72张',{exact:false}).count(),0);
 assert.equal(await page.getByRole('button',{name:'设置',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'数据与设置',exact:true}).count(),1);
 for(let i=0;i<4;i++)await picker.getByRole('button',{name:'一筒',exact:true}).click();assert.equal(await picker.getByRole('button',{name:'一筒',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('alert').count(),0,'Incomplete hand must not show validation errors');
 await editor.locator('.mj-hand').first().getByRole('button',{name:'一筒',exact:true}).first().click();assert.equal(await picker.getByRole('button',{name:'一筒',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal(await picker.getByRole('button',{name:'一筒',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'清空手牌',exact:true}).click();
 await expandAdvanced(page);await page.getByRole('button',{name:'粘贴牌谱',exact:true}).click();await page.getByRole('textbox',{name:'手牌牌谱'}).fill('123万');await page.getByRole('button',{name:'应用手牌',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent==='粘贴牌谱');
 await page.getByRole('button',{name:'粘贴牌谱',exact:true}).click();await page.getByRole('textbox',{name:'手牌牌谱'}).fill('123456789筒12459条');await page.getByRole('button',{name:'应用手牌',exact:true}).click();await page.getByText('查看计算详情',{exact:true}).click();await page.getByRole('heading',{name:'舍牌比较',exact:true}).waitFor();
 assert.equal(await picker.locator('button:enabled').count(),0);await page.getByText('向听、进张是什么意思？',{exact:true}).click();await page.getByText('向听记录离听牌的距离：',{exact:false}).waitFor();
 await editor.locator('.mj-hand').first().getByRole('button',{name:'九条',exact:true}).click();
 await expandAdvanced(page);await page.getByRole('tab',{name:'可见牌',exact:true}).click();const visible=page.getByRole('group',{name:'添加可见牌'});
 for(let i=0;i<3;i++)await visible.getByRole('button',{name:'二条',exact:true}).click();assert.equal(await visible.getByRole('button',{name:'二条',exact:true}).isDisabled(),true);
 await page.getByRole('group',{name:'已记录的可见牌'}).getByRole('button',{name:'二条',exact:true}).click();assert.equal(await visible.getByRole('button',{name:'二条',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'粘贴牌谱',exact:true}).click();await page.getByRole('textbox',{name:'手牌牌谱'}).fill('111234567筒1245条');await page.getByRole('button',{name:'应用手牌',exact:true}).click();await page.getByRole('tab',{name:'固定组合',exact:true}).click();assert.equal(await page.getByRole('tab',{name:'顺子',exact:true}).count(),0);await page.getByRole('group',{name:'选择组合牌面'}).getByRole('button',{name:'一筒',exact:true}).click();await page.getByRole('button',{name:'固定这组',exact:true}).click();
 await editor.getByText('10 / 11张 · 已固定1组',{exact:true}).waitFor();await page.getByRole('button',{name:'还原手牌',exact:true}).click();await editor.getByText('13 / 14张',{exact:true}).waitFor();
 await page.reload();await page.getByRole('group',{name:'添加手牌'}).waitFor();await editor.getByText('13 / 14张',{exact:true}).waitFor();await expandAdvanced(page);await page.getByRole('tab',{name:'可见牌',exact:true}).click();await page.getByRole('group',{name:'已记录的可见牌'}).getByText('已见2张',{exact:true}).waitFor();
 await page.getByRole('button',{name:'数据与设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 for(const theme of ['light','dark'])for(const width of [1920,1280,768,390,360,320]){
  await page.setViewportSize({width,height:width===1920?1080:width===1280?800:844});await page.evaluate(theme=>{localStorage.setItem('neo-mahjong-theme-v1',theme);localStorage.setItem('theme',theme)},theme);await page.goto(url);await page.getByRole('group',{name:'添加手牌'}).waitFor();
  await expandAdvanced(page);
  for(const target of ['手牌','固定组合','可见牌']){
   await page.getByRole('tab',{name:target,exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.mahjong-app img')].every(image=>image.complete&&image.naturalWidth));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${theme}/${width}/${target}: page overflow`);
   if(width<768){const buttons=await page.locator('.mj-picker-row button').all();for(const button of buttons){const b=await button.boundingBox();assert.ok(b.width>=44&&b.height>=44,`${width}px tile target must be >=44px`);}}
   if(width===1920||width===390||width===1280)await page.screenshot({path:`${dir}/${name}-${theme}-${width}-${target}.png`});results.push({browser:name,theme,width,target});
  }
 }
 await page.getByRole('button',{name:'切换导航',exact:true}).click();await page.getByRole('button',{name:'数据与设置',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await browser.close();
}
await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} editor viewport/theme probes passed; point-and-click editing, limits, undo, import, fixed groups, visible counts, persistence and settings verified.`);
