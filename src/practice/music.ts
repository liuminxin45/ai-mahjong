import manifest from '../story/audio-manifest.json' with {type:'json'};
import {AUDIO_COMMIT} from '../story/audio-source.js';
const track=manifest.files.find(f=>f.id==='clear-waters')!;
let pending:Promise<Blob>|undefined;
async function music(){
 if(!pending)pending=(async()=>{let cache:Cache|undefined;try{cache=await caches.open('neo-mahjong-media-v1');}catch{/* memory only */}const key=new URL('/__mahjong-resource/'+track.sha256,location.origin).href;
 let blob=await (await cache?.match(key))?.blob();const valid=async(b:Blob)=>b.size===track.bytes&&[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('')===track.sha256;
 if(!blob||!await valid(blob)){const response=await fetch(`https://raw.githubusercontent.com/liuminxin45/ai-mahjong/${AUDIO_COMMIT}/${track.path}`,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('音乐暂时没有连上，练习可以继续。');blob=await response.blob();if(!await valid(blob))throw Error('音乐暂时没有准备好，请重试。');try{await cache?.put(key,new Response(blob));}catch{/* memory only */}}return blob;
 })().catch(e=>{pending=undefined;throw e;});return pending;
}
export class PracticeMusic{
 private player:HTMLAudioElement|null=null;private url='';private enabled=false;private channel:BroadcastChannel|null=null;private disposed=false;
 private hidden=()=>{if(document.hidden)this.player?.pause();else if(this.enabled)void this.player?.play().catch(()=>this.stop());};
 constructor(private changed:(on:boolean)=>void){if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel('neo-mahjong-practice-audio');this.channel.onmessage=()=>this.stop();}document.addEventListener('visibilitychange',this.hidden);}
 async start(){this.enabled=true;this.changed(true);this.channel?.postMessage('playing');try{if(!this.player){this.player=new Audio();this.player.loop=true;this.player.volume=.16;}const blob=await music();if(!this.enabled||this.disposed)return;if(!this.url){this.url=URL.createObjectURL(blob);this.player.src=this.url;}if(!document.hidden)await this.player.play();}catch(e){this.stop();throw e;}}
 stop(){this.enabled=false;this.changed(false);this.player?.pause();}
 dispose(){this.disposed=true;this.stop();document.removeEventListener('visibilitychange',this.hidden);this.channel?.close();if(this.player){this.player.removeAttribute('src');this.player.load();}if(this.url)URL.revokeObjectURL(this.url);}
}
export const musicCredit=track;
