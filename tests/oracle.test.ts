import { it, expect } from 'vitest';
import { normalShanten } from '../src/engine/index.js';

import {targetOracle as oracle} from '../scripts/target-oracle.js';
it('双花色随机手牌、碰杠容量与独立完整和型枚举结果一致',async()=>{
 let seed=20261021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const n=Number(process.env.MAHJONG_ORACLE_SAMPLES??240);
 for(let sample=0;sample<n;sample++){
  const fixed=sample%12===0?1:sample%7===0?3:sample%11===0?4:0,physical=Array(18).fill(0);
  for(let i=0;i<fixed;){const x=random()%18;if(physical[x])continue;physical[x]=random()%2?3:4;i++;}
  const c=Array(18).fill(0);for(let i=0;i<13-fixed*3+sample%2;){const x=random()%18;if(c[x]+physical[x]>=4)continue;c[x]++;i++;}
  expect(normalShanten(c,fixed,physical)).toBe(oracle(c,fixed,physical));
  if(sample%100===0)await new Promise<void>(resolve=>setImmediate(resolve));
 }
},600000);
