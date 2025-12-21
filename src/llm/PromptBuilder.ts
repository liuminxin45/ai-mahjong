/**
 * Prompt构建器
 * 为不同场景生成结构化提示词
 */

import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { Action } from '../core/model/action';
import type { Tile } from '../core/model/tile';
import type { GuidanceLevel, CommentaryStyle } from './types';

/**
 * 格式化手牌为字符串
 */
function formatHand(tiles: Tile[]): string {
  const grouped: Record<string, number[]> = { W: [], B: [], T: [] };
  for (const tile of tiles) {
    grouped[tile.suit].push(tile.rank);
  }
  
  let result = '';
  for (const [suit, ranks] of Object.entries(grouped)) {
    if (ranks.length > 0) {
      const suitName = suit === 'W' ? '万' : suit === 'B' ? '条' : '筒';
      result += ranks.sort((a, b) => a - b).join('') + suitName + ' ';
    }
  }
  return result.trim() || '无';
}

/**
 * 格式化副露信息
 */
function formatMelds(melds: Array<{ type: string; tile: Tile }>): string {
  if (melds.length === 0) return '无';
  return melds.map(m => {
    const suitName = m.tile.suit === 'W' ? '万' : m.tile.suit === 'B' ? '条' : '筒';
    return `${m.type === 'PENG' ? '碰' : '杠'}${m.tile.rank}${suitName}`;
  }).join(', ');
}

/**
 * 格式化弃牌
 */
function formatDiscards(discards: Tile[]): string {
  if (discards.length === 0) return '无';
  return discards.slice(-10).map(t => {
    const suitName = t.suit === 'W' ? '万' : t.suit === 'B' ? '条' : '筒';
    return `${t.rank}${suitName}`;
  }).join(' ');
}

export class PromptBuilder {
  /**
   * 构建实时出牌建议的提示词
   */
  static buildCoachingPrompt(
    state: GameState,
    playerId: PlayerId,
    legalActions: Action[],
    level: GuidanceLevel = 'learning'
  ): string {
    const hand = state.hands[playerId];
    const melds = state.melds[playerId];
    const discards = state.discards[playerId];
    const dingQue = (state as any).dingQueSelection?.[playerId];
    
    const levelInstructions: Record<GuidanceLevel, string> = {
      beginner: '请用最简单的语言解释，直接告诉玩家应该打哪张牌。',
      learning: '请给出推荐的出牌，并解释原因。列出2-3个备选方案。',
      practicing: '请给出思考方向和关键考虑因素，引导玩家自己思考。',
      advanced: '请给出专业级的深度分析，包括概率计算和高级策略。',
    };

    return `你是一位经验丰富的麻将教练，正在指导一位${level === 'beginner' ? '初学者' : level === 'learning' ? '学习中的' : level === 'practicing' ? '练习中的' : '高级'}玩家。

【当前局面】
- 轮次: ${state.turn}/68
- 剩余牌数: ${state.wall.length}
- 当前玩家: ${state.currentPlayer}

【你的手牌】
${formatHand(hand)}

【你的副露】
${formatMelds(melds)}

【你的弃牌】
${formatDiscards(discards)}

${dingQue ? `【定缺】: ${dingQue === 'W' ? '万' : dingQue === 'B' ? '条' : '筒'}` : ''}

【对手情况】
- P1: 手牌${state.hands.P1.length}张, 副露${formatMelds(state.melds.P1)}, 弃牌${formatDiscards(state.discards.P1)}
- P2: 手牌${state.hands.P2.length}张, 副露${formatMelds(state.melds.P2)}, 弃牌${formatDiscards(state.discards.P2)}
- P3: 手牌${state.hands.P3.length}张, 副露${formatMelds(state.melds.P3)}, 弃牌${formatDiscards(state.discards.P3)}

【可选动作】
${legalActions.map(a => {
  if (a.type === 'DISCARD' && a.tile) {
    const suitName = a.tile.suit === 'W' ? '万' : a.tile.suit === 'B' ? '条' : '筒';
    return `打 ${a.tile.rank}${suitName}`;
  }
  return a.type;
}).join('\n')}

【任务】
${levelInstructions[level]}

请分析当前局面，以JSON格式返回：
{
  "recommendedAction": "打X万/条/筒 或 PASS/PENG/GANG/HU",
  "confidence": 0.0-1.0,
  "reasoning": "推理过程",
  "alternatives": [{"action": "...", "pros": [...], "cons": [...]}],
  "riskAssessment": {
    "dealInRisk": "low/medium/high",
    "riskySuits": ["万/条/筒"],
    "safeDiscards": ["X万", "X条"]
  },
  "strategicHints": ["提示1", "提示2"]
}`;
  }

