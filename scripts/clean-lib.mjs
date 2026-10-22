import {rm,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),target=path.resolve(root,'lib');
if(path.dirname(target)!==path.resolve(root)||path.basename(target)!=='lib')throw Error('Unexpected build output path');
try{if((await lstat(target)).isSymbolicLink())throw Error('Build output must not be a symlink');}catch(e){if(e.code!=='ENOENT')throw e;}
await rm(target,{recursive:true,force:true});
