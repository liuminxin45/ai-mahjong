import { countsOf, setTiles, TILES, validateContext, type HandContext, type TileId } from './legacy.js';

export type DrawModel={version:1;bag:TileId[];horizon:number;target:'win'|'seven-pairs';kind:'discard'|'first-draw';safeDiscards?:TileId[]};
export type ExactOption={tile:TileId;numerator:string;denominator:string};
export type DeepCertificate={model:DrawModel;options:ExactOption[];answers:TileId[];nodes:number;branches:{firstDiscard?:TileId;firstDraw:TileId;won:boolean;nextDiscards:TileId[]}[];verifier:'independent-path-enumeration-v1';verified:boolean};
const falling=(n:number,k:number):bigint=>{let p=1n;for(let i=0;i<k;i++)p*=BigInt(n-i);return p;};
// An absorbing win counts every unused continuation. All branches therefore share
// one integer denominator; comparisons and ties never use floating point values.
export function solveDrawModel(ctx:HandContext,model:DrawModel,maxNodes=3000000):Omit<DeepCertificate,'verified'|'verifier'>{
 validateContext(ctx);
 if(model.version!==1||!Number.isInteger(model.horizon)||model.horizon<1||model.horizon>6||model.bag.length<model.horizon||model.target==='seven-pairs'&&ctx.fixedSets?.length)throw new Error('有限摸打模型无效。');
 const fixed=ctx.fixedSets?.length??0,c=countsOf(ctx.hand),pool=countsOf(model.bag),known=countsOf([...ctx.hand,...(ctx.fixedSets??[]).flatMap(setTiles)]);
 TILES.forEach((t,i)=>{if(known[i]+pool[i]+(ctx.visible?.[t]??0)>4)throw new Error('抽牌袋超过物理四张上限。');});
 const short=13-fixed*3;
 if(ctx.hand.length!==(model.kind==='first-draw'?short:short+1))throw new Error('模型与手牌张数不符。');
 let nodes=0;const memo=new Map<string,bigint>(),wins=new Map<string,boolean>();
 function won():boolean{
  const key=c.join('');const old=wins.get(key);if(old!==undefined)return old;
  let yes=!fixed&&c.every(n=>n%2===0);
  if(model.target==='win'&&!yes){
   const meld=(left:number):boolean=>{const i=c.findIndex(n=>n>0);if(i<0)return left===0;if(left===0)return false;
    if(c[i]>=3){c[i]-=3;const ok=meld(left-1);c[i]+=3;if(ok)return true;}
    if(i%9<7&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;const ok=meld(left-1);c[i]++;c[i+1]++;c[i+2]++;if(ok)return true;}return false;};
   for(let i=0;i<18&&!yes;i++)if(c[i]>=2){c[i]-=2;yes=meld(4-fixed);c[i]+=2;}
  }
  wins.set(key,yes);return yes;
 }
 function draw(h:number,n:number):bigint{
  if(!h)return 0n;
  const key=`${h}:${c.join('')}:${pool.join('')}`,old=memo.get(key);if(old!==undefined)return old;
  if(++nodes>maxNodes)throw new Error('精确求解超过节点预算，禁止发布该题。');
  let value=0n;
  for(let i=0;i<18;i++)if(pool[i]){const copies=pool[i];pool[i]--;c[i]++;
   let branch=won()?falling(n-1,h-1):0n;
   if(!branch&&h>1){for(let j=0;j<18;j++)if(c[j]){c[j]--;const v=draw(h-1,n-1);c[j]++;if(v>branch)branch=v;}}
   c[i]--;pool[i]++;value+=BigInt(copies)*branch;
  }
  memo.set(key,value);return value;
 }
 const options:ExactOption[]=[],n=model.bag.length,h=model.horizon;
 if(model.kind==='discard'){
  for(let i=0;i<18;i++)if(c[i]&&(!model.safeDiscards||model.safeDiscards.includes(TILES[i]))){c[i]--;const value=draw(h,n);c[i]++;options.push({tile:TILES[i],numerator:String(value),denominator:String(falling(n,h))});}
 }else{
  for(let i=0;i<18;i++)if(pool[i]){pool[i]--;c[i]++;let best=won()?falling(n-1,h-1):0n;
   if(!best&&h>1)for(let j=0;j<18;j++)if(c[j]){c[j]--;const v=draw(h-1,n-1);c[j]++;if(v>best)best=v;}
   c[i]--;pool[i]++;options.push({tile:TILES[i],numerator:String(best),denominator:String(falling(n-1,h-1))});}
 }
 if(!options.length)throw new Error('模型没有合法候选。');
 const best=options.reduce((a,o)=>BigInt(o.numerator)>a?BigInt(o.numerator):a,0n);
 const accepted=options.filter(o=>BigInt(o.numerator)===best).map(o=>o.tile),branches:DeepCertificate['branches']=[];
 for(const initial of accepted.slice(0,1)){
  const initialIndex=TILES.indexOf(initial);if(model.kind==='discard')c[initialIndex]--;
  const firstDraws=model.kind==='first-draw'?[initialIndex]:pool.flatMap((n,i)=>n?[i]:[]).slice(0,3);
  for(const i of firstDraws){pool[i]--;c[i]++;const isWin=won(),choices:{tile:TileId;value:bigint}[]=[];
   if(!isWin&&h>1)for(let j=0;j<18;j++)if(c[j]){c[j]--;choices.push({tile:TILES[j],value:draw(h-1,n-1)});c[j]++;}
   const maximum=choices.reduce((v,x)=>x.value>v?x.value:v,0n);
   branches.push({...(model.kind==='discard'?{firstDiscard:initial}:{}),firstDraw:TILES[i],won:isWin,nextDiscards:choices.filter(x=>x.value===maximum).map(x=>x.tile)});c[i]--;pool[i]++;
  }
  if(model.kind==='discard')c[initialIndex]++;
 }
 return {model,options,answers:accepted,nodes,branches};
}
