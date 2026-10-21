import { cp, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('lib',{recursive:true});
await cp('src/styles.css','lib/styles.css');
let sourceCommit=process.env.MAHJONG_SOURCE_COMMIT;
if(!sourceCommit)try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{sourceCommit='unversioned';}
await writeFile('lib/build-info.json',JSON.stringify({sourceCommit,packageVersion:'1.0.0',engineVersion:'1.0.1'})+'\n');
