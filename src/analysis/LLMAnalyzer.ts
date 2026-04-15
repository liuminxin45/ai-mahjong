import { getEffectiveLLMConfig } from '../llm/browserConfig';
import type { DiscardRecommendation } from './HeuristicAnalyzer';
import type { MatchStat } from './statistics';
import type { MatchReport } from './matchReport';
import type { HumanPersona } from './humanPersona';
import type { MistakePattern } from './mistakePatterns';
import type { TeachingPlan } from './pedagogy';
import type { PopulationPersona } from './populationPersona';
import type { PopulationMistake } from './populationMistakes';
import type { LearningStep } from './learningRoadmap';
import type { TeachingOutcome } from './abTesting';

function normalizeOpenAICompatibleEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/messages')) return trimmed;
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export interface LLMAnalyzer {
  explainDecision(input: {
    recommendations: DiscardRecommendation[];
    stateSummary: string;
  }): Promise<string>;

  chat(input: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
  }): Promise<string>;

  chatStream?(input: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    onDelta: (delta: string) => void;
  }): Promise<string>;

  summarizeMatch(stat: MatchStat): Promise<string>;

  summarizeMatchReport(report: MatchReport): Promise<string>;

  explainForHuman(input: {
    persona: HumanPersona;
    mistakes: MistakePattern[];
    teachingPlan: TeachingPlan;
  }): Promise<string>;

  summarizePopulationInsights(input: {
    population: PopulationPersona;
    mistakes: PopulationMistake[];
    roadmap: LearningStep[];
    abResults: TeachingOutcome[];
  }): Promise<string>;
}

export type OpenAICompatibleConfig = {
  endpoint: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
};

export class OpenAICompatibleLLMAnalyzer implements LLMAnalyzer {
  private readonly cfg: OpenAICompatibleConfig & { timeoutMs: number };

  constructor(cfg: OpenAICompatibleConfig) {
    this.cfg = {
      ...cfg,
      endpoint: normalizeOpenAICompatibleEndpoint(cfg.endpoint),
      timeoutMs: cfg.timeoutMs ?? 15000,
    };
  }

