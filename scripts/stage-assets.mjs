import { cp, mkdir, access, readFile } from 'node:fs/promises';
const version=(await readFile('src/artwork.ts','utf8')).match(/ARTWORK_VERSION = '([a-f0-9]{16})'/)?.[1];
if(!version)throw Error('Missing artwork content version');
await mkdir('public/tiles',{recursive:true});
try { await access('assets/tiles/web'); await cp('assets/tiles/web','public/tiles',{recursive:true}); await cp('assets/tiles/web','public/tiles/'+version,{recursive:true}); }
catch { console.warn('牌图尚未生成：界面将显示可读牌名。'); }
const scenes=JSON.parse(await readFile('assets/story/manifest.json','utf8'));
await mkdir('public/scenes/'+scenes.version,{recursive:true});
await cp('assets/story/web','public/scenes/'+scenes.version,{recursive:true});