  /**
   * 构建对局复盘的提示词
   */
  static buildReviewPrompt(
    gameRecord: any,
    keyDecisions: Array<{ turn: number; action: Action; state: GameState }>
  ): string {
    return `你是一位麻将教练，请分析以下对局并给出复盘建议。

【对局结果】
- 结果: ${gameRecord.result}
- 得分: ${gameRecord.score}
- 总轮数: ${gameRecord.stats?.totalTurns || 'N/A'}
- 放炮次数: ${gameRecord.stats?.dealInCount || 0}

【关键决策点】
${keyDecisions.map((d, i) => `
${i + 1}. 第${d.turn}轮
   手牌: ${formatHand(d.state.hands.P0)}
   实际操作: ${d.action.type}${(d.action as any).tile ? ` ${(d.action as any).tile.rank}${(d.action as any).tile.suit === 'W' ? '万' : (d.action as any).tile.suit === 'B' ? '条' : '筒'}` : ''}
`).join('\n')}

【任务】
请分析这局对局：
1. 找出关键转折点和失误
2. 评估整体表现（0-100分）
3. 指出做得好的方面
4. 给出具体改进建议

请以JSON格式返回：
{
  "keyMoments": [
    {
      "turn": 数字,
      "situation": "局面描述",
      "playerAction": "玩家操作",
      "optimalAction": "最优操作",
      "impact": "critical/significant/minor",
      "analysis": "分析",
      "lesson": "学习要点"
    }
  ],
  "overallAssessment": {
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["缺点1", "缺点2"],
    "score": 0-100,
    "grade": "S/A/B/C/D"
  },
  "improvements": ["建议1", "建议2", "建议3"]
}`;
  }

  /**
   * 构建用户画像分析的提示词
   */
  static buildProfilePrompt(
    stats: {
      totalGames: number;
      winRate: number;
      avgDealIn: number;
      avgShanten: number;
      meldFrequency: number;
      commonMistakes: string[];
    }
  ): string {
    return `基于以下玩家的对局统计数据，生成详细的玩家画像分析：

【数据摘要】
- 总对局数: ${stats.totalGames}
- 胜率: ${(stats.winRate * 100).toFixed(1)}%
- 平均放炮次数: ${stats.avgDealIn.toFixed(2)}
- 平均向听数: ${stats.avgShanten.toFixed(2)}
- 副露频率: ${(stats.meldFrequency * 100).toFixed(1)}%
- 常见失误: ${stats.commonMistakes.join(', ') || '无明显失误'}

【任务】
请分析该玩家的：
1. 技术水平等级（beginner/intermediate/advanced/expert）和各项技能评分(0-100)
2. 主要游戏风格（aggressive/defensive/balanced/opportunistic）
3. 风格指标（aggression, caution, flexibility, consistency 各0-1）
4. 突出优点和主要弱点
5. 针对性的提升建议

请以JSON格式返回：
{
  "skillLevel": {
    "overall": 0-100,
    "rank": "beginner/intermediate/advanced/expert",
    "skills": {
      "handReading": 0-100,
      "efficiency": 0-100,
      "defense": 0-100,
      "riskManagement": 0-100,
      "timing": 0-100,
      "adaptation": 0-100
    }
  },
  "playStyle": {
    "primaryStyle": "aggressive/defensive/balanced/opportunistic",
    "metrics": {
      "aggression": 0-1,
      "caution": 0-1,
      "flexibility": 0-1,
      "consistency": 0-1
    },
    "description": "风格描述",
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["缺点1", "缺点2"]
  },
  "recommendations": ["建议1", "建议2", "建议3"]
}`;
  }

