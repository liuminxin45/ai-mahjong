/**
 * 对局复盘面板
 * 显示单局游戏的详细分析和改进建议
 */

import { llmService } from '../../llm';
import type { GameReview, GameRecord, KeyMoment } from '../../llm/types';

/**
 * 渲染对局复盘面板
 */
export async function renderGameReviewPanel(
  gameRecord: GameRecord,
  onClose?: () => void
): Promise<HTMLElement> {
  const panel = document.createElement('div');
  panel.className = 'game-review-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    max-width: 95vw;
    max-height: 90vh;
    background: var(--bg-surface);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    z-index: 2000;
    display: flex;
    flex-direction: column;
  `;

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  // Header gradient based on result
  const gradients: Record<string, string> = {
    win: 'linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%)',
    lose: 'linear-gradient(135deg, var(--c-danger) 0%, #f45c43 100%)',
    draw: 'linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)',
  };

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-5) var(--sp-6);
    background: ${gradients[gameRecord.result] || gradients.draw};
    color: white;
  `;

  const resultLabels: Record<string, string> = {
    win: '🏆 胜利',
    lose: '😢 失败',
    draw: '🤝 流局',
  };

  const title = document.createElement('div');
  title.innerHTML = `
    <div style="font-size: 20px; font-weight: 600;">${resultLabels[gameRecord.result]}</div>
    <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
      ${new Date(gameRecord.timestamp).toLocaleString()} · 得分 ${gameRecord.score >= 0 ? '+' : ''}${gameRecord.score}
    </div>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
  `;
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => {
    overlay.remove();
    panel.remove();
    onClose?.();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // 内容区域
  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-6);
  `;

  // Loading state
  content.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="font-size: 32px; margin-bottom: 16px;">🔄</div>
      <div style="color: var(--text-muted);">正在分析对局...</div>
    </div>
  `;

  panel.appendChild(content);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // 异步加载复盘分析
  try {
    const review = await generateReview(gameRecord);
    renderReviewContent(content, review, gameRecord);
  } catch (e) {
    console.error('[GameReview] Failed to generate:', e);
    content.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #f44336;">
        <div style="font-size: 32px; margin-bottom: 16px;">❌</div>
        <div>分析生成失败，请稍后重试</div>
      </div>
    `;
  }

  return panel;
}

/**
 * 生成复盘分析
 */
async function generateReview(gameRecord: GameRecord): Promise<GameReview> {
  // 提取关键决策点（简化实现）
  const keyDecisions: Array<{ turn: number; action: any; state: any }> = [];

  if (gameRecord.replay?.events) {
    // 采样关键回合
    const events = gameRecord.replay.events.filter(e => e.playerId === 'P0');
    const sampleIndices = [0, Math.floor(events.length / 3), Math.floor(events.length * 2 / 3), events.length - 1];

    for (const idx of sampleIndices) {
      if (events[idx]) {
        keyDecisions.push({
          turn: events[idx].turn,
          action: events[idx].action,
          state: events[idx].state,
        });
      }
    }
  }

  return await llmService.generateReview(gameRecord, keyDecisions);
}

/**
 * 渲染复盘内容
 */
function renderReviewContent(
  container: HTMLElement,
  review: GameReview,
  gameRecord: GameRecord
): void {
  container.innerHTML = '';

  // 评分卡片
  const scoreCard = document.createElement('div');
  scoreCard.style.cssText = `
    display: flex;
    align-items: center;
    gap: 24px;
    background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-light) 100%);
    border-radius: var(--r-lg);
    padding: var(--sp-6);
    color: white;
    margin-bottom: var(--sp-6);
  `;

  const gradeColors: Record<string, string> = {
    S: '#ffd700',
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    D: '#f44336',
  };

  scoreCard.innerHTML = `
    <div style="
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${gradeColors[review.overallAssessment.grade] || '#666'};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    ">${review.overallAssessment.grade}</div>
    <div style="flex: 1;">
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">综合评分</div>
      <div style="font-size: 32px; font-weight: 600;">${review.overallAssessment.score}<span style="font-size: 16px;">/100</span></div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; opacity: 0.8;">对局统计</div>
      <div style="font-size: 14px; margin-top: 4px;">
        放炮: ${gameRecord.stats?.dealInCount || 0} 次<br>
        副露: ${gameRecord.stats?.meldCount || 0} 次
      </div>
    </div>
  `;
  container.appendChild(scoreCard);

  // 优缺点分析
  const analysisGrid = document.createElement('div');
  analysisGrid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
    margin-bottom: var(--sp-6);
  `;

  // 优点
  const strengthsCard = document.createElement('div');
  strengthsCard.style.cssText = `
    background: rgba(59, 166, 118, 0.15);
    border-radius: var(--r-lg);
    padding: var(--sp-4);
  `;
  strengthsCard.innerHTML = `
    <div style="font-weight: 600; color: var(--c-success); margin-bottom: 12px;">✅ 做得好的方面</div>
    <ul style="margin: 0; padding-left: 20px; color: var(--text-primary); line-height: 1.8;">
      ${review.overallAssessment.strengths.length > 0
      ? review.overallAssessment.strengths.map(s => `<li>${s}</li>`).join('')
      : '<li>继续保持！</li>'}
    </ul>
  `;

  // 缺点
  const weaknessesCard = document.createElement('div');
  weaknessesCard.style.cssText = `
    background: rgba(232, 78, 78, 0.15);
    border-radius: var(--r-lg);
    padding: var(--sp-4);
  `;
  weaknessesCard.innerHTML = `
    <div style="font-weight: 600; color: var(--c-danger); margin-bottom: 12px;">⚠️ 需要改进的方面</div>
    <ul style="margin: 0; padding-left: 20px; color: var(--text-primary); line-height: 1.8;">
      ${review.overallAssessment.weaknesses.length > 0
      ? review.overallAssessment.weaknesses.map(w => `<li>${w}</li>`).join('')
      : '<li>表现不错！</li>'}
    </ul>
  `;

  analysisGrid.appendChild(strengthsCard);
  analysisGrid.appendChild(weaknessesCard);
  container.appendChild(analysisGrid);

  // 关键时刻分析
  if (review.keyMoments && review.keyMoments.length > 0) {
    const momentsSection = document.createElement('div');
    momentsSection.style.marginBottom = 'var(--sp-6)';

    const momentsTitle = document.createElement('div');
    momentsTitle.style.cssText = `
      font-weight: var(--fw-semibold);
      font-size: var(--fs-lg);
      color: var(--text-primary);
      margin-bottom: var(--sp-4);
    `;
    momentsTitle.textContent = '🎯 关键时刻分析';
    momentsSection.appendChild(momentsTitle);

    for (const moment of review.keyMoments) {
      momentsSection.appendChild(renderKeyMoment(moment));
    }

    container.appendChild(momentsSection);
  }

  // 改进建议
  const improvementsSection = document.createElement('div');
  improvementsSection.style.cssText = `
    background: rgba(212, 168, 67, 0.15);
    border-radius: var(--r-lg);
    padding: var(--sp-5);
  `;
  improvementsSection.innerHTML = `
    <div style="font-weight: 600; color: var(--c-accent); margin-bottom: 12px;">💡 改进建议</div>
    <ol style="margin: 0; padding-left: 24px; color: var(--text-primary); line-height: 2;">
      ${review.improvements.map(i => `<li>${i}</li>`).join('')}
    </ol>
  `;
  container.appendChild(improvementsSection);

  // 技能雷达图（简化文字版）
  const skillsSection = document.createElement('div');
  skillsSection.style.cssText = `
    margin-top: var(--sp-6);
    background: var(--bg-hover);
    border-radius: var(--r-lg);
    padding: var(--sp-5);
  `;

  const skills = review.statistics;
  skillsSection.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 16px;">📊 技能评估</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
      ${renderSkillBar('进攻效率', skills.efficiency)}
      ${renderSkillBar('防守意识', skills.defense)}
      ${renderSkillBar('时机把握', skills.timing)}
    </div>
  `;
  container.appendChild(skillsSection);
}

/**
 * 渲染关键时刻卡片
 */
function renderKeyMoment(moment: KeyMoment): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = `
    background: var(--bg-surface);
    border-radius: var(--r-md);
    border: 1px solid var(--border-subtle);
    padding: var(--sp-4);
    margin-bottom: var(--sp-3);
  `;

  const impactColors: Record<string, string> = {
    critical: '#f44336',
    significant: '#ff9800',
    minor: '#4caf50',
  };

  const impactLabels: Record<string, string> = {
    critical: '关键',
    significant: '重要',
    minor: '一般',
  };

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-weight: 600; color: var(--text-primary);">第 ${moment.turn} 轮</span>
      <span style="
        background: ${impactColors[moment.impact]}20;
        color: ${impactColors[moment.impact]};
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      ">${impactLabels[moment.impact]}</span>
    </div>
    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">${moment.situation}</div>
    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
      <div><strong>你的操作:</strong> ${moment.playerAction}</div>
      <div><strong>建议操作:</strong> <span style="color: var(--c-success);">${moment.optimalAction}</span></div>
    </div>
    <div style="background: var(--bg-hover); border-radius: 4px; padding: 8px; font-size: 13px; color: var(--text-primary);">
      ${moment.analysis}
    </div>
    <div style="margin-top: 8px; font-size: 12px; color: var(--c-primary-light);">
      📝 ${moment.lesson}
    </div>
  `;

  return card;
}

/**
 * 渲染技能进度条
 */
function renderSkillBar(name: string, value: number): string {
  const percentage = Math.round(value * 100);
  const color = percentage >= 70 ? 'var(--c-success)' : percentage >= 40 ? 'var(--c-accent)' : 'var(--c-danger)';

  return `
    <div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
        <span>${name}</span>
        <span style="font-weight: 600;">${percentage}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${percentage}%; background: ${color};"></div>
      </div>
    </div>
  `;
}

/**
 * 快速复盘当前对局
 */
export async function quickReview(gameRecord: GameRecord): Promise<void> {
  await renderGameReviewPanel(gameRecord);
}
