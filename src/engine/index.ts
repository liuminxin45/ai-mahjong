export const RULES_VERSION = 'two-suits-1';
export const ENGINE_VERSION = '1.0.1';
export type TileId = `${1|2|3|4|5|6|7|8|9}${'p'|'s'}`;
export type FixedSet = { kind:'sequence'|'triplet'|'quad'; tile:TileId };
export type HandContext = { hand:TileId[]; fixedSets?:FixedSet[]; visible?:Partial<Record<TileId,number>>; rulesVersion?:string };
export type Improvement = { tile:TileId; remaining:number };
export type DiscardResult = { tile:TileId; shanten:number; ukeire:number; improvements:Improvement[]; best:boolean };
export type AnalysisResult = { normal:number; sevenPairs:number|null; shanten:number; waits:Improvement[]; improvements:Improvement[]; discards:DiscardResult[]; decomposition:TileId[][]|null };
export const TILES = Array.from({length:18},(_,i)=>`${i%9+1}${i<9?'p':'s'}` as TileId);
export const tileIndex = (t:TileId)=>TILES.indexOf(t);
export const tileName = (t:TileId)=>`${'一二三四五六七八九'[Number(t[0])-1]}${t[1]==='p'?'筒':'条'}`;
export const sorted = (tiles:TileId[])=>[...tiles].sort((a,b)=>tileIndex(a)-tileIndex(b));
export function parseHand(text:string):TileId[] {
  const source=text.replace(/\s/g,'');
  if (!/^(?:[1-9]+[ps])*$/.test(source)) throw new Error('只接受1至9与p（筒）、s（条），例如123p456s。');
  return [...source.matchAll(/([1-9]+)([ps])/g)].flatMap(m=>[...m[1]].map(n=>`${n}${m[2]}` as TileId));
}
export function formatHand(hand:TileId[]):string {
  return (['p','s'] as const).map(s=>sorted(hand).filter(t=>t[1]===s).map(t=>t[0]).join('')+(hand.some(t=>t[1]===s)?s:'')).join('');
}
export function countsOf(tiles:TileId[]):number[] {
  const counts=Array(18).fill(0);
  for(const t of tiles){const i=tileIndex(t);if(i<0)throw new Error(`未知牌种：${t}`);counts[i]++;}
  return counts;
}
export function setTiles(set:FixedSet):TileId[] {
  if(!set||!TILES.includes(set.tile)||!['sequence','triplet','quad'].includes(set.kind))throw new Error('固定组合不合法。');
  if(set.kind==='sequence'){
    if(Number(set.tile[0])>7)throw new Error('顺子的起始牌只能是一至七。');
    return [set.tile,`${Number(set.tile[0])+1}${set.tile[1]}` as TileId,`${Number(set.tile[0])+2}${set.tile[1]}` as TileId];
  }
  return Array(set.kind==='quad'?4:3).fill(set.tile);
}
export function validateContext(ctx:HandContext,complete=true):void {
  if(!ctx||!Array.isArray(ctx.hand))throw new Error('缺少手牌。');
  if(ctx.rulesVersion&&ctx.rulesVersion!==RULES_VERSION)throw new Error('规则版本不支持。');
  const sets=ctx.fixedSets??[];
  if(!Array.isArray(sets)||sets.length>4)throw new Error('固定组合最多四组。');
  const known=countsOf([...ctx.hand,...sets.flatMap(setTiles)]);
  for(const [key,value] of Object.entries(ctx.visible??{})){
    if(!TILES.includes(key as TileId)||!Number.isInteger(value)||value!<0||value!>4)throw new Error('可见牌数量必须是0至4的整数。');
    known[tileIndex(key as TileId)]+=value!;
  }
  known.forEach((n,i)=>{if(n>4)throw new Error(`${tileName(TILES[i])}已知总数为${n}，不能超过四张。`);});
  const size=13-sets.length*3;
  if(complete&&![size,size+1].includes(ctx.hand.length))throw new Error(`当前固定组合下，手牌应为${size}或${size+1}张。`);
}
const cache=new Map<string,number>();
const targetCache=new Map<string,Uint8Array>();
function fixedTargets(fixed:number,fixedCounts:number[]):Uint8Array {
  const key=fixed+':'+fixedCounts.join('');const cached=targetCache.get(key);if(cached)return cached;
  const capacity=fixedCounts.map(n=>4-n),c=Array(18).fill(0),groups:number[][]=[];
  for(let i=0;i<18;i++){const triple=Array(18).fill(0);triple[i]=3;groups.push(triple);if(i%9<=6){const sequence=Array(18).fill(0);sequence[i]=sequence[i+1]=sequence[i+2]=1;groups.push(sequence);}}
  const seen=new Set<string>(),flat:number[]=[];
  const visit=(start:number,left:number)=>{if(left===0){const k=c.join('');if(!seen.has(k)){seen.add(k);flat.push(...c);}return;}for(let g=start;g<groups.length;g++){const group=groups[g];if(group.some((n,i)=>n+c[i]>capacity[i]))continue;for(let i=0;i<18;i++)c[i]+=group[i];visit(g,left-1);for(let i=0;i<18;i++)c[i]-=group[i];}};
  for(let pair=0;pair<18;pair++)if(capacity[pair]>=2){c[pair]=2;visit(0,4-fixed);c[pair]=0;}
  const result=Uint8Array.from(flat);if(targetCache.size>=2)targetCache.clear();targetCache.set(key,result);return result;
}
export function normalShanten(counts:number[],fixed=0,fixedCounts?:number[]):number {
  const key=`${RULES_VERSION}:${fixed}:${fixedCounts?.join('')??''}:${counts.join('')}`;
  const saved=cache.get(key);if(saved!==undefined)return saved;
  if(fixed&&fixedCounts){
    // Match every physically possible concealed winning shape. Fixed triplets/quads can
    // make a nominal pair wait impossible; a group-count-only formula misses this case.
    const targets=fixedTargets(fixed,fixedCounts),lower=normalShanten(counts,fixed);let need=15;
    outer:for(let offset=0;offset<targets.length;offset+=18){let deficit=0;for(let i=0;i<18;i++){deficit+=Math.max(0,targets[offset+i]-counts[i]);if(deficit>=need)continue outer;}need=Math.min(need,deficit);if(need===lower+1)break;}
    const result=need-1;if(cache.size>30000)cache.clear();cache.set(key,result);return result;
  }
  const c=[...counts];let best=8;
  function dfs(start:number,m:number,t:number,p:number):void {
    let i=start;while(i<18&&c[i]===0)i++;
    if(i===18){best=Math.min(best,8-2*(m+fixed)-Math.min(t,4-m-fixed)-p);return;}
    if(m+fixed>4)return;
    if(c[i]>=3){c[i]-=3;dfs(i,m+1,t,p);c[i]+=3;}
    if(i%9<=6&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;dfs(i,m+1,t,p);c[i]++;c[i+1]++;c[i+2]++;}
    if(c[i]>=2){
      c[i]-=2;if(!p)dfs(i,m,t,1);dfs(i,m,t+1,p);c[i]+=2;
    }
    if(i%9<=7&&c[i+1]){c[i]--;c[i+1]--;dfs(i,m,t+1,p);c[i]++;c[i+1]++;}
    if(i%9<=6&&c[i+2]){c[i]--;c[i+2]--;dfs(i,m,t+1,p);c[i]++;c[i+2]++;}
    c[i]--;dfs(i,m,t,p);c[i]++;
  }
  dfs(0,0,0,0);
  if(cache.size>30000)cache.clear();cache.set(key,best);return best;
}
export const sevenPairsShanten=(counts:number[])=>6-counts.reduce((n,c)=>n+Math.floor(c/2),0);
export const shanten=(counts:number[],fixed=0,fixedCounts?:number[])=>Math.min(normalShanten(counts,fixed,fixedCounts),fixed?99:sevenPairsShanten(counts));
export function decompose(hand:TileId[],fixed=0):TileId[][]|null {
  const counts=countsOf(hand);const need=4-fixed;
  function sets(left:number,groups:TileId[][]):TileId[][]|null {
    const i=counts.findIndex(x=>x>0);
    if(i<0)return left===0?groups:null;
    if(left<=0)return null;
    if(counts[i]>=3){counts[i]-=3;const r=sets(left-1,[...groups,[TILES[i],TILES[i],TILES[i]]]);counts[i]+=3;if(r)return r;}
    if(i%9<=6&&counts[i+1]&&counts[i+2]){counts[i]--;counts[i+1]--;counts[i+2]--;const r=sets(left-1,[...groups,TILES.slice(i,i+3)]);counts[i]++;counts[i+1]++;counts[i+2]++;if(r)return r;}
    return null;
  }
  for(let i=0;i<18;i++)if(counts[i]>=2){counts[i]-=2;const r=sets(need,[[TILES[i],TILES[i]]]);counts[i]+=2;if(r)return r;}
  if(!fixed&&counts.every(c=>c%2===0)&&hand.length===14)return counts.flatMap((n,i)=>Array.from({length:n/2},()=>[TILES[i],TILES[i]]));
  return null;
}
export function analyze(ctx:HandContext):AnalysisResult {
  validateContext(ctx);const fixed=ctx.fixedSets?.length??0;const counts=countsOf(ctx.hand);
  const fixedCounts=countsOf((ctx.fixedSets??[]).flatMap(setTiles));
  const known=counts.map((n,i)=>n+fixedCounts[i]);
  TILES.forEach((t,i)=>known[i]+=ctx.visible?.[t]??0);
  const remaining=known.map(n=>4-n);
  function improvements(c:number[],includeDead=false):Improvement[]{
    const before=shanten(c,fixed,fixedCounts);return TILES.flatMap((tile,i)=>{
      // Physical holdings constrain hypothetical draws, even if an apparent wait is exhausted.
      if(c[i]+fixedCounts[i]>=4)return [];
      c[i]++;const after=shanten(c,fixed,fixedCounts);c[i]--;
      return after<before&&(includeDead||remaining[i]>0)?[{tile,remaining:remaining[i]}]:[];
    });
  }
  const normal=normalShanten(counts,fixed,fixedCounts),sevenPairs=fixed?null:sevenPairsShanten(counts),s=shanten(counts,fixed,fixedCounts);
  const short=ctx.hand.length===13-fixed*3;
  const discards:DiscardResult[]=short?[]:TILES.flatMap((tile,i)=>{
    if(!counts[i])return [];counts[i]--;const next=shanten(counts,fixed,fixedCounts);const imp=improvements(counts);counts[i]++;
    return [{tile,shanten:next,ukeire:imp.reduce((n,t)=>n+t.remaining,0),improvements:imp,best:false}];
  }).sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire||tileIndex(a.tile)-tileIndex(b.tile));
  discards.forEach(d=>d.best=d.shanten===discards[0].shanten&&d.ukeire===discards[0].ukeire);
  return {normal,sevenPairs,shanten:s,waits:short&&s===0?improvements(counts,true):[],improvements:short?improvements(counts):[],discards,decomposition:s===-1?decompose(ctx.hand,fixed):null};
}
