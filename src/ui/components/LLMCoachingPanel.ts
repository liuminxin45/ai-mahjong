/**
 * LLM实时指导面板组件
 * 在游戏中显示AI出牌建议
 */

import { llmService } from '../../llm';
import type { CoachingAdvice, GuidanceLevel } from '../../llm/types';
import type { GameState } from '../../core/model/state';
import type { Action } from '../../core/model/action';

let currentAdvice: CoachingAdvice | null = null;
let isLoading = false;
let guidanceLevel: GuidanceLevel = 'learning';

/**
 * 获取指导等级显示名称
 */
function getLevelName(level: GuidanceLevel): string {
  const names: Record<GuidanceLevel, string> = {
    beginner: '初学者',
    learning: '学习中',
    practicing: '练习中',
    advanced: '高级',
  };
  return names[level];
}

/**
 * 渲染LLM指导面板
 */
export function renderLLMCoachingPanel(
  state: GameState,
  legalActions: Action[],
  onRequestAdvice?: () => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'llm-coaching-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 400px;
    background: var(--bg-surface);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    z-index: 1000;
  `;

  // 头部
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
    color: white;
  `;

  const title = document.createElement('div');
  title.innerHTML = '🤖 <strong>AI助手</strong>';
  title.style.fontSize = '14px';

  const levelSelect = document.createElement('select');
  levelSelect.style.cssText = `
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  `;

  const levels: GuidanceLevel[] = ['beginner', 'learning', 'practicing', 'advanced'];
  for (const level of levels) {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = getLevelName(level);
    option.selected = level === guidanceLevel;
    levelSelect.appendChild(option);
  }

  levelSelect.onchange = () => {
    guidanceLevel = levelSelect.value as GuidanceLevel;
    currentAdvice = null;
  };

  header.appendChild(title);
  header.appendChild(levelSelect);
  panel.appendChild(header);

  // 内容区域
  const content = document.createElement('div');
  content.style.cssText = `
    padding: var(--sp-4);
    max-height: 300px;
    overflow-y: auto;
  `;

  if (isLoading) {
    content.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <div style="font-size: 24px; margin-bottom: 8px;">🔄</div>
        <div>正在分析局面...</div>
      </div>
    `;
  } else if (currentAdvice) {
    // 显示建议
    const adviceSection = document.createElement('div');

    // 推荐动作
    const recommendation = document.createElement('div');
    recommendation.style.cssText = `
      background: rgba(59, 166, 118, 0.15);
      border-radius: var(--r-md);
      padding: var(--sp-3);
      margin-bottom: var(--sp-3);
    `;
    recommendation.innerHTML = `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">推荐操作</div>
      <div style="font-size: 18px; font-weight: 600; color: var(--c-success);">
        ${formatAction(currentAdvice.recommendedAction)}
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
        置信度: ${(currentAdvice.confidence * 100).toFixed(0)}%
      </div>
    `;
    adviceSection.appendChild(recommendation);

    // 推理过程
    const reasoning = document.createElement('div');
    reasoning.style.cssText = `
      font-size: var(--fs-sm);
      line-height: 1.5;
      color: var(--text-secondary);
      margin-bottom: var(--sp-3);
    `;
    reasoning.textContent = currentAdvice.reasoning;
    adviceSection.appendChild(reasoning);

    // 风险评估
    const riskColors: Record<string, string> = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#f44336',
    };
    const risk = document.createElement('div');
    risk.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      margin-bottom: 12px;
    `;
    risk.innerHTML = `
      <span>放炮风险:</span>
      <span style="
        background: ${riskColors[currentAdvice.riskAssessment.dealInRisk]};
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
      ">${currentAdvice.riskAssessment.dealInRisk === 'low' ? '低' :
        currentAdvice.riskAssessment.dealInRisk === 'medium' ? '中' : '高'}</span>
    `;
    adviceSection.appendChild(risk);

    // 策略提示
    if (currentAdvice.strategicHints.length > 0) {
      const hints = document.createElement('div');
      hints.style.cssText = `
        background: rgba(212, 168, 67, 0.15);
        border-radius: var(--r-md);
        padding: var(--sp-3);
        font-size: var(--fs-xs);
        color: var(--text-secondary);
      `;
      hints.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">💡 策略提示</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${currentAdvice.strategicHints.map(h => `<li>${h}</li>`).join('')}
        </ul>
      `;
      adviceSection.appendChild(hints);
    }

    content.appendChild(adviceSection);
  } else {
    // 请求建议按钮
    const requestBtn = document.createElement('button');
    requestBtn.style.cssText = `
      width: 100%;
      padding: var(--sp-4);
      background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
      color: white;
      border: none;
      border-radius: var(--r-md);
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    `;
    requestBtn.textContent = '🎯 获取出牌建议';
    requestBtn.onmouseover = () => requestBtn.style.transform = 'scale(1.02)';
    requestBtn.onmouseout = () => requestBtn.style.transform = 'scale(1)';
    requestBtn.onclick = async () => {
      isLoading = true;
      updatePanel();

      try {
        currentAdvice = await llmService.getCoachingAdvice(
          state, 'P0', legalActions, guidanceLevel
        );
      } catch (e) {
        console.error('[LLM] Failed to get advice:', e);
      }

      isLoading = false;
      updatePanel();
      onRequestAdvice?.();
    };
    content.appendChild(requestBtn);

    // 说明文字
    const hint = document.createElement('div');
    hint.style.cssText = `
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 12px;
    `;
    hint.textContent = '点击获取AI分析和出牌建议';
    content.appendChild(hint);
  }

  panel.appendChild(content);

  // 更新面板的函数
  function updatePanel() {
    const parent = panel.parentElement;
    if (parent) {
      const newPanel = renderLLMCoachingPanel(state, legalActions, onRequestAdvice);
      newPanel.id = panel.id;
      parent.replaceChild(newPanel, panel);
    }
  }

  return panel;
}

/**
 * 格式化动作为显示文本
 */
function formatAction(action: Action): string {
  if (action.type === 'DISCARD') {
    const tile = (action as any).tile;
    if (tile) {
      const suitName = tile.suit === 'W' ? '万' : tile.suit === 'B' ? '条' : '筒';
      return `打 ${tile.rank}${suitName}`;
    }
  }

  const actionNames: Record<string, string> = {
    PASS: '过',
    PENG: '碰',
    GANG: '杠',
    HU: '胡',
    DRAW: '摸牌',
  };

  return actionNames[action.type] || action.type;
}

/**
 * 清除当前建议
 */
export function clearCoachingAdvice(): void {
  currentAdvice = null;
}

/**
 * 设置指导等级
 */
export function setGuidanceLevel(level: GuidanceLevel): void {
  guidanceLevel = level;
  currentAdvice = null;
}
