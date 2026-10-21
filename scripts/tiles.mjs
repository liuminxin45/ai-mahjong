import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('assets/tiles/web',{recursive:true});
const manifest=[];const files=(await readdir('assets/tiles/source')).filter(x=>x.endsWith('.png')).sort();
for(const file of files){const id=file.slice(0,-4),source=await readFile('assets/tiles/source/'+file),meta=await sharp(source).metadata();const variants=[];
 for(const width of [96,192,384]){const output=`${id}-${width}.webp`;const info=await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:85,alphaQuality:100}).toFile('assets/tiles/web/'+output);variants.push({width,file:output,bytes:info.size});}
 manifest.push({id,source:file,sha256:createHash('sha256').update(source).digest('hex'),width:meta.width,height:meta.height,alpha:meta.hasAlpha,variants});
}
await writeFile('assets/tiles/manifest.json',JSON.stringify({generator:'imagegen',version:1,tiles:manifest},null,2)+'\n');
const cells=await Promise.all(files.map(async(file,i)=>({input:await sharp('assets/tiles/source/'+file).resize(120,160,{fit:'contain',background:{r:45,g:45,b:45,alpha:1}}).png().toBuffer(),left:(i%10)*132+6,top:Math.floor(i/10)*180+8})));
await mkdir('artifacts',{recursive:true});await sharp({create:{width:1320,height:360,channels:4,background:'#2d2d2d'}}).composite(cells).png().toFile('artifacts/tiles-contact.png');
console.log(JSON.stringify({tiles:manifest.length,firstScreenBytes:manifest.filter(t=>/^[1-9][ps]$/.test(t.id)).reduce((n,t)=>n+t.variants[0].bytes,0)}));
