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
const audioCommit=(await readFile('src/story/audio-source.ts','utf8')).match(/[a-f0-9]{40}/)[0];
const scenery=JSON.parse(await readFile('assets/story/manifest.json','utf8'));
await writeFile('lib/build-info.json',JSON.stringify({sourceCommit,packageVersion:manifest.version,engineVersion:'record-world-1',contentVersion:'sibling-record-1',snapshotVersion:7,reportVersion:5,artworkVersion:'7522fdb84290ee3c',sceneryVersion:scenery.version,audioCommit})+'\n');
