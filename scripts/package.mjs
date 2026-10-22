import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('lib',{recursive:true});
await cp('src/styles.css','lib/styles.css');
await cp('src/decision.css','lib/decision.css');
let sourceCommit=process.env.MAHJONG_SOURCE_COMMIT;
if(!sourceCommit)try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{sourceCommit='unversioned';}
const manifest=JSON.parse(await readFile('package.json','utf8'));
await writeFile('lib/build-info.json',JSON.stringify({sourceCommit,packageVersion:manifest.version,engineVersion:'finite-discard-1',contentVersion:'discard-value-1',snapshotVersion:5})+'\n');
