import audioManifest from './audio-manifest.json' with { type: 'json' };
import tileManifest from './tile-manifest.json' with { type: 'json' };
import { AUDIO_COMMIT } from './audio-source.js';
import { artworkSize, preloadTiles, registerTileImage } from '../artwork.js';
import {sceneryFiles,sceneryWidth,sceneryBase,registerScenery,decodeScenery} from './scenery.js';
import journeyArt from '../journey/scenery-manifest.json' with {type:'json'};
export type AudioAsset={id:string;path:string;sha256:string;bytes:number;duration:number;mime:string;kind:string;title:string;author:string;license:string;licenseUrl:string;source:string;sourcePage?:string;modifications:string};
export const audioAssets=audioManifest.files as AudioAsset[];
export type Preparation={phase:'checking'|'downloading'|'preparing'|'ready'|'failed';loaded:number;total:number;temporary:boolean;error?:string};
type Resource={id:string;url:string;sha256:string;bytes:number;mime:string;audio?:AudioAsset;tile?:string;scene?:string};
const mediaCache='neo-mahjong-media-v1';
async function prepareMedia(blob:Blob,duration:number){
  const player=new Audio(),url=URL.createObjectURL(blob);
  try{await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>finish(Error('声音准备超时，请重试。')),20000),finish=(error?:Error)=>{clearTimeout(timeout);player.oncanplaythrough=null;player.onerror=null;error?reject(error):resolve();};player.preload='auto';player.oncanplaythrough=()=>finish(!Number.isFinite(player.duration)||Math.abs(player.duration-duration)>0.5?Error('声音长度不符，请重试。'):undefined);player.onerror=()=>finish(Error('浏览器暂不能播放这份声音。'));player.src=url;player.load();});}
  finally{player.removeAttribute('src');player.load();URL.revokeObjectURL(url);}
}
export class ResourceStore {
  readonly blobs=new Map<string,Blob>(); readonly effects=new Map<string,AudioBuffer>();
  context:AudioContext|null=null; temporary=false;
  private pending:Promise<void>|null=null;private listeners=new Set<(p:Preparation)=>void>();private state:Preparation={phase:'checking',loaded:0,total:0,temporary:false};
  constructor(readonly tileBase:string,readonly audioBase=`https://raw.githubusercontent.com/liuminxin45/ai-mahjong/${AUDIO_COMMIT}/`,readonly fetcher:typeof fetch=(input,init)=>fetch(input,init),readonly edition:'legacy'|'journey'='legacy'){}
  subscribe(fn:(p:Preparation)=>void){this.listeners.add(fn);fn(this.state);return()=>{this.listeners.delete(fn);};}
  private update(p:Partial<Preparation>){this.state={...this.state,...p,temporary:this.temporary};for(const listener of this.listeners)listener(this.state);}
  prepare(){if(this.pending)return this.pending;this.pending=this.load().catch(e=>{this.pending=null;this.update({phase:'failed',error:e instanceof Error?e.message:'资源还没到齐。'});throw e;});return this.pending;}
  private async load(){
    const tiles=tileManifest.filter(t=>t.size===artworkSize()),resources:Resource[]=[...audioAssets.map(a=>({id:a.id,url:this.audioBase+a.path,sha256:a.sha256,bytes:a.bytes,mime:a.mime,audio:a})),...tiles.map(t=>({id:'tile:'+t.id,url:this.tileBase+'/'+t.file,sha256:t.sha256,bytes:t.bytes,mime:'image/webp',tile:t.id}))];
    const art=this.edition==='journey'?journeyArt.files as {id:string;width:number;category:string;file:string;sha256:string;bytes:number;mime:string}[]:sceneryFiles;
    const base=this.edition==='journey'?this.tileBase.replace(/\/tiles(?:\/[^/]*)?\/?$/,'')+'/journey/'+journeyArt.version:sceneryBase(this.tileBase);
    resources.push(...art.filter(f=>f.width===('category' in f&&f.category==='portrait'?(sceneryWidth()===1600?768:384):sceneryWidth())).map(f=>({id:'scene:'+f.id,url:base+'/'+f.file,sha256:f.sha256,bytes:f.bytes,mime:f.mime,scene:f.id})));
    const total=resources.reduce((n,r)=>n+r.bytes,0),done=new Map<string,number>();this.update({phase:'checking',loaded:0,total,error:undefined});
    const batchAbort=new AbortController();let cache:Cache|undefined;try{cache=await caches.open(mediaCache);}catch{this.temporary=true;}
    const emit=()=>this.update({loaded:[...done.values()].reduce((a,b)=>a+b,0)});
    const obtain=async(r:Resource)=>{
      const cacheKey=new URL('/__mahjong-resource/'+r.sha256,location.origin).href;let bytes:ArrayBuffer|undefined=await this.blobs.get(r.id)?.arrayBuffer();
      try{if(!bytes){const saved=await cache?.match(cacheKey);if(saved)bytes=await saved.arrayBuffer();}}catch{this.temporary=true;}
      const valid=async(b:ArrayBuffer)=>b.byteLength===r.bytes&&[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')===r.sha256;
      if(bytes&&!await valid(bytes)){try{await cache?.delete(cacheKey);}catch{this.temporary=true;}bytes=undefined;}
      if(!bytes){
        this.update({phase:'downloading'});const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
        try{const response=await this.fetcher(r.url,{mode:'cors',credentials:'omit',signal:AbortSignal.any([controller.signal,batchAbort.signal])});if(!response.ok)throw Error('资源没有到齐，请重试。');
          const reader=response.body?.getReader();if(!reader)bytes=await response.arrayBuffer();else{const chunks:Uint8Array[]=[];let length=0;while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);length+=part.value.length;if(length>r.bytes)throw Error('资源大小不符，请重试。');done.set(r.id,length);emit();}const joined=new Uint8Array(length);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length;}bytes=joined.buffer;}
          if(!await valid(bytes))throw Error('资源校验没有通过，请重试。');
          try{await cache?.put(cacheKey,new Response(bytes.slice(0),{headers:{'Content-Type':r.mime}}));}catch{this.temporary=true;}
        }finally{clearTimeout(timeout);}
      }
      this.blobs.set(r.id,new Blob([bytes],{type:r.mime}));done.set(r.id,r.bytes);emit();
      if(r.tile)registerTileImage(r.url,this.blobs.get(r.id)!);
      if(r.scene)registerScenery(r.scene,this.blobs.get(r.id)!);
    };
    let index=0;const workers=await Promise.allSettled(Array.from({length:3},async()=>{while(index<resources.length&&!batchAbort.signal.aborted)try{await obtain(resources[index++]);}catch(e){batchAbort.abort();throw e;}}));const failed=workers.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
    this.update({phase:'preparing',loaded:total});
    const AudioCtor=globalThis.AudioContext??(globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(AudioCtor)this.context??=new AudioCtor();
    for(const asset of audioAssets){if(this.context){const buffer=await this.context.decodeAudioData(await this.blobs.get(asset.id)!.arrayBuffer());if(!buffer.length||Math.abs(buffer.duration-asset.duration)>0.5)throw Error('声音准备没有完成，请重试。');if(asset.kind==='effect')this.effects.set(asset.id,buffer);}else await prepareMedia(this.blobs.get(asset.id)!,asset.duration);}
    await Promise.all([preloadTiles(this.tileBase,tiles.map(t=>t.id)),decodeScenery()]);this.update({phase:'ready'});
  }
}

