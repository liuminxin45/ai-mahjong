import { cp, mkdir, access } from 'node:fs/promises';
await mkdir('public/tiles',{recursive:true});
try { await access('assets/tiles/web'); await cp('assets/tiles/web','public/tiles',{recursive:true}); }
catch { console.warn('牌图尚未生成：界面将显示可读牌名。'); }