  /**
   * 构建问答助手的提示词
   */
  static buildQAPrompt(
    question: string,
    context?: { gameState?: GameState; history?: string[] }
  ): string {
    let contextInfo = '';
    
    if (context?.gameState) {
      const state = context.gameState;
      contextInfo = `
【当前对局状态】
- 轮次: ${state.turn}
- 你的手牌: ${formatHand(state.hands.P0)}
- 你的副露: ${formatMelds(state.melds.P0)}
`;
    }
    
    if (context?.history && context.history.length > 0) {
      contextInfo += `
【对话历史】
${context.history.slice(-6).join('\n')}
`;
    }

    return `你是一位友好的麻将助手，帮助玩家解答麻将相关问题。
${contextInfo}
【用户问题】
${question}

【要求】
1. 用通俗易懂的语言回答
2. 如果是规则问题，给出准确的规则解释
3. 如果是策略问题，结合当前局面给出建议
4. 可以使用示例来说明
5. 回答要简洁但完整

请直接用中文回答，不需要JSON格式。`;
  }

  /**
   * 构建AI解说的提示词
   */
  static buildCommentaryPrompt(
    event: { type: string; playerId?: PlayerId; tile?: Tile; state: GameState },
    style: CommentaryStyle = 'professional'
  ): string {
    const styleGuides: Record<CommentaryStyle, string> = {
      professional: '使用专业、客观的解说风格，分析局势和策略。',
      casual: '使用轻松、随意的聊天风格，像朋友间的讨论。',
      humorous: '使用幽默、有趣的风格，可以开玩笑和调侃。',
      educational: '使用教学风格，解释每个动作背后的原因和策略。',
    };

    const tileStr = event.tile 
      ? `${event.tile.rank}${event.tile.suit === 'W' ? '万' : event.tile.suit === 'B' ? '条' : '筒'}`
      : '';

    return `你是一位麻将比赛解说员。${styleGuides[style]}

【事件】
- 类型: ${event.type}
- 玩家: ${event.playerId || 'N/A'}
${tileStr ? `- 牌: ${tileStr}` : ''}
- 轮次: ${event.state.turn}

【局势简述】
- 剩余牌数: ${event.state.wall.length}
- P0手牌数: ${event.state.hands.P0.length}
- P1手牌数: ${event.state.hands.P1.length}
- P2手牌数: ${event.state.hands.P2.length}
- P3手牌数: ${event.state.hands.P3.length}

请生成一句简短的解说词（20-50字），以JSON格式返回：
{
  "type": "excitement/analysis/prediction/humor",
  "text": "解说内容",
  "emotion": "excited/tense/surprised/calm"
}`;
  }

  /**
   * 构建对手预测的提示词
   */
  static buildOpponentPredictionPrompt(
    state: GameState,
    targetPlayer: PlayerId
  ): string {
    const discards = state.discards[targetPlayer];
    const melds = state.melds[targetPlayer];
    const handCount = state.hands[targetPlayer].length;

    return `你是一位麻将高手，请分析对手 ${targetPlayer} 的手牌和意图。

【${targetPlayer}的信息】
- 手牌数量: ${handCount}张
- 副露: ${formatMelds(melds)}
- 弃牌顺序: ${formatDiscards(discards)}

【场上其他信息】
- 轮次: ${state.turn}
- 剩余牌数: ${state.wall.length}
- 最近弃牌: ${state.lastDiscard ? `${state.lastDiscard.tile.rank}${state.lastDiscard.tile.suit === 'W' ? '万' : state.lastDiscard.tile.suit === 'B' ? '条' : '筒'} (来自${state.lastDiscard.from})` : '无'}

【任务】
分析该对手：
1. 可能持有的牌
2. 做牌意图（是否在进攻、可能的役种）
3. 危险程度
4. 需要警惕的牌

请以JSON格式返回：
{
  "handPrediction": {
    "likelyTiles": ["X万", "X条"],
    "confidence": 0-1,
    "reasoning": "推理过程"
  },
  "intentPrediction": {
    "isAiming": true/false,
    "likelyYaku": ["平胡", "清一色"],
    "dangerLevel": 0-10,
    "warningTiles": ["X万", "X条"]
  },
  "behaviorAnalysis": {
    "pattern": "打牌模式描述",
    "tendencies": ["倾向1", "倾向2"],
    "exploitableWeakness": "可利用的弱点"
  }
}`;
  }
}
