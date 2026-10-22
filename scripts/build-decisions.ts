import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { analyze, countsOf, sorted, TILES, type HandContext, type TileId, type FixedSet } from '../src/engine/index.js';
import { solveDecision, remainingBag, DECISION_MODEL } from '../src/decision/solver.js';
import { skills, DECISION_VERSION, type SkillId } from '../src/decision/curriculum.js';
import { structure } from '../src/training/questions.js';
import type { DecisionQuestion } from '../src/decision/questions.js';
import { finishExample } from '../src/decision/example.js';

const published = JSON.parse(readFileSync('src/decision/bank.json','utf8')) as DecisionQuestion[];
if(published.length){console.log('题库 '+DECISION_VERSION+' 已固定，禁止原地重写。请使用 decision:verify；新增题目须建立新版本并保留旧题注册。');process.exit(0);}

const checkpoint = 'work/decision-build.json';
const saved = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, 'utf8')) : { state: 473891, records: [] };
let state: number = saved.state;
const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tile = (n: number, suit = pick(['p', 's'])) => (n + suit) as TileId;
const sequence = (start: number, suit: string) => [tile(start, suit), tile(start + 1, suit), tile(start + 2, suit)];
const meld = (suit?: string) => random() < .18 ? Array<TileId>(3).fill(tile(1 + Math.floor(random() * 9), suit)) : sequence(1 + Math.floor(random() * 7), suit ?? pick(['p', 's']));
const link = (kind: string) => { const s = pick(['p', 's']); const n = kind === 'edge' ? pick([1, 8]) : kind === 'closed' ? 1 + Math.floor(random() * 7) : 2 + Math.floor(random() * 6); return [tile(n, s), tile(n + (kind === 'closed' ? 2 : 1), s)]; };
const rows: SkillId[][] = [['loose','edge','closed','open','pair','count'],['overlap','count','visible','dead','open','closed'],['seven','flush','pungs','root','fixed','visible'],['cap','tradeoff','overlap','seven','flush','root']];
const records: DecisionQuestion[] = saved.records, seen = new Set(records.map(q => q.family));
for (let level = 1; level <= 4; level++) for (const pool of ['practice','transfer','example'] as const) {
  const target = pool === 'practice' ? 60 : pool === 'transfer' ? 20 : 3;
  let count = records.filter(q => q.level === level && q.pool === pool).length, tries = 0;
  while (count < target) {
    if (++tries > 30000) throw new Error('Unable to fill decision coverage: ' + level + ':' + pool + ':' + count);
    const skill = rows[level - 1][count % 6], groups: TileId[][] = []; let hand: TileId[] = [], fixedSets: FixedSet[] = [];
    const pair = () => Array<TileId>(2).fill(pick(TILES));
    const base = () => { for (let j = 0; j < 3; j++) groups.push(meld()); groups.push(pair(), [...link(skill), pick(TILES)]); return groups.flat(); };
    if (level === 1) {
      const blocks = shuffle([sequence(1,'p'),sequence(4,'p'),sequence(7,'p'),sequence(1,'s'),sequence(4,'s'),sequence(7,'s')]); groups.push(...blocks.slice(0, 3));
      groups.push(pair()); groups.push(skill === 'pair' ? [...pair(),pick(TILES)] : [...link(skill), pick(TILES)]); hand = groups.flat();
    } else if (skill === 'seven' || skill === 'root' || skill === 'cap') {
      const candidates = shuffle(skill === 'cap' ? TILES.filter(t => t[1] === 'p') : TILES);
      if (skill === 'seven') { groups.push(...candidates.slice(0,5).map(t => [t,t]), candidates.slice(5,9)); }
      else groups.push(Array<TileId>(4).fill(candidates[0]),...candidates.slice(1,5).map(t => [t,t]),candidates.slice(5,7));
      hand = groups.flat();
    } else if (skill === 'flush') {
      const suit = pick(['p','s']); for (let j=0;j<3;j++) groups.push(meld(suit)); groups.push(Array<TileId>(2).fill(tile(1+Math.floor(random()*9),suit)),shuffle(TILES.filter(t=>t[1]!==suit)).slice(0,3)); hand=groups.flat();
    } else if (skill === 'pungs') { const ts=shuffle(TILES);groups.push(...ts.slice(0,3).map(t=>[t,t,t]),...ts.slice(3,5).map(t=>[t,t]),[ts[5]]);hand=groups.flat(); }
    else if (skill === 'fixed') { const ts=shuffle(TILES),size=pick([1,2,4]);fixedSets=ts.slice(0,size).map(t=>({kind:random()<.3?'quad':'triplet',tile:t}));for(let j=0;j<3-size;j++)groups.push(meld());if(size===4)groups.push([ts[5],ts[6]]);else groups.push(pair(),[...link('open'),pick(TILES)]);hand=groups.flat(); }
    else if (level === 2 || skill === 'overlap' || skill === 'tradeoff') { groups.push(meld(),meld(),link('open'),link('closed'),link('edge'),pair()); hand=groups.flat(); }
    else hand=base();
    const context: HandContext = {hand:sorted(hand),...(fixedSets.length?{fixedSets}:{})};
    if (skill === 'visible' || skill === 'dead') {
      const own=countsOf([...hand,...fixedSets.flatMap(s=>Array<TileId>(s.kind==='quad'?4:3).fill(s.tile))]),visible:Partial<Record<TileId,number>>={};
      for(const t of shuffle(TILES).slice(0,skill==='dead'?6:4)){const i=TILES.indexOf(t),n=4-own[i];if(n>0)visible[t]=skill==='dead'?n:1+Math.floor(random()*n);}context.visible=visible;
    }
    const counts=countsOf(hand),isolated=hand.filter(t=>counts[TILES.indexOf(t)]===1&&!hand.some(x=>x!==t&&x[1]===t[1]&&Math.abs(Number(x[0])-Number(t[0]))<=2));
    if(level===1&&(counts.some(n=>n>2)||counts.filter(n=>n===2).length>(skill==='pair'?2:1)||skill==='loose'&&!isolated.length))continue;
    let result: ReturnType<typeof analyze>;try{result=analyze(context);}catch{continue;}
    if(result.shanten<0 || level===1&&result.discards[0].shanten!==0)continue;
    const family=structure(context);if(seen.has(family))continue;
    const deep=level===4&&(pool!=='example'&&count%3===0 || pool==='example'&&count===2);
    const horizon=deep?4+(count%3===0?Math.floor(count/3)%3:2):level===1?1:level===4&&skill==='tradeoff'?3:2;
    if(horizon===3&&countsOf(hand).some(n=>n===4))continue;
    const all=remainingBag(context);let bag=all;
    if(deep){const winning=shuffle([...new Set(result.discards.flatMap(d=>d.improvements.map(x=>x.tile)))]),types=[...winning.slice(0,2),...shuffle([...new Set(all)].filter(t=>!winning.slice(0,2).includes(t))).slice(0,2)];bag=sorted(shuffle(all.filter(t=>types.includes(t))).slice(0,horizon+2));}
    const model={version:DECISION_MODEL,kind:deep?'explicit' as const:'remaining' as const,bag,horizon};
    let certificate;try{certificate=solveDecision(context,model,deep?100000:1000000);}catch{continue;}
    if(certificate.options.every(o=>o.value.score==='0')||certificate.accepted.length===certificate.options.length)continue;
    if(level===1&&skill==='loose'&&(certificate.accepted.length!==1||!isolated.includes(certificate.accepted[0])))continue;
    const id=DECISION_VERSION+':'+level+':'+pool+':'+String(count+1).padStart(2,'0');
    const shape={normal:result.normal,sevenPairs:result.sevenPairs,shanten:result.shanten,discards:result.discards};
    const payload={id,level,skill,pool,family,context,model,certificate,note:skills[skill].tip,groups,shape};
    const finish=finishExample(payload),teaching={...payload,...(finish?{finish}:{})};
    records.push({...teaching,hash:createHash('sha256').update(JSON.stringify(teaching)).digest('hex')});seen.add(family);count++;
    writeFileSync(checkpoint,JSON.stringify({state,records}));
    if(count%5===0||count===target)process.stdout.write(level+' '+pool+' '+count+'/'+target+' ('+certificate.nodes+' states)\n');
  }
}
const poolOrder={practice:0,transfer:1,example:2};
records.sort((a,b)=>a.level-b.level||poolOrder[a.pool]-poolOrder[b.pool]||a.id.localeCompare(b.id));
writeFileSync('src/decision/bank.json',JSON.stringify(records)+'\n');
console.log('Published '+records.length+' structurally distinct decision questions.');
