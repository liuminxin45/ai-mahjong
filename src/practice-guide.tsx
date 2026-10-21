import { useState, type ReactNode, type RefObject } from 'react';
import { Button, Dialog, Select } from 'chatgpt-desktop-kit';
import { parseHand } from './engine/index.js';
import { MODES, MODE_NAMES, type Mode } from './learning/index.js';
import { GUIDE_HANDS } from './guide-examples.js';
import { Hand, Tile } from './ui.js';

const SEEN_KEY='neo-mahjong-guides-v1';
const memorySeen=new Set<Mode>();
const hasSeen=(mode:Mode)=>{
  if(memorySeen.has(mode))return true;
  try{const saved:unknown=JSON.parse(localStorage.getItem(SEEN_KEY)??'[]');return Array.isArray(saved)&&saved.includes(mode);}catch{return false;}
};
export function usePracticeGuide(mode:Mode,automatic=true){
  const [open,setOpen]=useState(()=>automatic&&!hasSeen(mode));
  const close=()=>{
    memorySeen.add(mode);
    try{const saved:unknown=JSON.parse(localStorage.getItem(SEEN_KEY)??'[]');const seen=Array.isArray(saved)?saved:[];localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...seen.filter(m=>MODES.includes(m)),...memorySeen])]));}catch{/* Temporary practice still keeps this preference for the current visit. */}
    setOpen(false);
  };
  return {open,show:()=>setOpen(true),close};
}

const descriptions:Record<Mode,string>={
  discard:'选一张要打出去的牌，让留下的手牌尽量接近胡牌。',
  ukeire:'找出下一次摸到后，能让手牌更接近胡牌的牌。你选的是想摸到的牌。',
  waits:'找出这手牌再添哪一种牌，就能立即胡牌。',
  'seven-pairs':'以凑成七个对子为目标，选择要打出去的一张牌。',
  defense:'先看题目要你进攻还是防守，再根据给出的信息选择。',
};

function ExampleHand({groups,label='示例手牌'}:{groups:string[];label?:string}){
  return <div className="mj-guide-hand" role="group" aria-label={label}>{groups.map((group,i)=><Hand key={i} tiles={parseHand(group)}/>)}</div>;
}

export function GuideDocument({children}:{children:ReactNode}){
  // The shared dialog focuses its first body target. Start at the reading region,
  // rather than scrolling past the explanation to the interactive example Select.
  return <div className="mj-guide-document" tabIndex={0} role="document" aria-label="规则说明正文">{children}</div>;
}

function ShantenTerms(){
  return <section><h3>先认识「向听」</h3><p>它是手牌离听牌有多远的数字，越小越好：<strong>1向听 → 0向听（听牌）→ -1（已经胡牌）</strong>。从1变0是进入听牌，从0变-1是直接胡牌。</p><p>「综合向听」就是分别按普通型和七对计算，取更小的那个数。普通型是四组顺子或刻子，再加一个对子；本工具的七对允许四张同牌算两对。已有公开碰、杠时，只计算普通型。</p></section>;
}

function EffectiveExample(){
  const [visible,setVisible]=useState('0'),left=4-Number(visible);
  return <section><h3>看一手最简单的例子</h3><ExampleHand groups={GUIDE_HANDS.waiting}/><p>一二三筒、四五六筒、七八九筒已经各成一组，二筒是一对；五六条还差四条或七条。这手已经听牌，向听为0。</p><div className="mj-guide-answer"><span>应选的牌</span><Hand tiles={parseHand(left?'47s':'7s')}/></div><p>摸到四条或七条就能胡牌，向听从0变成-1。没有其他已见牌时，两种牌各剩4张，一共8张。</p><label className="mj-guide-visible"><span>试着改变：其他地方已经看到的四条</span><Select aria-label="示例已见四条" value={visible} onValueChange={setVisible} options={[{value:'0',label:'0张'},{value:'3',label:'3张'},{value:'4',label:'4张'}]}/></label><p role="status">{left?`四条还剩${left}张，七条还剩4张：应选两种，共${left+4}张。`:'四条已经四张全见，不再选它；只选七条，共4张。'}</p></section>;
}

