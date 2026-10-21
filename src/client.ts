import { packSnapshot, type LearningProfile, type LearningSnapshot } from './learning/index.js';
export type ProfileReport={reportId:string;profile:LearningProfile;at:string};
export type ProfileClient={generate(snapshot:LearningSnapshot):Promise<ProfileReport>;read(id:string):Promise<ProfileReport>;remove(id:string):Promise<void>};
export function createProfileClient(base='/api/assistant/mahjong'):ProfileClient{
  const request=async(path:string,method:string,body?:unknown)=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);
    try{const r=await fetch(base+path,{method,credentials:'same-origin',signal:controller.signal,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error||'画像服务暂时不可用。');return data;}
    catch(e){if(controller.signal.aborted)throw new Error('画像生成超时，练习记录仍保存在本地。');throw e;}finally{clearTimeout(timeout);}
  };
  return {generate:s=>request('/profile','POST',{snapshot:packSnapshot(s)}),read:id=>request(`/profile/${encodeURIComponent(id)}`,'GET'),remove:async id=>{await request(`/profile/${encodeURIComponent(id)}`,'DELETE');}};
}
