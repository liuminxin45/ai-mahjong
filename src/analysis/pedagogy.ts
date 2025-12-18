import type { HumanPersona } from './humanPersona';
import type { MistakePattern } from './mistakePatterns';

export type TeachingTone = 'DIRECT' | 'ENCOURAGING' | 'CAUTIOUS' | 'CHALLENGING';

export type TeachingPlan = {
  tone: TeachingTone;
  focusPoints: string[];
  avoidOverload: boolean;
};

export function buildTeachingPlan(
  persona: HumanPersona,
  mistakes: MistakePattern[],
): TeachingPlan {
  const tone = determineTone(persona);
  const focusPoints = selectFocusPoints(persona, mistakes);
  const avoidOverload = persona.learningStage === 'BEGINNER';

  return {
    tone,
    focusPoints,
    avoidOverload,
  };
}

function determineTone(persona: HumanPersona): TeachingTone {
  switch (persona.learningStage) {
    case 'BEGINNER':
      return 'ENCOURAGING';
    case 'INTERMEDIATE':
      return 'CAUTIOUS';
    case 'ADVANCED':
      return 'CHALLENGING';
    default:
      return 'DIRECT';
  }
}

function selectFocusPoints(persona: HumanPersona, mistakes: MistakePattern[]): string[] {
  const points: string[] = [];

  const sortedMistakes = [...mistakes].sort((a, b) => b.frequency - a.frequency);

  const maxPoints = persona.learningStage === 'BEGINNER' ? 2 : persona.learningStage === 'INTERMEDIATE' ? 3 : 4;

  for (let i = 0; i < Math.min(maxPoints, sortedMistakes.length); i++) {
    const mistake = sortedMistakes[i];
    points.push(generateFocusPoint(mistake, persona));
  }

  if (points.length === 0) {
    points.push(generateGeneralAdvice(persona));
  }

  return points;
}

function generateFocusPoint(mistake: MistakePattern, persona: HumanPersona): string {
  switch (mistake.id) {
    case 'greedy-efficiency':
      if (persona.learningStage === 'BEGINNER') {
        return '高效率不等于好决策，安全第一';
      } else if (persona.learningStage === 'INTERMEDIATE') {
        return '在高风险情况下，应权衡效率与安全性';
      } else {
        return '效率与风险的平衡是高阶技巧，需要根据局势动态调整';
      }

    case 'late-game-no-defense':
      if (persona.learningStage === 'BEGINNER') {
        return '后巡（10 巡后）应优先选择熟张';
      } else if (persona.learningStage === 'INTERMEDIATE') {
        return '后巡阶段防守意识需要加强，避免打生张';
      } else {
        return '后巡防守需要结合对手听牌推断，不仅仅是打熟张';
      }

    case 'early-meld':
      if (persona.learningStage === 'BEGINNER') {
        return '向听数较大时不要急于副露';
      } else {
        return '副露时机需要权衡速度与手牌灵活性';
      }

    case 'style-swing':
      if (persona.learningStage === 'BEGINNER') {
        return '保持决策风格一致，避免频繁切换';
      } else {
        return '风格切换应基于明确的局势变化，而非随意摇摆';
      }

    default:
      return mistake.description;
  }
}

function generateGeneralAdvice(persona: HumanPersona): string {
  switch (persona.playStyle) {
    case 'AGGRESSIVE':
      return '激进风格需要更强的风险控制能力';
    case 'DEFENSIVE':
      return '防守型打法也需要把握进攻时机';
    case 'ERRATIC':
      return '建立稳定的决策框架，减少随机性';
    case 'BALANCED':
      return '继续保持平衡，根据局势灵活调整';
    default:
      return '持续学习，逐步提升';
  }
}
