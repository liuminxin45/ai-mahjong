/**
 * Prompt构建器
 * 为不同场景生成结构化提示词
 */

import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import type { Action } from '../core/model/action';
import type { Tile } from '../core/model/tile';
import type { GuidanceLevel, CommentaryStyle } from './types';
import { getRuleSummary, getPhaseRules } from './RuleContext';

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

    // 获取已胡玩家信息
    const huPlayers = Object.entries(state.declaredHu)
      .filter(([_, hu]) => hu)
      .map(([pid]) => pid);
    const huInfo = huPlayers.length > 0 ? `已胡玩家: ${huPlayers.join(', ')}` : '暂无人胡牌';

    // 获取各玩家定缺信息
    const dingQueInfo = (state as any).dingQueSelection;
    const opponentDingQue = dingQueInfo ? 
      `P1缺${dingQueInfo.P1 || '?'}, P2缺${dingQueInfo.P2 || '?'}, P3缺${dingQueInfo.P3 || '?'}` : '';

    return `你是一位精通成都麻将（血战到底）的专业教练，正在指导一位${level === 'beginner' ? '初学者' : level === 'learning' ? '学习中的' : level === 'practicing' ? '练习中的' : '高级'}玩家。

${getRuleSummary()}

${getPhaseRules(state.phase)}

【当前局面】
- 阶段: ${state.phase}
- 轮次: ${state.turn}/68
- 剩余牌数: ${state.wall.length}
- 当前玩家: ${state.currentPlayer}
- ${huInfo}

【你的手牌】
${formatHand(hand)}

【你的副露】
${formatMelds(melds)}

【你的弃牌】
${formatDiscards(discards)}

${dingQue ? `【你的定缺】: ${dingQue === 'W' ? '万' : dingQue === 'B' ? '条' : '筒'} (必须先打完此花色才能胡牌)` : '【定缺】: 尚未定缺'}
${dingQue && hand.filter(t => t.suit === dingQue).length > 0 ? `⚠️ 你还有${hand.filter(t => t.suit === dingQue).length}张缺门牌未打完！` : ''}

【对手情况】
- P1: 手牌${state.hands.P1.length}张, 副露${formatMelds(state.melds.P1)}, 弃牌${formatDiscards(state.discards.P1)}${state.declaredHu.P1 ? ' ✅已胡' : ''}
- P2: 手牌${state.hands.P2.length}张, 副露${formatMelds(state.melds.P2)}, 弃牌${formatDiscards(state.discards.P2)}${state.declaredHu.P2 ? ' ✅已胡' : ''}
- P3: 手牌${state.hands.P3.length}张, 副露${formatMelds(state.melds.P3)}, 弃牌${formatDiscards(state.discards.P3)}${state.declaredHu.P3 ? ' ✅已胡' : ''}
${opponentDingQue ? `【对手定缺】: ${opponentDingQue}` : ''}

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

**重要提醒**:
1. 如果还有定缺花色的牌，必须优先打掉
2. 血战到底规则下，有人胡了要更小心点炮
3. 考虑番型：自摸+1番，门清+1番，对对胡2番，清一色3番

请分析当前局面，以JSON格式返回：
{
  "recommendedAction": "打X万/条/筒 或 PASS/PENG/GANG/HU",
  "confidence": 0.0-1.0,
  "reasoning": "推理过程（包括对规则的考虑）",
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
   * 构建换三张阶段的指导提示词
   */
  static buildExchangePrompt(
    hand: Tile[],
    level: GuidanceLevel = 'learning'
  ): string {
    // 按花色分组统计
    const suitGroups: Record<string, { tiles: Tile[]; analysis: string[] }> = {
      W: { tiles: [], analysis: [] },
      B: { tiles: [], analysis: [] },
      T: { tiles: [], analysis: [] },
    };
    
    for (const tile of hand) {
      suitGroups[tile.suit].tiles.push(tile);
    }

    // 分析每个花色
    for (const [suit, group] of Object.entries(suitGroups)) {
      const tiles = group.tiles;
      const suitName = suit === 'W' ? '万' : suit === 'B' ? '条' : '筒';
      group.analysis.push(`${suitName}: ${tiles.length}张`);
      
      // 统计对子、刻子
      const rankCounts: Record<number, number> = {};
      for (const t of tiles) {
        rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1;
      }
      
      const pairs = Object.entries(rankCounts).filter(([_, c]) => c === 2);
      const triplets = Object.entries(rankCounts).filter(([_, c]) => c >= 3);
      
      if (triplets.length > 0) {
        group.analysis.push(`  刻子: ${triplets.map(([r]) => r + suitName).join(', ')}`);
      }
      if (pairs.length > 0) {
        group.analysis.push(`  对子: ${pairs.map(([r]) => r + suitName).join(', ')}`);
      }
      
      // 检查顺子和搭子
      const ranks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
      const sequences: string[] = [];
      for (let i = 0; i < ranks.length - 2; i++) {
        if (ranks[i + 1] === ranks[i] + 1 && ranks[i + 2] === ranks[i] + 2) {
          sequences.push(`${ranks[i]}${ranks[i+1]}${ranks[i+2]}${suitName}`);
        }
      }
      if (sequences.length > 0) {
        group.analysis.push(`  顺子: ${sequences.join(', ')}`);
      }
    }

    const levelHints: Record<GuidanceLevel, string> = {
      beginner: '请直接告诉我应该换出哪3张牌，用最简单的语言解释原因。',
      learning: '请分析我的手牌，推荐换出哪3张牌，并解释为什么。',
      practicing: '请给出分析思路，引导我自己判断应该换哪些牌。',
      advanced: '请给出详细的牌型分析，包括各花色的发展潜力和换牌后的定缺考虑。',
    };

    return `你是一位精通成都麻将（血战到底）的专业教练，现在是**换三张阶段**。

