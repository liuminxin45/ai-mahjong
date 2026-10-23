import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const ids=['table','notebook','tea','door','present'],files=[];
await mkdir('assets/story/web',{recursive:true});
for(const id of ids)for(const width of [960,1600]){
  const data=await sharp('assets/story/original/'+id+'.png').resize({width,withoutEnlargement:true}).webp({quality:62,effort:6}).toBuffer();
  const sha256=createHash('sha256').update(data).digest('hex'),file=`${id}-${width}-${sha256.slice(0,12)}.webp`;
  await writeFile('assets/story/web/'+file,data);files.push({id,width,file,sha256,bytes:data.length,mime:'image/webp'});
}
const version=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);
const manifest={version,author:'OpenAI imagegen; original illustrations for 未完的牌谱',direction:'Warm ivory watercolor, pencil, sparse everyday objects, abstract romantic storybook. No copied game assets.',files};
await writeFile('assets/story/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile('src/story/scenery-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version,bytes960:files.filter(f=>f.width===960).reduce((n,f)=>n+f.bytes,0),bytes1600:files.filter(f=>f.width===1600).reduce((n,f)=>n+f.bytes,0)}));
