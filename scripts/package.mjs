import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('lib',{recursive:true});
await cp('src/styles.css','lib/styles.css');
await cp('src/decision.css','lib/decision.css');
await cp('src/experience.css','lib/experience.css');
await cp('src/story.css','lib/story.css');
let sourceCommit=process.env.MAHJONG_SOURCE_COMMIT;
if(!sourceCommit)try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{sourceCommit='unversioned';}
const manifest=JSON.parse(await readFile('package.json','utf8'));
await writeFile('lib/build-info.json',JSON.stringify({sourceCommit,packageVersion:manifest.version,engineVersion:'record-world-1',contentVersion:'unfinished-record-1',snapshotVersion:6,reportVersion:5,artworkVersion:'7522fdb84290ee3c',audioCommit:'a4f4604cdeb77cb1d769e068e3e7c46fa714317a'})+'\n');
