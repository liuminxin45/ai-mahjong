import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const prompts=JSON.parse(await readFile('assets/journey/prompts.json','utf8')),files=[];
await mkdir('assets/journey/web',{recursive:true});
for(const p of prompts){const original='assets/journey/original/'+p.id+'.png',metadata=await sharp(original).metadata();if(p.transparent&&!metadata.hasAlpha)throw Error(p.id+' must preserve generated transparency');
 for(const width of p.transparent?[384,768]:[960,1600]){const data=await sharp(original).resize({width,withoutEnlargement:true}).webp({quality:p.transparent?76:64,effort:6}).toBuffer(),sha256=createHash('sha256').update(data).digest('hex'),file=`${p.id}-${width}-${sha256.slice(0,12)}.webp`;await writeFile('assets/journey/web/'+file,data);files.push({id:p.id,category:p.transparent?'portrait':'scene',width,file,sha256,bytes:data.length,mime:'image/webp'});}
}
const version=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16),manifest={version,author:'OpenAI imagegen',direction:'Original pencil and watercolor family story. Six spatial scenes and eight transparent poses. No copied game assets.',files};
for(const path of ['assets/journey/manifest.json','src/journey/scenery-manifest.json'])await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version,scenes:prompts.filter(p=>!p.transparent).length,portraits:prompts.filter(p=>p.transparent).length,bytesPhone:files.filter(f=>f.width===(f.category==='portrait'?384:960)).reduce((n,f)=>n+f.bytes,0)}));
