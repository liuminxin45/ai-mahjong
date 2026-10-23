export type Scene='eve-door'|'family-table'|'winter-window'|'present-cabinet'|'open-notebook'|'dinner-table';
export type Portrait='sister-smile'|'sister-think'|'sister-orange'|'uncle-smile'|'uncle-think'|'mother-eve'|'mother-present'|'aunt';
export type StoryBeat={id:string;scene:Scene;period?:string;speaker?:string;portrait?:Portrait;lines:string[];action?:string};
export const chapters=[
 {title:'替我一会儿',music:'clear-waters',scene:'family-table'},
 {title:'这把算我的',music:'heartwarming',scene:'family-table'},
 {title:'再坐一会儿',music:'evening',scene:'family-table'},
 {title:'她后来会了',music:'touching',scene:'open-notebook'},
 {title:'留给我的一局',music:'reaching',scene:'open-notebook'}
] as const;
export const opening:StoryBeat[]=[
 {id:'arrive',scene:'eve-door',period:'那年 · 除夕',lines:['进门时，围巾上还带着雪。','妹妹接走我的包，转身塞到了沙发底下。']},
 {id:'home',scene:'eve-door',lines:['鞋柜上放着一碗凉饺子，底下压着我的筷子。','屋里有人喊了一声回来了，牌碰在一起，没有停。']},
 {id:'sister',scene:'eve-door',speaker:'妹妹',portrait:'sister-smile',lines:['“哥，替我一会儿。”','“赢了算我的。”']},
 {id:'take-seat',scene:'family-table',lines:['她拉开椅子，把手里的牌推过来。','我连外套都没来得及脱。'],action:'落座'}
];
export const entries:StoryBeat[][]=[
 [
  {id:'seats',scene:'family-table',portrait:'uncle-smile',speaker:'舅舅',lines:['“搬救兵也没用。你妹妹刚欠我三块。”']},
  {id:'family',scene:'family-table',portrait:'mother-eve',lines:['母亲坐在右手边，姨妈在左边。','妹妹挨着我坐，膝上摊着一本小本子。']},
  {id:'your-hand',scene:'family-table',portrait:'sister-think',speaker:'妹妹',lines:['“这副牌，你替我打。”','她把笔递来，又缩回去：“先教我，别急。”']}
 ],
 [
  {id:'orange',scene:'winter-window',portrait:'sister-orange',lines:['窗外响起一串鞭炮。','妹妹剥了半个橘子，塞到我手心，橘络一根没摘。']},
  {id:'sugar',scene:'winter-window',lines:['小时候她嫌橘子酸，非得我先尝一瓣。','我问她这次尝过没有。她只顾着笑，嘴里已经塞满了。']},
  {id:'peel',scene:'winter-window',lines:['橘皮在杯盖里盘成一圈，她说像条睡着的小蛇。','我说画下来。她低头画了，尾巴弯得太长。']},
  {id:'again',scene:'family-table',portrait:'sister-smile',speaker:'妹妹',lines:['“再来。这把算我的。”','舅舅已经把牌洗好了。'],action:'再来一把'}
 ],
 [
  {id:'phone',scene:'winter-window',lines:['手机亮起来。明早七点的车，还没改签。','我把屏幕扣在桌上。']},
  {id:'ticket',scene:'winter-window',lines:['窗上蒙着一层白汽。她画了个圆，又用袖口擦掉。','去年回来时，这里还贴着她没做完的英语试卷。']},
  {id:'stay',scene:'family-table',portrait:'sister-think',speaker:'妹妹',lines:['“还走不走？”','我说，再坐一会儿。'],action:'坐下'}
 ],
 [
  {id:'later-book',scene:'present-cabinet',period:'今年 · 清明前一天',lines:['柜子里的樟脑味落在手上。','母亲在门口收拾明天上山的袋子，问那支铅笔还在不在。']},
  {id:'her-writing',scene:'open-notebook',lines:['本子夹在她那件开衫底下。','前几页圈圈叉叉，后面却写得整整齐齐。']},
  {id:'small-pocket',scene:'present-cabinet',lines:['口袋里有一张超市的小票，折成了四折。','她买了橘子、铅笔，还有我总说太甜的那种糖。']},
  {id:'she-tried',scene:'open-notebook',speaker:'页边的字',lines:['“这里哥说过，不能只看自己手里的。”','底下又添了很小的三个字：我试过。'],action:'翻到这一局'}
 ],
 [
  {id:'same-shape',scene:'open-notebook',lines:['最后一页，是我回家那晚接过的牌。','她连桌上打过什么，也一张张补在了旁边。']},
  {id:'not-same',scene:'open-notebook',lines:['我差一点照着记忆，把那张牌打出去。','纸上多画的几个圈，把手指留住了。']},
  {id:'last-margin',scene:'open-notebook',speaker:'页边的字',lines:['“上次没问完的，等你回来。”','末尾画着个小人，趴在一堆牌上。'],action:'接着打'}
 ]
];
export const exits:StoryBeat[][]=[
 [
  {id:'write-it',scene:'family-table',portrait:'sister-think',lines:['她在本子上抄牌。三条画得像三根歪筷子。','“你慢一点，我还没画到那儿。”']},
  {id:'pencil',scene:'family-table',lines:['我替她把铅笔削尖。','她把那一点木屑扫进掌心，拢着，不让它掉进牌里。']},
  {id:'dumplings',scene:'family-table',portrait:'mother-eve',lines:['母亲端来那碗饺子，已经重新热过一遍。','妹妹先替我吹了吹，又自己夹走了一个。']}
 ],
 [
  {id:'orange-stain',scene:'winter-window',portrait:'sister-orange',lines:['本子沾了一滴橘子汁。','她拿袖口去擦，我拦了一下，已经晚了。']},
  {id:'her-name',scene:'family-table',speaker:'妹妹',portrait:'sister-smile',lines:['“以后这页就认得出来了。”','她翻到下一张，写了个大大的“我”。']}
 ],
 [
  {id:'train',scene:'family-table',portrait:'sister-think',lines:['车次提醒又响了。','她从我手里抽走铅笔，夹进本子：“下次接着。”']},
  {id:'back-door',scene:'eve-door',lines:['我弯腰找包。','她踢开拖鞋，把包从沙发底下勾出来，还拍了两下灰。']},
  {id:'door-talk',scene:'eve-door',portrait:'sister-smile',lines:['“到了给我发个消息，别又说忘了。”','我答应着。她把围巾塞过来，毛线勾住了拉链。']},
  {id:'stairs',scene:'eve-door',lines:['走到楼下，手机震了一下。','她发来一张本子的照片，拍歪了，半个手指挡着刚才的牌。']},
  {id:'cut',scene:'present-cabinet',period:'今年 · 清明前一天',lines:['柜门轻轻碰了一声。','母亲把白菊装进袋子，没再催我。']}
 ],
 [
  {id:'eraser',scene:'open-notebook',lines:['那一处被橡皮擦薄了。','原来她后来改过答案，旁边画了一个朝上的小箭头。']},
  {id:'mother-note',scene:'present-cabinet',portrait:'mother-present',speaker:'母亲',lines:['“你不在的时候，她也拉着我们打。”','“打完就往本子上画。画得比打得久。”']},
  {id:'pencil-worn',scene:'open-notebook',lines:['我认出那个歪歪的三条，旁边多了一条睡着的小蛇。','铅笔上的牙印，还在我原来握笔的地方。']},
  {id:'waiting',scene:'open-notebook',speaker:'页边的字',lines:['“这回等哥回来，让他猜我打哪张。”']}
 ],
 [
  {id:'last-space',scene:'open-notebook',lines:['最后一行只画了一半。','我拿起那支短铅笔，把刚才打出的牌补上。']},
  {id:'small-words',scene:'open-notebook',speaker:'页边的字',lines:['“哥回来时，别一进门就问待几天。”','字越写越小：先让他坐下。']},
  {id:'bag',scene:'present-cabinet',lines:['我把本子放进明天的袋子。','铅笔留在里面，露出一小截。'],action:'合上本子'},
  {id:'tomorrow',scene:'present-cabinet',lines:['母亲说，明天带两个橘子就够了。','我在袋子里摸了摸，还是又放进去一个。']},
  {id:'dinner',scene:'dinner-table',portrait:'mother-present',speaker:'母亲',lines:['“吃饭了。”','我把那张椅子推回桌下，走过去。']}
 ]
];
/** At most two optional beats per round; both require a real public event. */
export function middleBeat(chapter:number,discards:number,hasNewPublicTile:boolean):StoryBeat|undefined{
 if(!hasNewPublicTile)return;
 if(chapter===1&&discards===1)return {id:'first-fall',scene:'family-table',portrait:'sister-think',speaker:'妹妹',lines:['“噢，打出去的放这里。”','她指指桌面，等舅舅摸牌。']};
 if(chapter===1&&discards===3)return {id:'notes',scene:'family-table',portrait:'aunt',speaker:'姨妈',lines:['“你们俩凑一起，牌都打慢了。”','妹妹把本子往我这边挪了挪。']};
 if(chapter===2&&discards===2)return {id:'look-up',scene:'family-table',portrait:'uncle-think',speaker:'舅舅',lines:['“看我干什么，看牌。”','他笑着，把刚摸的牌插回手里。']};
 if(chapter===2&&discards===4)return {id:'orange-core',scene:'family-table',portrait:'sister-orange',lines:['她把最后一瓣橘子留在桌沿。','轮到我时，轻轻推过来。']};
 if(chapter===3&&discards===2)return {id:'chair',scene:'family-table',portrait:'mother-eve',lines:['母亲起身去关窗。','妹妹伸手扶住她的牌，一张也没偷看。']};
 if(chapter===3&&discards===4)return {id:'wait',scene:'family-table',portrait:'sister-think',speaker:'妹妹',lines:['“这回我记住了。”','她盖住刚写的字，不许我看。']};
 if(chapter===4&&discards===2)return {id:'crossed',scene:'open-notebook',speaker:'页边的字',lines:['“不是所有好看的，都得留。”','“但这个例外。再算一次。”']};
 if(chapter===5&&discards===2)return {id:'blank',scene:'open-notebook',lines:['下一格空着。','她把回答的位置，留给了我。']};
}
export const allBeats=[...opening,...entries.flat(),...exits.flat(),...[1,2,3,4,5].flatMap(c=>[1,2,3,4].map(n=>middleBeat(c,n,true)).filter((x):x is StoryBeat=>!!x))];