export function PracticeGuideContent({mode}:{mode:Mode}){
  return <div className="mj-guide-content">
    <section><h3>怎么作答</h3>{mode==='discard'?<ol><li>点选手牌中要打出去的<strong>一张</strong>牌，再提交。</li><li>基础题先看打完后离听牌多远，也就是向听；越小越好。</li><li>向听相同时，再看能让手牌继续改善的剩余牌有多少张；越多越好。多个方案同样好，选其中任何一个都算对。</li></ol>:mode==='ukeire'?<ol><li>手牌下方有筒、条两排候选牌。点选所有你希望下一次摸到的牌种，再提交；再次点击可取消。</li><li>基础题同时满足两个条件才选：<strong>摸到后向听立刻变小</strong>，而且<strong>这种牌还没四张全见</strong>。</li><li>同一种牌只选一次，不用按剩余张数重复点。少选、多选都不算正确；如果没有符合条件的牌，可以不选直接提交。</li></ol>:mode==='waits'?<ol><li>在下方候选牌中多选：给手牌添上这种牌后，能否组成完整胡牌牌形？</li><li>检查普通型和七对的所有拆法，同一种牌只选一次；全部选齐、没有多选才算对。</li><li><strong>这里考牌形能不能胡。</strong>题面要求包括已见尽的听口时，即使这种牌四张都已见，仍要选它。</li></ol>:mode==='seven-pairs'?<ol><li>点选手牌里要打出去的一张牌，再提交。</li><li>基础题只按七对比较：先保留更多对子；七对向听相同，再比较还能摸到多少张牌来凑对。</li><li>四张同牌算两对。若题面写明「同时考虑普通型与七对」，就比较两条路线中更有利的结果。并列最优选一个即可。</li></ol>:<ol><li>先读目标：效率优先，还是先避开题目已经确认的危险牌。</li><li>舍牌题点选一张手牌；判断题选择「题设足以保证」或「信息不足，无法保证」。</li><li>只使用题目明确给出的事实。别人以前打过某张牌，不能保证他现在或以后不会胡这张牌。</li></ol>}</section>
    {(mode==='discard'||mode==='ukeire'||mode==='seven-pairs')&&<ShantenTerms/>}
    {mode==='ukeire'?<EffectiveExample/>:mode==='waits'?<section><h3>示例：五六条在等什么？</h3><ExampleHand groups={GUIDE_HANDS.waiting}/><div className="mj-guide-answer"><span>应选的牌</span><Hand tiles={parseHand('47s')}/></div><p>添上四条，五六条变成四五六条；添上七条，变成五六七条。其余三组顺子和二筒对子保持完整，所以四条、七条都要选。</p><p>如果其他地方已经看到四张四条，四条仍是能组成胡牌牌形的「形状听口」，只是已经没有剩余张数。<strong>本专项仍选四条和七条；有效进张题则只选七条。</strong></p></section>:mode==='discard'?<section><h3>示例：先处理没有搭档的牌</h3><ExampleHand groups={GUIDE_HANDS.discard}/><div className="mj-guide-answer"><span>选择打出</span><Tile tile="9s"/></div><p>三组筒子顺子已经完整；一二条、四五条还能继续组合，九条没有搭档。打出九条后是1向听；拆掉一张筒子则会变成2向听，所以先保留完整顺子。</p><p>这里选的是<strong>打出去的牌</strong>。有效进张和听牌题选的是<strong>想摸到的牌</strong>，方向正好不同。</p></section>:mode==='seven-pairs'?<section><h3>示例：四张一筒也能算两对</h3><ExampleHand groups={GUIDE_HANDS.sevenPairs}/><p>四张一筒算两对，二、三、四、五筒各一对，合计六对；六条、七条是两个单张。</p><div className="mj-guide-answer"><span>打出任意一张</span><Hand tiles={parseHand('67s')}/></div><p>打六条，留下七条等另一张七条；打七条则等六条。没有其他已见牌时，各有3张可摸，两种选择都对。拆掉筒子对子会后退一步。</p></section>:<section><h3>示例：旧弃牌能保证安全吗？</h3><div className="mj-guide-answer"><span>对手早先打出</span><Tile tile="4p"/></div><p>题目只告诉你对手以前打过四筒，没有给出他现在的手牌或等牌。问「能否保证四筒以后永远安全？」应选<strong>信息不足，无法保证</strong>。这不等于四筒一定危险。</p><p>如果题目明确给出「这位对手当前只等四条、七条」，那么可以确定二筒不在<strong>他当前</strong>的等牌里。结论不能扩大到其他对手或以后的摸打。</p><p>安全优先的舍牌题，先排除已确认的危险牌，再从剩下的牌里比较向听和进张；效率优先则按题目要求直接比较牌效。</p></section>}
    {mode==='ukeire'&&<section><h3>「有余量」怎么算？</h3><p>每种牌共4张，减去自己手里的、碰杠出去的，以及题目列出的其他已见牌，就是还没见到的数量。不是说这些牌一定都还在牌墙里。</p><p>只让牌形更灵活、却没有立即降低向听的牌，基础有效进张题不选。先记住：<strong>更近一步，而且还没见完。</strong></p></section>}
    {mode!=='waits'&&<details className="mj-guide-more"><summary>遇到「未来几次摸牌」的题</summary><p>这是多步变式，目标以本题写的为准，不再只看下一张能否降向听。只从题目列出的抽牌袋里随机摸牌，摸过的牌不放回，没有对手行动；每次摸牌后都可以重新选择舍牌，胡牌就停止。</p><p>{mode==='ukeire'?'选择所有能让后续最优摸打的成牌机会达到最高的「首摸牌种」，可能不止一种。':'选择能让规定次数内成牌机会最高的一张舍牌；并列最优都接受。'}七对目标只算七对，普通型或七对目标则两种成牌都算。</p></details>}
    <details className="mj-guide-more"><summary>本工具使用哪些规则？</summary><p>这是成都麻将缺门后的专项训练，只用一至九筒和一至九条，每种4张。手牌内部可以组成顺子；公开组合只允许碰、杠，不允许吃牌。普通型为四组面子加一个对子，七对允许四张同牌算两对；已有公开组合时不能走七对。</p></details>
  </div>;
}

