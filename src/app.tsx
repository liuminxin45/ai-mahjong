import { TrainingHome,DiscardPractice,LearningRoute,TrainingProgress } from './training-pages.js';
import { migrateTraining } from './training/core.js';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AIResponseProvider, Button, ChatAppSurface, ChatHeader, ChatWorkspace, DesktopProvider, Dialog, InlineNotice, RecordLink, Select, SidebarIcon, UIStringsProvider } from 'chatgpt-desktop-kit';
import { createCompetitionClient, createProfileClient, createTrainingClient, type TrainingClient, type ProfileClient } from './client.js';
import { emptyData, importData, LearningRepository, type LearningData } from './learning/storage.js';
import { LearningContext, AppLink } from './ui.js';

import { AnalysisPage } from './analysis-page.js';



import { GitHubLink } from './github-link.js';
import { AIActivity } from 'chatgpt-desktop-kit';

import type { CompetitionClient } from './learning/competition.js';
export { createCompetitionClient, createProfileClient, createTrainingClient } from './client.js';
export type MahjongAppProps={basePath?:string;assetsBaseUrl?:string;theme?:'light'|'dark'|'system';onThemeChange?:(theme:'light'|'dark'|'system')=>void;profileClient?:ProfileClient;trainingClient?:TrainingClient;competitionClient?:CompetitionClient;createWorker?:()=>Worker;exitUrl?:string};
export function MahjongApp({basePath='',assetsBaseUrl='/tiles',theme,onThemeChange,profileClient,trainingClient,competitionClient,createWorker,exitUrl='/works'}:MahjongAppProps){
  const repo=useRef(new LearningRepository());const [data,setData]=useState<LearningData>(emptyData),[ready,setReady]=useState(false),[notice,setNotice]=useState(''),[settings,setSettings]=useState(false),[clearing,setClearing]=useState(false),[sidebar,setSidebar]=useState(()=>typeof window!=='undefined'&&window.innerWidth>=768);
  const [localTheme,setLocalTheme]=useState<'light'|'dark'|'system'>(()=>{try{return (localStorage.getItem('neo-mahjong-theme-v1') as 'light'|'dark'|'system')||'system';}catch{return'system';}});
  const scroll=useRef<HTMLElement>(null);const file=useRef<HTMLInputElement>(null);const location=useLocation();const base=basePath.replace(/\/$/,'');
  const [epoch,setEpoch]=useState(0);
  const client=useMemo(()=>profileClient??createProfileClient(),[profileClient]);
  const training=useMemo(()=>trainingClient??createTrainingClient(),[trainingClient]);
  const competitions=useMemo(()=>competitionClient??createCompetitionClient(),[competitionClient]);
  useEffect(()=>{let active=true;repo.current.open().then(d=>{if(active){setData({...d,training:migrateTraining(d)});setReady(true);if(repo.current.temporary)setNotice('本地存储不可用，当前为临时练习。离开前请导出备份。');}else repo.current.close();});return()=>{active=false;repo.current.close();};},[]);
  useEffect(()=>{if(ready)void repo.current.save(data).catch(e=>setNotice(e.message));},[data,ready]);
  useEffect(()=>{if(window.innerWidth<768)setSidebar(false);if(scroll.current)scroll.current.scrollTop=0;},[location.pathname]);
  const themeChange=(v:string)=>{const next=v as 'light'|'dark'|'system';if(onThemeChange)onThemeChange(next);else{setLocalTheme(next);try{localStorage.setItem('neo-mahjong-theme-v1',next);}catch{}}};
  const update=(fn:(d:LearningData)=>LearningData)=>setData(fn);
  const exportBackup=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`麻将研习-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const navigation=[['','练习'],['learn','学习路线'],['progress','我的进步']];
  return <DesktopProvider className="mahjong-app" theme={theme??localTheme} onThemeChange={t=>themeChange(t)}><UIStringsProvider locale="zh-CN" translate={key=>key}><AIResponseProvider><LearningContext.Provider value={{data,update,assets:assetsBaseUrl,profileClient:client,competitionClient:competitions,trainingClient:training,base,repository:repo.current,notice:setNotice}}><ChatAppSurface className="mj-workspace" style={{'--desktop-size-chat-sidebar':'248px'} as CSSProperties}><ChatWorkspace sidebarOpen={sidebar} onSidebarOpenChange={setSidebar} sidebarLabel="学习工具导航" closeSidebarLabel="关闭导航" sidebar={<div className="mj-sidebar"><nav aria-label="学习工具">{navigation.map(([path,label])=><AppLink key={path} to={`${base}/${path}`} className={(path?location.pathname===`${base}/${path}`||location.pathname.startsWith(`${base}/${path}/`):location.pathname.replace(/\/$/,'')===base||location.pathname===`${base}/practice`)?'mj-nav-active':''}>{label}</AppLink>)}</nav><nav className="mj-sidebar-bottom" aria-label="项目与设置"><AppLink to={`${base}/analysis`}>摆一手自己的牌</AppLink><Button variant="ghost" layout="row" onClick={()=>setSettings(true)}>数据与设置</Button><RecordLink actionId="mahjong.exit" href={exitUrl}>← 返回造物</RecordLink></nav></div>}
    header={<ChatHeader presentation="bar" title={<span className="mj-app-title"><span>麻将研习</span><GitHubLink/></span>} leading={<Button icon={<SidebarIcon size={18}/>} iconOnly aria-label="切换导航" variant="ghost" onClick={()=>setSidebar(v=>!v)}/>}/>}
    ><main ref={scroll} className="mj-scroll" id="mahjong-main">{notice&&<div className="mj-global-notice"><InlineNotice title={notice} actions={<Button size="sm" onClick={()=>setNotice('')}>关闭提示</Button>}/></div>}{ready?<Routes key={epoch}><Route index element={<TrainingHome/>}/><Route path="practice" element={<DiscardPractice/>}/><Route path="learn" element={<LearningRoute/>}/><Route path="learn/:topicId" element={<LearningRoute/>}/><Route path="progress" element={<TrainingProgress/>}/><Route path="analysis" element={<AnalysisPage createWorker={createWorker}/>}/><Route path="manual/:lessonId" element={<LearningRoute/>}/><Route path="manual" element={<Navigate to={base+'/learn'} replace/>}/><Route path="profile" element={<Navigate to={base+'/progress'} replace/>}/><Route path="review" element={<Navigate to={base+'/progress'} replace/>}/><Route path="*" element={<Navigate to={base+'/'} replace/>}/></Routes>:<div className="mj-initial-loading" role="status"><AIActivity role="presentation">正在读取记录…</AIActivity></div>}</main></ChatWorkspace></ChatAppSurface>
    <Dialog open={settings} onClose={()=>setSettings(false)} title="数据与设置" description="练习记录保存在当前浏览器，可导出备份。"><div className="mj-settings"><label className="mj-field"><span>主题</span><Select aria-label="主题" value={theme??localTheme} onValueChange={themeChange} options={[{value:'system',label:'跟随系统'},{value:'light',label:'浅色'},{value:'dark',label:'深色'}]}/></label><p>备份包含练习、错题和课程进度，导入会替换当前记录。</p><div className="mj-actions"><Button onClick={exportBackup}>导出备份</Button><Button onClick={()=>file.current?.click()}>导入备份</Button></div><input hidden ref={file} type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>50000000)throw new Error('备份文件不能超过50MB。');const imported=importData(JSON.parse(await f.text()));setData({...imported,training:migrateTraining(imported)});setEpoch(v=>v+1);setNotice('备份已导入。');}catch(e){setNotice((e as Error).message);}e.target.value='';}}/><Button variant="danger" onClick={()=>setClearing(true)}>清空本地学习记录</Button><p className="mj-muted">清空本地不会删除已提交的云端学习小结。请先在我的进步页删除相应报告。</p></div></Dialog>
    <Dialog open={clearing} onClose={()=>setClearing(false)} title="清空本地学习记录？" description="将移除当前浏览器的练习、错题、课程进度和报告副本。此操作不影响旧版麻将数据。" footer={<><Button onClick={()=>setClearing(false)}>取消</Button><Button variant="danger" onClick={()=>{setData(emptyData());setEpoch(v=>v+1);setClearing(false);setSettings(false);setNotice('本地学习记录已清空。');}}>清空记录</Button></>}/>
  </LearningContext.Provider></AIResponseProvider></UIStringsProvider></DesktopProvider>;
}


