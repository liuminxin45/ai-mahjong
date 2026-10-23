import {writeFileSync} from 'node:fs';
import {analyze,countsOf,parseHand,shanten,sorted,TILES,type TileId} from '../src/engine/index.js';
import {shuffled,type RoundConfig} from '../src/journey/round.js';
// Authored starting shapes; the rest of the physical deal is fixed here, not at play time.
const hands=[
 ['123345p22456789s','12345677p234589s','11246789p234567s'],
 ['1122334488p2369s','123456789p22558s','11223388p345689s'],
 ['12345689p224679s','12233489p345567s','23456789p123449s'],
 ['11345678p224679s','12234568p334589s','12345688p234679s']
].map(row=>row.map(parseHand));
const deck=TILES.flatMap(t=>Array<TileId>(4).fill(t)),configs:RoundConfig[]=[];
for(let variant=0;variant<3;variant++){
 for(let attempt=0;attempt<500;attempt++){
  const h=attempt===0?hands[0][variant]:sorted(shuffled(deck,913000+variant*1000+attempt).slice(0,14)),a=analyze({hand:h});
  if(a.shanten<1||a.shanten>3||a.discards.filter(d=>d.shanten===a.discards[0].shanten).length<2)continue;
  const free=[...deck];for(const t of h)free.splice(free.indexOf(t),1);
  const before=a.discards.filter(d=>d.best).map(d=>d.tile).join(',');
  if(Array.from({length:100},(_,i)=>shuffled(free,i+5000).slice(0,4)).some(known=>{const visible=Object.fromEntries(TILES.map(t=>[t,known.filter(x=>x===t).length]));return analyze({hand:h,visible}).discards.filter(d=>d.best).map(d=>d.tile).join(',')!==before;})){hands[0][variant]=h;break;}
 }
}
for(let chapter=1;chapter<=5;chapter++)for(let variant=0;variant<3;variant++){
 const hand=hands[chapter===5?0:chapter-1][variant];if(hand.length!==14)throw Error('Author hand must contain fourteen tiles: '+hand);
 const remaining=[...deck];for(const t of hand)remaining.splice(remaining.indexOf(t),1);
 let chosen:RoundConfig|undefined;
 for(let attempt=0;attempt<2000;attempt++){
  const shuffledDeck=shuffled(remaining,chapter*100000+variant*10000+attempt),other=[0,1,2].map(n=>sorted(shuffledDeck.slice(n*13,n*13+13))),wall=shuffledDeck.slice(39);
  if(chapter===1&&other.some(h=>shanten(countsOf(h))<2))continue;
  const rivers:TileId[][]=[[],[],[],[]];
  // Later notebook starts partway through a round: the wall and rivers share the same four copies.
  if(chapter===5){for(let n=0;n<4;n++)rivers[(n+1)%4].push(wall.shift()!);}
  const visible=Object.fromEntries(TILES.map(t=>[t,rivers.flat().filter(x=>x===t).length]));
  const a=analyze({hand,visible});if(chapter===5){const first=analyze({hand}),before=first.discards.filter(d=>d.best).map(d=>d.tile).join(','),after=a.discards.filter(d=>d.best).map(d=>d.tile).join(',');if(before===after)continue;}
  chosen={id:`table-${chapter}-${variant+1}`,chapter,family:chapter===5?`return-${variant+1}`:`chapter-${chapter}-shape-${variant+1}`,hands:[sorted(hand),...other],rivers,wall};break;
 }
 if(!chosen)throw Error(`Could not curate chapter ${chapter} / ${variant}`);configs.push(chosen);
}
writeFileSync('src/journey/deals.json',JSON.stringify(configs,null,2)+'\n');
console.log('15 physical 72-tile deals; chapter 1 grants two player turns; paired last chapter changes the best public-information choice.');