export function PracticeGuideDialog({mode,open,onClose,returnFocus}:{mode:Mode;open:boolean;onClose:()=>void;returnFocus:RefObject<HTMLButtonElement|null>}){
  return <Dialog open={open} title={`${MODE_NAMES[mode]} · 规则与示例`} description={descriptions[mode]} onClose={onClose} onCloseAutoFocus={e=>{if(returnFocus.current?.isConnected){e.preventDefault();returnFocus.current.focus();}}} footer={<Button variant="primary" onClick={onClose}>明白了，开始练习</Button>}><GuideDocument><PracticeGuideContent key={mode} mode={mode}/></GuideDocument></Dialog>;
}

export function CompetitionGuideContent({started=false}:{started?:boolean}){
  const [mode,setMode]=useState<Mode>('discard');
  return <div className="mj-guide-content"><section><h3>这一轮怎么比</h3><p>每轮20题，五类训练各4题；每题5分，满分100。单选题选中一个最优答案即可；多选题必须选全且不多选，没有部分分。</p><p>先比得分，再比用时；两者都相同时，先达到成绩的排前面。同一难度可以反复挑战，成绩榜只保留你的最好成绩。</p></section><section><h3>五类题分别怎么答？</h3><label className="mj-guide-mode"><span>查看一种题型</span><Select aria-label="查看题型说明" value={mode} onValueChange={v=>setMode(v as Mode)} options={MODES.map(value=>({value,label:MODE_NAMES[value]}))}/></label><p>{descriptions[mode]}</p><PracticeGuideContent key={mode} mode={mode}/></section><section><h3>{started?'比赛中请记住':'开始前再确认'}</h3><p>{started?'比赛已经开始，查看这份说明也会计时。':'点击「开始比赛」才开始计时，现在看说明不计时。'}开赛后查看说明、切到后台或断网，用时都继续累计；24小时内可自动续接。</p><p>每题提交后不能修改，全部交卷后统一看答案与解析。重新挑战会结束当前进度，从第一题重新计时。</p><p>比赛会上传答卷，并以匿名代号公开最好成绩和用时。身份随当前浏览器保存；清理Cookie或换浏览器会成为新访客。榜单允许熟悉题目后反复挑战。</p></section></div>;
}
