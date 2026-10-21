import { describe,it,expect } from 'vitest';
import { analyze,countsOf,decompose,normalShanten,parseHand,setTiles,sevenPairsShanten,TILES,validateContext,type TileId } from '../src/engine/index.js';
describe('双花色精确分析',()=>{
 it('只接受条筒与严格语法',()=>{expect(TILES).toHaveLength(18);expect(parseHand('123p 456s')).toHaveLength(6);for(const s of ['1m','0p','123z','p1','1p!'])expect(()=>parseHand(s)).toThrow();});
 it('普通成牌与四张算两对',()=>{expect(analyze({hand:parseHand('123456789p11122s')}).shanten).toBe(-1);expect(sevenPairsShanten(countsOf(parseHand('1111223344p5566s')))).toBe(-1);expect(decompose(parseHand('1111223344p5566s'))).not.toBeNull();});
 it('固定组合的物理四张与结构三张分开',()=>{expect(analyze({hand:parseHand('123456789p22s'),fixedSets:[{kind:'quad',tile:'1s'}]}).shanten).toBe(-1);expect(()=>analyze({hand:parseHand('123456789p12s'),fixedSets:[{kind:'quad',tile:'1s'}]})).toThrow(/四张/);expect(()=>setTiles({kind:'sequence',tile:'8p'})).toThrow();});
 it('见尽的合法听口保留为零张',()=>{const r=analyze({hand:parseHand('123456789p1112s'),visible:{'2s':3}});expect(r.waits.find(t=>t.tile==='2s')?.remaining).toBe(0);expect(r.improvements).not.toContainEqual({tile:'2s',remaining:0});});
 it('固定刻子不能再制造第五张等待或虚假听牌',()=>{const r=analyze({hand:parseHand('123456789p1s'),fixedSets:[{kind:'triplet',tile:'1s'}]});expect(r.waits.map(t=>t.tile)).not.toContain('1s');expect(r.shanten).toBe(1);});
 it('舍出的牌不会重新加入未知牌',()=>{const hand=parseHand('123456789p12459s'),r=analyze({hand});for(const d of r.discards)for(const t of d.improvements)expect(t.remaining).toBe(4-hand.filter(x=>x===t.tile).length);expect(r.discards[0].tile).toBe('9s');});
 it('拒绝非法第五张与错误张数',()=>{expect(()=>analyze({hand:parseHand('1111123456789p')})).toThrow(/四张/);expect(()=>validateContext({hand:parseHand('123p')})).toThrow(/13/);expect(()=>analyze({hand:parseHand('123456789p1112s'),visible:{'1s':2}})).toThrow(/四张/);});
 it('与独立单花色完整和型枚举器对照',()=>{
   // Oracle builds every legal target from unordered full melds and a pair. It shares no DFS/shanten code.
   const melds:number[][]=[];for(let i=0;i<9;i++){const x=Array(9).fill(0);x[i]=3;melds.push(x);}for(let i=0;i<7;i++){const x=Array(9).fill(0);x[i]=x[i+1]=x[i+2]=1;melds.push(x);}
   const targets=new Map<string,number[]>();const c=Array(9).fill(0);
   function enumerate(start:number,left:number){if(!left){for(let p=0;p<9;p++)if(c[p]<=2){c[p]+=2;targets.set(c.join(''),[...c]);c[p]-=2;}return;}for(let m=start;m<melds.length;m++){const x=melds[m];if(c.some((v,i)=>v+x[i]>4))continue;for(let i=0;i<9;i++)c[i]+=x[i];enumerate(m,left-1);for(let i=0;i<9;i++)c[i]-=x[i];}}
   enumerate(0,4);expect(targets.size).toBeGreaterThan(1000);
   let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
   for(let sample=0;sample<180;sample++){const hand=Array(9).fill(0);for(let n=0;n<13+sample%2;){const i=random()%9;if(hand[i]<4){hand[i]++;n++;}}let overlap=0;for(const target of targets.values())overlap=Math.max(overlap,target.reduce((s,n,i)=>s+Math.min(n,hand[i]),0));expect(normalShanten([...hand,...Array(9).fill(0)])).toBe(13-overlap);}
 });
});
