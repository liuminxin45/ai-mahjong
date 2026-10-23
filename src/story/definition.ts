import type { DecisionQuestion } from '../decision/questions.js';
import type { Challenge, ChallengeKind } from '../experience/definitions.js';
import type { ScenarioCertificate, ScenarioModel } from './model.js';
import type { HandContext, TileId } from '../engine/index.js';
import raw from './catalog.json' with { type: 'json' };
import { NARRATIVE_VERSION, type NarrativeVersion } from './edition.js';
export const STORY_VERSION = 'unfinished-record-1' as const;
export type StoryWitness={basis:string;summary:string;alternative:TileId;tiles:TileId[];before?:{context:HandContext;model:ScenarioModel;certificate:ScenarioCertificate}};
export type DecisionNode = { id: string; position: number; variant: 'shared' | 'changed' | 'kept' | 'loss' | 'clear'; chapter: number; question: DecisionQuestion; challenge: Challenge; scenario?: ScenarioModel; certificate?: ScenarioCertificate; witness?:StoryWitness; note: string; noteTime: '当年的注记' | '后来补记' | '随信附言'; pair?: string };
export type StoryDefinition = { version: typeof STORY_VERSION | NarrativeVersion; nodes: DecisionNode[]; mirror: { opening: string; endings: string[] }; };
export const story = raw as StoryDefinition;
const siblingId = (id: string) => id.replace(STORY_VERSION, NARRATIVE_VERSION);
export const siblingStory: StoryDefinition = {version:NARRATIVE_VERSION,nodes:story.nodes.map(n=>({...n,id:siblingId(n.id),...(n.pair?{pair:siblingId(n.pair)}:{})})),mirror:{opening:siblingId(story.mirror.opening),endings:story.mirror.endings.map(siblingId)}};
export function storyFor(edition?: NarrativeVersion): StoryDefinition {return edition === NARRATIVE_VERSION ? siblingStory : story;}
const registry = new Map([...story.nodes,...siblingStory.nodes].map(n => [n.id, n]));
export function storyNode(id: string): DecisionNode { const n = registry.get(id); if (!n) throw Error('这份牌谱的节点版本无法识别。'); return n; }
export const chapters = [
  { title: '落座', quote: '你还欠我一张牌。', question: '刚才那张牌，你为什么愿意放下？', music: 'reminiscing', level: 1 },
  { title: '想赢', quote: '那晚，谁都没有提起散场。', question: '你愿意为更大的结果，等多久？', music: 'earnest', level: 2 },
  { title: '未见之牌', quote: '你看牌的时候，他在看什么？', question: '条件变了，你的答案也会变吗？', music: 'evening', level: 3 },
  { title: '对面的人', quote: '那句话，当时没有说完。', question: '看懂几次选择，就足以看懂一个人吗？', music: 'touching', level: 3 },
  { title: '再落一张', quote: '这回，慢慢来。', question: '下一次，你想和谁再坐一会儿？', music: 'reaching', level: 4 },
] as const;
export const chapterKinds: ChallengeKind[][] = [
  ['entanglement','temptation','gap','cost','adaptability'],
  ['cost','entanglement','adaptability','gap','temptation'],
  ['gap','adaptability','temptation','entanglement','cost'],
  ['adaptability','cost','entanglement','temptation','gap'],
  ['temptation','gap','cost','adaptability','entanglement'],
];
export const oldNotes = [
  '这一张，我当时没看懂。', '你摆牌，总要摆得齐。', '杯子空了，你也没发现。', '我给你添了水。', '你说，还早，再打一局。',
  '那晚，你一直在看手机。', '我问车几点，你说不急。', '有一把你做成了大的，得意了好一会儿。', '下一把，我又赢了回来。', '后来才知道，那是你走之前的最后一晚。',
  '牌河里的几张牌，我倒记得清楚。', '你说过的话，反而记不全。', '有一手，我真以为自己看懂你了。', '后来发现，我也在猜。', '有一页，写的全是你说过的话。',
  '你说，新地方不知能不能约到人打牌。', '我回你：谁还缺你一个。', '这句挺欠的。', '其实，我想问你什么时候回来。', '最后只说了句：到了，报个平安。',
  '搬走以后，我们还常说改天。', '慢慢地，只在过年时问一句好。', '这本牌谱，我一直没扔。', '最后那张，你走得急，没打。', '那天想说的话，现在补上。',
] as const;
