import manifest from './scenery-manifest.json' with {type:'json'};
export const sceneryVersion=manifest.version;
export const sceneryFiles=manifest.files;
const prepared=new Map<string,string>();
export function registerScenery(id:string,blob:Blob){if(!prepared.has(id))prepared.set(id,URL.createObjectURL(blob));}
export function sceneryUrl(id:string){return prepared.get(id);}
export function sceneryWidth(){return typeof window!=='undefined'&&window.innerWidth*window.devicePixelRatio>960?1600:960;}
export function sceneryBase(tileBase:string){return tileBase.replace(/\/tiles(?:\/[^/]*)?\/?$/,'')+'/scenes/'+sceneryVersion;}
export async function decodeScenery(){await Promise.all([...prepared.values()].map(url=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>img.decode().then(resolve,reject);img.onerror=()=>reject(Error('这一页还没展开。'));img.src=url;})));}
