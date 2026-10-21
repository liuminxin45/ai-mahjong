import { analyze, countsOf, parseHand, TILES, type TileId, type HandContext } from '../engine/index.js';
export type Scenario = { id:string; title:string; goal:'efficiency'|'safety'|'balance'; context:HandContext; waits:TileId[]; rivers:{label:string;tiles:TileId[]}[]; publicSets:{label:string;tiles:TileId[]}[]; facts:string[]; rationale:string; lessonId:string };
// Original authored case briefs. Waits below are explicit teaching assumptions, never inferred probabilities.
const briefs:[string,'efficiency'|'safety'|'balance',string,string][]=[
 ['先读目标','safety','9s','本题已确认9条在对手等待集合内；安全优先时先排除它。'],
 ['效率的代价','efficiency','9s','题目要求保留最高效率，解析同时指出最优舍牌是否命中已知等待。'],
 ['不把旧弃牌当保证','safety','1p9s','即使对手早先弃过一筒，本题已确认他现在等待一筒；以当前事实为准。'],
 ['同手牌换目标','balance','9s','先排除确定危险牌，再在其余舍牌中按向听与进张排序。'],
 ['两家同时施压','safety','1p9s5s','已知两家等待集合的并集包含一筒、九条、五条，不能只看一家。'],
 ['威胁与效率分开读','efficiency','1p5s','效率题仍按向听与进张评分；危险提示不是偷偷更换标准。'],
 ['并列时仍需避险','balance','1p','一筒被列为确定危险时，应从其他候选中比较牌效。'],
 ['最后一张不代表安全','safety','9s','九条即使是第四张公开出来，也可能补成顺子；题设的等待事实优先。'],
 ['公开信息不是猜牌','safety','2p5s','本题明确给出二筒和五条为等待，不要求从牌河猜出暗手。'],
 ['先降向听','efficiency','3p5s','先比较结构距离，再比较进张。不能用一个大进张数掩盖向听变差。'],
 ['目标是保留出路','balance','2p9s','排除确定危险后，仍尽量保留效率，避免把所有牌都视作同样安全。'],
 ['旧线索被新事实覆盖','safety','4p9s','对手的早巡弃牌只是旧线索，本题确认的当前等待是评分依据。'],
 ['不要重复扣牌','efficiency','5p','比较进张时，公开区与自己固定组合要分别记账，每张只扣一次。'],
 ['边张也有危险','safety','1p9p','一筒、九筒并非天然安全，题设已把它们列为等待。'],
 ['中张也能成为选择','balance','1p9p9s','不能只按边张中张口诀作答；先过滤题设风险，再比较剩余牌。'],
 ['确定与不确定','safety','7p5s','只把已知等待当确定危险，不把未列出的牌宣称为真实局面绝对安全。'],
 ['进张是当前指标','efficiency','8p','本题比较一层进张，不能把它直接解释为多巡和牌概率。'],
 ['先说明取舍','balance','6p9s','折中目标按题面规则判分：避开确定危险，再保留最佳结构。'],
 ['两种花色都要检查','safety','2p5s9s','等待集合可能跨花色，不能只盯着对手某一组公开牌。'],
 ['慢一点但答对条件','safety','3p4p','本题训练读条件；先确认安全目标，不追求按得最快。'],
 ['牌河不能给出精确率','balance','5p9s','等待集合是题设，不是根据这几张牌河估算出的百分比。'],
 ['最优不必唯一','efficiency','6p','同一向听与进张的所有并列方案都被接受，不强行制造唯一答案。'],
 ['对手公开了新等待','safety','7p9s','只使用现在确认的等待集合，不沿用前一道题的答案。'],
 ['同一弃牌不同后果','balance','8p5s','比较同一手牌时，等待集合变化可能改变安全目标下的选择。'],
 ['不要把筋牌当定律','safety','2p8p','本工具没有立直与振听规则，不能套用其他规则下的绝对安全结论。'],
 ['看见危险但目标未变','efficiency','2p9s','本题只考牌效排序，风险写入解析供对照，不改动正确答案。'],
 ['先处理已确认威胁','balance','3p9s','确定危险和一般线索分开处理，优先使用可靠程度高的信息。'],
 ['不同对手的并集','safety','4p5s9s','面对多个公开等待，排除其并集；只避开一家仍可能命中另一家。'],
 ['安全题也比较牌效','safety','5p','排除确定危险之后，不必随便选牌；仍按向听与进张保留出路。'],
 ['舍出的牌不回牌山','efficiency','9s','当前舍牌之后，这张牌计入公开信息，不能给自己多算一张有效进张。'],
 ['复盘漏掉的条件','balance','6p5s','若选中了确定危险牌，先检查自己是否读漏等待集合，而非背诵答案。'],
 ['把推测留在推测栏','safety','7p1p','题设只承认列出的等待为事实，其他风险判断不作为确定结论。'],
 ['一次只比较一个标准','efficiency','8p9s','本题先比较向听，同向听时比较进张，不混入未定义番数。'],
 ['防守并非放弃思考','balance','9p5s','避免确定危险后，还有不同的结构损失，需要继续比较。'],
 ['同巡信息更新','safety','1p5s9s','本题直接给出更新后的等待，早先的安全标签不继续沿用。'],
 ['没有番数输入','efficiency','2p','本工具不计地区番型，因此不能凭想象中的清一色奖励改变评分。'],
 ['分清数据与解释','balance','3p5s','牌效来自确定性计算，危险来自题设；两类依据应能分别核对。'],
 ['再检查另一家','safety','4p8p9s','作答前检查完整等待集合，避免把只对一家有效的选择当作全局安全。'],
 ['目标明确才能评价','balance','5p9s','本题用已声明的折中教案评价，不能将题目得分推广为真实对局胜率。'],
 ['读懂而不是背住','safety','6p9p','本题等待与前题不同；根据当前条件重算，别沿用上一次的舍牌。'],
];
const scenarioHands=['123456789p12459s','1123456789p2345s','12456789p234569s','123456p11234589s','11223345p234569s','123789p12345689s','234567p11234569s','12345678p123459s','11234567p234589s','23456789p123459s'];
export const scenarios:Scenario[]=briefs.map((b,i)=>{
 const hand=parseHand(scenarioHands[i%scenarioHands.length]);
 const publicSets=i%2===0?[{label:'对家已固定刻子',tiles:['6s','6s','6s'] as TileId[]}]:[];
 const known=countsOf([...hand,...publicSets.flatMap(s=>s.tiles)]),visible:Partial<Record<TileId,number>>={};
 for(const t of publicSets.flatMap(s=>s.tiles))visible[t]=(visible[t]??0)+1;
 const rivers=['上家牌河','对家牌河','下家牌河','自己牌河'].map((label,r)=>{
  const tiles:TileId[]=[];for(let n=0;n<3;n++){let index=(i*7+r*5+n*3)%18;while(known[index]>=4)index=(index+1)%18;const t=TILES[index];known[index]++;visible[t]=(visible[t]??0)+1;tiles.push(t);}return {label,tiles};
 });
 return {id:`scenario-${String(i+1).padStart(2,'0')}`,title:b[0],goal:b[1],context:{hand,visible},waits:parseHand(b[2]),rivers,publicSets,facts:[`本题已确认对手当前等待：${b[2]}。`,`四家牌河与固定刻子如下，均计入可见牌；没有展示的牌保持未知。`,`未提供完整地区规则；不使用振听、计分或永久安全牌假设。`],rationale:b[3],lessonId:`lesson-${19+i%3}`};
});
export function scenarioAnswers(s:Scenario):TileId[]{
  const ds=analyze(s.context).discards;
  const eligible=s.goal==='efficiency'?ds:ds.filter(d=>!s.waits.includes(d.tile));
  if(!eligible.length)throw new Error(`情境题没有可接受选项：${s.id}`);
  const min=Math.min(...eligible.map(d=>d.shanten));const best=Math.max(...eligible.filter(d=>d.shanten===min).map(d=>d.ukeire));
  return eligible.filter(d=>d.shanten===min&&d.ukeire===best).map(d=>d.tile);
}