  async chat(input: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
  }): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(true),
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: input.system ?? 'You are a rigorous Chengdu Mahjong coach.' },
            ...input.messages,
          ],
          temperature: 0.2,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async chatStream(input: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    onDelta: (delta: string) => void;
  }): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(false),
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: input.system ?? 'You are a rigorous Chengdu Mahjong coach.' },
            ...input.messages,
          ],
          temperature: 0.2,
          stream: true,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      if (!res.body) {
        const txt = await this.chat({ messages: input.messages, system: input.system });
        input.onDelta(txt);
        return txt;
      }

      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const nl = buffer.indexOf('\n');
          if (nl === -1) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);

          if (!line.startsWith('data:')) continue;
          const payload = line.slice('data:'.length).trim();
          if (!payload) continue;
          if (payload === '[DONE]') {
            return full.trim();
          }

          let data: any;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta: unknown = data?.choices?.[0]?.delta?.content ?? data?.choices?.[0]?.message?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta;
            input.onDelta(delta);
          }
        }
      }

      return full.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async explainDecision(input: {
    recommendations: DiscardRecommendation[];
    stateSummary: string;
  }): Promise<string> {
    const lines: string[] = [];
    lines.push('你是一个成都麻将教练。');
    lines.push(`当前局况：${input.stateSummary}`);
    lines.push('');
    lines.push('候选出牌：');

    for (let i = 0; i < input.recommendations.length; i++) {
      const r = input.recommendations[i];
      const reasons = r.dangerReasons.length > 0 ? `（${r.dangerReasons.join('，')}）` : '';
      lines.push(
        `${i + 1}. ${r.discard}：向听 ${r.shantenBefore}→${r.shantenAfter}，有效牌 ${r.ukeireTotal}，风险 ${r.dangerLevel}${reasons}`,
      );
    }

    lines.push('');
    lines.push('请用简洁、可操作的语言解释：');
    lines.push('- 为什么更推荐更安全的选择（如果存在）');
    lines.push('- 以及“效率高但风险更大”的权衡点');

    const prompt = lines.join('\n');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一个严谨的麻将战术教练。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async summarizeMatch(stat: MatchStat): Promise<string> {
    const lines: string[] = [];
    lines.push('你是一个成都麻将教练。');
    lines.push('请根据本局的风格切换与关键出牌，给出"风格级复盘总结"。');
    lines.push('要求：');
    lines.push('- 不逐步复述每一步，而是总结风格变化是否及时、关键失误点与可改进点');
    lines.push('- 用 6~12 句话，尽量给出具体建议（例如：第 N 巡更早防守）');
    lines.push('');

    if (stat.decisions.length === 0) {
      lines.push('本局没有记录到 AI 的出牌决策（decisions 为空）。');
    } else {
      lines.push(`对局结果：${stat.result ?? '未知'}`);
      lines.push('关键决策：');
      for (const d of stat.decisions.slice(0, 40)) {
        lines.push(
          `- 第 ${d.turn} 巡：风格 ${d.style}，打 ${d.discard}，向听 ${d.shantenBefore}->${d.shantenAfter}，风险 ${d.dangerLevel}`,
        );
      }
    }

    const prompt = lines.join('\n');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(false),
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一个严谨的麻将战术教练。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async summarizeMatchReport(report: MatchReport): Promise<string> {
    const lines: string[] = [];
    lines.push('你是一个成都麻将教练，现在需要对多盘对局进行"教练级总结"。');
    lines.push('');
    lines.push('多盘统计数据：');
    lines.push(`- 总盘数：${report.statistics.totalRounds}`);
    lines.push(`- 胜率：${(report.statistics.winRate * 100).toFixed(1)}%`);
    lines.push(`- 失败率：${(report.statistics.loseRate * 100).toFixed(1)}%`);
    lines.push(`- 流局率：${(report.statistics.drawRate * 100).toFixed(1)}%`);
    lines.push(`- 平均风险：${report.statistics.avgRiskTaken.toFixed(2)}`);
    lines.push(`- 主要风格：${report.statistics.dominantStyle}`);
    lines.push('');

    if (report.highlights.length > 0) {
      lines.push('关键发现：');
      for (const h of report.highlights) {
        lines.push(`- ${h}`);
      }
      lines.push('');
    }

    if (report.adjustments.length > 0) {
      lines.push('策略调整记录：');
      for (const a of report.adjustments) {
        lines.push(`- ${a}`);
      }
      lines.push('');
    }

    lines.push('请用 8~15 句话给出教练级总结，包括：');
    lines.push('1. 整体表现评价（进攻/防守平衡、风格切换是否合理）');
    lines.push('2. 主要问题点（如：过度进攻导致失败、过度保守导致流局）');
    lines.push('3. 策略调整是否及时有效');
    lines.push('4. 针对性建议（如：面对特定对手应更早防守）');

    const prompt = lines.join('\n');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(false),
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一个资深的麻将战术教练，擅长从多盘对局中总结规律和给出改进建议。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async explainForHuman(input: {
    persona: HumanPersona;
    mistakes: MistakePattern[];
    teachingPlan: TeachingPlan;
  }): Promise<string> {
    const lines: string[] = [];
    lines.push('你是一名耐心的麻将教练，需要根据玩家特点给出个性化建议。');
    lines.push('');
    lines.push('玩家画像：');
    lines.push(`- 风格：${translatePlayStyle(input.persona.playStyle)}`);
    lines.push(`- 学习阶段：${translateLearningStage(input.persona.learningStage)}`);
    lines.push(`- 风险承受度：${(input.persona.riskTolerance * 100).toFixed(0)}%`);
    lines.push(`- 防守意识：${(input.persona.defenseAwareness * 100).toFixed(0)}%`);
    lines.push('');

    if (input.mistakes.length > 0) {
      lines.push('主要问题：');
      for (const m of input.mistakes) {
        lines.push(`- ${m.description}（频率 ${(m.frequency * 100).toFixed(1)}%）`);
      }
      lines.push('');
    }

    lines.push('教学目标：');
    for (const fp of input.teachingPlan.focusPoints) {
      lines.push(`- ${fp}`);
    }
    lines.push('');

    const toneInstruction = getToneInstruction(input.teachingPlan.tone);
    lines.push(`请用${toneInstruction}的语气给出改进建议。`);

    if (input.teachingPlan.avoidOverload) {
      lines.push('注意：玩家是新手，避免一次讲太多，重点突出 1-2 个核心要点。');
    }

    const prompt = lines.join('\n');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(false),
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一个经验丰富的麻将教练，擅长根据不同学员的特点给出针对性建议。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  async summarizePopulationInsights(input: {
    population: PopulationPersona;
    mistakes: PopulationMistake[];
    roadmap: LearningStep[];
    abResults: TeachingOutcome[];
  }): Promise<string> {
    const lines: string[] = [];
    lines.push('你是一个麻将教学产品顾问，需要基于群体数据给出教学洞察。');
    lines.push('');
    lines.push('群体画像分析：');
    lines.push(`- 样本量：${input.population.sampleSize} 位玩家${input.population.isStableSample ? '（稳定样本）' : '（样本较小，结论仅供参考）'}`);
    lines.push(`- 平均风险承受度：${(input.population.avgRiskTolerance * 100).toFixed(0)}%`);
    lines.push(`- 平均效率倾向：${(input.population.avgEfficiencyBias * 100).toFixed(0)}%`);
    lines.push(`- 平均防守意识：${(input.population.avgDefenseAwareness * 100).toFixed(0)}%`);
    lines.push('');

    if (Object.keys(input.population.styleDistribution).length > 0) {
      lines.push('风格分布：');
      for (const [style, ratio] of Object.entries(input.population.styleDistribution)) {
        lines.push(`- ${translatePlayStyle(style)}：${(ratio * 100).toFixed(0)}%`);
      }
      lines.push('');
    }

    if (input.mistakes.length > 0) {
      lines.push('高频共性错误：');
      for (const m of input.mistakes.slice(0, 5)) {
        const severity = m.severity === 'HIGH' ? '【高频】' : m.severity === 'MEDIUM' ? '【常见】' : '';
        lines.push(`- ${severity}${m.description}（出现率 ${(m.prevalence * 100).toFixed(0)}%）`);
      }
      lines.push('');
    }

    if (input.abResults.length > 0) {
      lines.push('教学实验效果：');
      for (const result of input.abResults) {
        const improvement = (result.improvement * 100).toFixed(1);
        lines.push(`- ${result.variantId}：高风险率从 ${(result.beforeRiskRate * 100).toFixed(1)}% 降至 ${(result.afterRiskRate * 100).toFixed(1)}%（改进 ${improvement}%）`);
      }
      lines.push('');
    }

    if (input.roadmap.length > 0) {
      lines.push('推荐学习路径（优先级排序）：');
      for (let i = 0; i < Math.min(5, input.roadmap.length); i++) {
        const step = input.roadmap[i];
        lines.push(`${i + 1}. ${step.topic} - ${step.reason}`);
      }
      lines.push('');
    }

    lines.push('请总结主要教学洞察，包括：');
    lines.push('1. 群体特征分析（主要问题是什么）');
    lines.push('2. 教学策略建议（哪种方式更有效）');
    lines.push('3. 下一阶段重点（应该优先解决什么）');
    lines.push('4. 产品优化方向（如何改进教学体验）');

    const prompt = lines.join('\n');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一个资深的麻将教学产品顾问，擅长从群体数据中提取教学洞察并给出产品优化建议。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`LLM HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content ?? data?.content?.[0]?.text;
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('LLM empty response');
      }
      return text.trim();
    } finally {
      clearTimeout(t);
    }
  }

  private buildHeaders(includeAccept: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (includeAccept) {
      headers.accept = 'text/event-stream';
    }

    if (this.cfg.apiKey) {
      headers.authorization = `Bearer ${this.cfg.apiKey}`;
    }

    return headers;
  }
}

function translatePlayStyle(style: string): string {
  switch (style) {
    case 'AGGRESSIVE': return '激进型';
    case 'DEFENSIVE': return '防守型';
    case 'ERRATIC': return '不稳定';
    case 'BALANCED': return '平衡型';
    default: return style;
  }
}

function translateLearningStage(stage: string): string {
  switch (stage) {
    case 'BEGINNER': return '新手';
    case 'INTERMEDIATE': return '中级';
    case 'ADVANCED': return '高级';
    default: return stage;
  }
}

function getToneInstruction(tone: string): string {
  switch (tone) {
    case 'ENCOURAGING': return '鼓励但明确';
    case 'CAUTIOUS': return '谨慎且详细';
    case 'CHALLENGING': return '挑战性且深入';
    case 'DIRECT': return '直接且简洁';
    default: return '友好';
  }
}

export function createBrowserLLMAnalyzerFromStorage(): LLMAnalyzer | null {
  const config = getEffectiveLLMConfig();
  const endpoint = config.baseUrl?.trim();
  const apiKey = config.apiKey?.trim();
  const model = config.model?.trim();

  if (!endpoint || !model) return null;

  return new OpenAICompatibleLLMAnalyzer({ endpoint, apiKey, model });
}