${getPhaseRules('EXCHANGE')}

【我的手牌】
${formatHand(hand)}

【手牌分析】
${Object.values(suitGroups).map(g => g.analysis.join('\n')).join('\n')}

【花色统计】
- 万: ${suitGroups.W.tiles.length}张
- 条: ${suitGroups.B.tiles.length}张  
- 筒: ${suitGroups.T.tiles.length}张

【任务】
${levelHints[level]}

**注意**: 
1. 必须选择**同一花色**的3张牌
2. 换出的牌很可能成为定缺花色
3. 保护好对子、刻子、顺子

请以JSON格式返回：
{
  "recommendedTiles": ["X万/条/筒", "X万/条/筒", "X万/条/筒"],
  "selectedSuit": "万/条/筒",
  "reasoning": "选择这个花色的原因",
  "tileAnalysis": {
    "万": {"count": 数量, "value": "高/中/低", "reason": "原因"},
    "条": {"count": 数量, "value": "高/中/低", "reason": "原因"},
    "筒": {"count": 数量, "value": "高/中/低", "reason": "原因"}
  },
  "afterExchangePlan": "换牌后的定缺建议"
}`;
  }

  /**
   * 构建定缺阶段的指导提示词
   */
  static buildDingQuePrompt(
    hand: Tile[],
    level: GuidanceLevel = 'learning'
  ): string {
    // 按花色分组详细分析
    const suitAnalysis: Record<string, {
      count: number;
      tiles: string;
      pairs: number;
      triplets: number;
      sequences: number;
      isolated: number;
      edgeTiles: number;
    }> = {};

    for (const suit of ['W', 'B', 'T'] as const) {
      const tiles = hand.filter(t => t.suit === suit);
      const suitName = suit === 'W' ? '万' : suit === 'B' ? '条' : '筒';
      
      // 统计
      const rankCounts: Record<number, number> = {};
      for (const t of tiles) {
        rankCounts[t.rank] = (rankCounts[t.rank] || 0) + 1;
      }
      
      const ranks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
      
      // 对子和刻子
      let pairs = 0, triplets = 0;
      for (const count of Object.values(rankCounts)) {
        if (count >= 3) triplets++;
        else if (count === 2) pairs++;
      }
      
      // 顺子
      let sequences = 0;
      for (let i = 0; i < ranks.length - 2; i++) {
        if (ranks[i + 1] === ranks[i] + 1 && ranks[i + 2] === ranks[i] + 2) {
          sequences++;
        }
      }
      
      // 孤张和边张
      let isolated = 0, edgeTiles = 0;
      for (const [rankStr, count] of Object.entries(rankCounts)) {
        const rank = Number(rankStr);
        if (count === 1) {
          const hasAdjacent = ranks.some(r => Math.abs(r - rank) === 1);
          if (!hasAdjacent) isolated++;
        }
        if (rank === 1 || rank === 9) edgeTiles += count;
      }
      
      suitAnalysis[suit] = {
        count: tiles.length,
        tiles: tiles.map(t => t.rank + suitName).join(' '),
        pairs,
        triplets,
        sequences,
        isolated,
        edgeTiles,
      };
    }

    const levelHints: Record<GuidanceLevel, string> = {
      beginner: '请直接告诉我应该定哪一门，用最简单的话解释。',
      learning: '请分析三个花色，推荐定哪一门，并说明原因。',
      practicing: '请给出分析框架，引导我自己判断最佳定缺。',
      advanced: '请详细分析各花色的打完难度、牌型发展潜力，给出最优定缺策略。',
    };

    return `你是一位精通成都麻将（血战到底）的专业教练，现在是**定缺阶段**。

${getPhaseRules('DING_QUE')}

【我的手牌】
${formatHand(hand)}

