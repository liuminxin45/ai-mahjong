import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const levels=[1,2,3,4],results=[];
async function worker(){while(levels.length){const level=levels.shift();const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','scripts/verify-decisions.ts','--exact','--level='+level],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>resolve(code));});if(status!==0)throw Error('Independent verification failed for stage '+level);results.push(JSON.parse(await readFile('artifacts/decision-bank-verification-level'+level+'.json','utf8')));}}
await Promise.all([worker(),worker()]);
if(results.reduce((n,r)=>n+r.verified,0)!==332)throw Error('Independent coverage is incomplete');
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/decision-bank-verification.json',JSON.stringify({questions:332,exact:true,verified:332,stages:results.sort((a,b)=>a.level-b.level),at:new Date().toISOString()}));
console.log('All 332 decision questions independently verified across four stages.');