export class AudioDirector {
  private players:HTMLAudioElement[]=[];private gains:GainNode[]=[];private urls=new Map<string,string>();private current='';private active=0;private events=new Set<string>();private muted=false;private volume=0.55;private thinking=false;private disposed=false;private started=false;private channel:BroadcastChannel|null=null;private token=crypto.randomUUID();
  private effectPlayers=new Map<string,HTMLAudioElement>();private fade:ReturnType<typeof setInterval>|undefined;private quiet=false;
  constructor(readonly resources:ResourceStore){try{const raw=JSON.parse(localStorage.getItem('neo-mahjong-sound')??'{}');this.muted=raw.muted===true;this.volume=typeof raw.volume==='number'?Math.max(0,Math.min(1,raw.volume)):0.55;}catch{}try{this.channel=new BroadcastChannel('neo-mahjong-audio');this.channel.onmessage=e=>{if(e.data!==this.token)this.pause();};}catch{}document.addEventListener('visibilitychange',this.visibility);}
  get preferences(){return {muted:this.muted,volume:this.volume};}
  async unlock(id?:string,silent=false){
    const context=this.resources.context;if(this.disposed)return;
    this.quiet=silent;if(id)this.current=id;
    const first=!this.players.length;this.current||='clear-waters';
    if(first)for(let i=0;i<2;i++){const player=new Audio();player.preload='auto';player.loop=true;if(context){const gain=context.createGain();gain.gain.value=0;context.createMediaElementSource(player).connect(gain).connect(context.destination);this.gains.push(gain);}else player.volume=0;this.players.push(player);}
    this.started=true;this.channel?.postMessage(this.token);
    try{
      // Both media elements are touched by the original gesture, including iOS WebKit.
      if(first){const blob=this.resources.blobs.get(this.current);if(blob){const url=URL.createObjectURL(blob);this.urls.set(this.current,url);for(const p of this.players)p.src=url;}const playback=this.players.map(p=>p.play());if(!context)for(const a of audioAssets.filter(a=>a.kind==='effect')){const p=new Audio(),url=URL.createObjectURL(this.resources.blobs.get(a.id)!);this.urls.set(a.id,url);p.src=url;p.volume=0;this.effectPlayers.set(a.id,p);playback.push(p.play());}await context?.resume();await Promise.allSettled(playback);this.players[1-this.active].pause();for(const p of this.effectPlayers.values())p.pause();}
      else{const playback=this.play(this.current,true);await context?.resume();await playback;}
      if(!this.disposed)await this.play(this.current,true);
    }catch{this.started=false;}
  }
  settings(muted:boolean,volume=this.volume){this.muted=muted;this.volume=Math.max(0,Math.min(1,volume));try{localStorage.setItem('neo-mahjong-sound',JSON.stringify({muted:this.muted,volume:this.volume}));}catch{}this.mix(0.15);}
  setThinking(value:boolean){this.thinking=value;this.mix(0.6);}
  silence(){this.quiet=true;const context=this.resources.context;if(!context){this.fadeMedia(0.35,true);return;}for(const gain of this.gains){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(gain.gain.value,context.currentTime);gain.gain.linearRampToValueAtTime(0,context.currentTime+0.35);}}
  private target(){return this.quiet||this.muted?0:this.volume*(this.thinking?0.34:0.65);}
  private fadeMedia(duration:number,silent=false){clearInterval(this.fade);const initial=this.players.map(p=>p.volume),start=performance.now();this.fade=setInterval(()=>{const ratio=Math.min(1,(performance.now()-start)/(duration*1000));this.players.forEach((p,i)=>{const to=!silent&&i===this.active?this.target():0;p.volume=Math.max(0,Math.min(1,initial[i]+(to-initial[i])*ratio));});if(ratio===1)clearInterval(this.fade);},16);}
  private mix(duration:number){const context=this.resources.context;if(!context){this.fadeMedia(duration);return;}for(let i=0;i<this.gains.length;i++){const gain=this.gains[i].gain;gain.cancelScheduledValues(context.currentTime);gain.setValueAtTime(gain.value,context.currentTime);gain.linearRampToValueAtTime(i===this.active?this.target():0,context.currentTime+duration);}}
  async play(id:string,force=false){if(this.disposed)return;const wasQuiet=this.quiet;if(!force)this.quiet=false;if(this.current===id&&!force&&!wasQuiet)return;this.current=id;if(!this.started||document.hidden)return;const blob=this.resources.blobs.get(id);if(!blob)return;let url=this.urls.get(id);if(!url){url=URL.createObjectURL(blob);this.urls.set(id,url);}const next=force?this.active:1-this.active,player=this.players[next];if(!player)return;if(player.src!==url){player.src=url;player.currentTime=0;}this.active=next;try{await player.play();this.mix(force?0.4:2);}catch{this.started=false;}}
  effect(id:string,event:string){if(this.disposed||this.muted||!this.started||document.hidden||this.events.has(event))return;this.events.add(event);if(this.events.size>500)this.events.delete(this.events.values().next().value!);const context=this.resources.context,buffer=this.resources.effects.get(id);if(!context){const p=this.effectPlayers.get(id);if(p){p.currentTime=0;p.volume=this.volume*0.6;void p.play().catch(()=>{});}return;}if(!buffer)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=this.volume*0.6;source.connect(gain).connect(context.destination);source.start();}
  pause(){clearInterval(this.fade);for(const player of [...this.players,...this.effectPlayers.values()])player.pause();void this.resources.context?.suspend().catch(()=>{});}
  private visibility=()=>{if(document.hidden)this.pause();else if(this.started){this.channel?.postMessage(this.token);void (this.resources.context?.resume()??Promise.resolve()).then(()=>this.players[this.active]?.play()).then(()=>this.mix(0.3)).catch(()=>{this.started=false;});}};
  dispose(){this.disposed=true;this.pause();document.removeEventListener('visibilitychange',this.visibility);this.channel?.close();for(const url of this.urls.values())URL.revokeObjectURL(url);this.urls.clear();[...this.players,...this.effectPlayers.values()].forEach(p=>{p.removeAttribute('src');p.load();});}
}