【各花色详细分析】
**万 (${suitAnalysis.W.count}张)**: ${suitAnalysis.W.tiles || '无'}
  - 刻子: ${suitAnalysis.W.triplets}个, 对子: ${suitAnalysis.W.pairs}个, 顺子: ${suitAnalysis.W.sequences}个
  - 孤张: ${suitAnalysis.W.isolated}个, 边张(1/9): ${suitAnalysis.W.edgeTiles}张

**条 (${suitAnalysis.B.count}张)**: ${suitAnalysis.B.tiles || '无'}
  - 刻子: ${suitAnalysis.B.triplets}个, 对子: ${suitAnalysis.B.pairs}个, 顺子: ${suitAnalysis.B.sequences}个
  - 孤张: ${suitAnalysis.B.isolated}个, 边张(1/9): ${suitAnalysis.B.edgeTiles}张

**筒 (${suitAnalysis.T.count}张)**: ${suitAnalysis.T.tiles || '无'}
  - 刻子: ${suitAnalysis.T.triplets}个, 对子: ${suitAnalysis.T.pairs}个, 顺子: ${suitAnalysis.T.sequences}个
  - 孤张: ${suitAnalysis.T.isolated}个, 边张(1/9): ${suitAnalysis.T.edgeTiles}张

【任务】
${levelHints[level]}

**关键考虑**:
1. 定缺的花色必须**全部打完**才能胡牌
2. 优先定：张数少、孤张多、没有刻子/顺子的花色
3. 避免定：有刻子或顺子的花色（打完很难）

请以JSON格式返回：
{
  "recommendedSuit": "万/条/筒",
  "confidence": 0.0-1.0,
  "reasoning": "选择这门的原因",
  "suitRanking": [
    {"suit": "X", "difficulty": "容易/中等/困难", "reason": "分析"},
    {"suit": "X", "difficulty": "容易/中等/困难", "reason": "分析"},
    {"suit": "X", "difficulty": "容易/中等/困难", "reason": "分析"}
  ],
  "warnings": ["需要注意的事项"],
  "playPlan": "定缺后的出牌计划"
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
    let phaseInfo = '';
    
    if (context?.gameState) {
      const state = context.gameState;
      const phase = state.phase;
      const chengduState = state as any;
      
      // 根据阶段提供不同的上下文
      if (phase === 'EXCHANGE') {
        phaseInfo = `
【当前阶段: 换三张】
${getPhaseRules('EXCHANGE')}
`;
        // 分析各花色
        const hand = state.hands.P0;
        const suitCounts = { W: 0, B: 0, T: 0 };
        for (const t of hand) {
          suitCounts[t.suit as 'W' | 'B' | 'T']++;
        }
        contextInfo = `
【你的手牌】
${formatHand(hand)}

【花色统计】
- 万: ${suitCounts.W}张
- 条: ${suitCounts.B}张
- 筒: ${suitCounts.T}张
`;
      } else if (phase === 'DING_QUE') {
        phaseInfo = `
【当前阶段: 定缺】
${getPhaseRules('DING_QUE')}
`;
        const hand = state.hands.P0;
        const suitCounts = { W: 0, B: 0, T: 0 };
        for (const t of hand) {
          suitCounts[t.suit as 'W' | 'B' | 'T']++;
        }
        contextInfo = `
【你的手牌】
${formatHand(hand)}

【花色统计】
- 万: ${suitCounts.W}张
- 条: ${suitCounts.B}张
- 筒: ${suitCounts.T}张
`;
      } else {
        // 出牌阶段
        const dingQue = chengduState.dingQueSelection?.P0;
        contextInfo = `
【当前对局状态】
- 阶段: ${phase}
- 轮次: ${state.turn}
- 你的手牌: ${formatHand(state.hands.P0)}
- 你的副露: ${formatMelds(state.melds.P0)}
${dingQue ? `- 你的定缺: ${dingQue === 'W' ? '万' : dingQue === 'B' ? '条' : '筒'}` : ''}
`;
      }
    }
    
    if (context?.history && context.history.length > 0) {
      contextInfo += `
【对话历史】
${context.history.slice(-6).join('\n')}
`;
    }

    return `你是一位精通成都麻将（血战到底）的专业助手，帮助玩家解答麻将相关问题。

【游戏规则参考】
${getRuleSummary()}
${phaseInfo}
${contextInfo}
【用户问题】
${question}

【要求】
1. 用通俗易懂的语言回答
2. 如果是规则问题，根据成都麻将（血战到底）规则准确解释
3. 如果是策略问题，结合当前局面和阶段特点给出具体建议
4. 可以使用示例来说明
5. 回答要简洁但完整
6. 注意区分不同麻将规则的差异（本游戏是成都血战到底）
7. 不要使用 Markdown 语法，不要输出代码块、表格、引用、链接格式
8. 只允许使用两种文字形式：普通文本、以及用 **加粗** 标记的重点文本
9. 如果需要结构化表达，请只用分段、空行和序号列表，例如“1. … 2. …”

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
