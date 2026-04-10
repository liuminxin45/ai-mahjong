/**
 * AI参数面板组件
 * 用于显示和调整AI参数
 */

import { loadParams } from '../../training/paramPersistence';
import { getLearningStats } from '../../training/onlineLearning';

/**
 * 计算AI能力评分 (0-100)
 */
function calculateAICapability(): number {
  try {
    const paramsFile = loadParams();
    const trainingState = paramsFile.trainingState;
    const learningStats = getLearningStats();

    // 基础分数：基于训练步数 (0-30分)
    const stepScore = Math.min(30, (trainingState.currentStep / 1000) * 30);

    // 胜率分数 (0-40分)
    const winRateScore = learningStats.winRate * 40;

    // 训练质量分数 (0-30分)
    let qualityScore = 0;
    if (trainingState.bestFitness && trainingState.bestFitness !== -Infinity && trainingState.bestFitness !== -999999 && trainingState.bestFitness > -999999) {
      // 归一化fitness到0-30分
      const normalizedFitness = Math.max(0, Math.min(1, (trainingState.bestFitness + 1000) / 2000));
      qualityScore = normalizedFitness * 30;
    }

    const totalScore = Math.round(stepScore + winRateScore + qualityScore);
    return Math.min(100, Math.max(0, totalScore));
  } catch (e) {
    console.error('[AICapability] Failed to calculate:', e);
    return 50; // 默认中等水平
  }
}

/**
 * 渲染AI参数按钮（用于头部控制栏）
 */
export function renderAIParamsButton(): HTMLElement {
  const btn = document.createElement('button');
  const capability = calculateAICapability();
  btn.className = capability >= 70 ? 'btn btn-success btn-sm' : capability >= 40 ? 'btn btn-accent btn-sm' : 'btn btn-danger btn-sm';
  btn.textContent = `🤖 AI ${capability}/100`;
  btn.title = `AI capability score: ${capability}/100`;

  btn.onclick = () => {
    const panel = document.getElementById('ai-params-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      if (isVisible) {
        panel.style.display = 'none';
      } else {
        const newPanel = renderAIParamsPanel();
        newPanel.style.display = 'block';
        if (panel.parentNode) {
          panel.replaceWith(newPanel);
        } else {
          document.body.appendChild(newPanel);
        }
      }
    }
  };

  return btn;
}

/**
 * 渲染AI参数面板（可折叠的侧边面板）
 */
export function renderAIParamsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'ai-params-panel';
  panel.style.cssText = `
    position:fixed; top:60px; right:10px; width:360px;
    max-height:calc(100vh - 80px); z-index:1000; display:none;
    overflow:hidden; border-radius:var(--r-lg);
    background:var(--bg-surface); border:1px solid var(--border-default);
    box-shadow:var(--shadow-xl);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    padding:var(--sp-3) var(--sp-4); background:var(--c-primary);
    color:white; font-weight:var(--fw-semibold);
  `;

  const title = document.createElement('span');
  title.textContent = '⚙️ AI Parameters';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-icon';
  closeBtn.style.cssText = 'color:white; background:none; border:none; font-size:18px;';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => { panel.style.display = 'none'; };

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Content
  const content = document.createElement('div');
  content.style.cssText = 'padding:var(--sp-4); max-height:calc(100vh - 160px); overflow-y:auto;';

  // 加载当前参数
  const paramsFile = loadParams();
  const params = paramsFile.params;
  const trainingState = paramsFile.trainingState;
  const learningStats = getLearningStats();
  const capability = calculateAICapability();

  // AI capability card
  const capabilityCard = document.createElement('div');
  capabilityCard.style.cssText = `
    margin-bottom:var(--sp-4); padding:var(--sp-4);
    background:linear-gradient(135deg, var(--c-primary) 0%, var(--c-accent) 100%);
    border-radius:var(--r-md); color:white; text-align:center;
  `;

  const capabilityScore = document.createElement('div');
  capabilityScore.style.cssText = 'font-size:36px; font-weight:var(--fw-bold); margin-bottom:4px;';
  capabilityScore.textContent = `${capability}/100`;

  const capabilityLabel = document.createElement('div');
  capabilityLabel.style.cssText = 'font-size:var(--fs-sm); opacity:0.9;';
  capabilityLabel.textContent = 'AI Capability Score';

  capabilityCard.appendChild(capabilityScore);
  capabilityCard.appendChild(capabilityLabel);
  content.appendChild(capabilityCard);

  // Training stats summary
  const statsSummary = document.createElement('div');
  statsSummary.className = 'card';
  statsSummary.style.cssText += 'margin-bottom:var(--sp-4); font-size:var(--fs-sm);';

  const statsTitle = document.createElement('div');
  statsTitle.style.cssText = 'font-weight:var(--fw-semibold); margin-bottom:var(--sp-2); color:var(--text-primary);';
  statsTitle.textContent = '📊 Training Stats';

  const bestFitness = !trainingState.bestFitness || trainingState.bestFitness === -Infinity || trainingState.bestFitness === -999999 || trainingState.bestFitness === null
    ? 'N/A'
    : trainingState.bestFitness.toFixed(0);

  const acceptRate = trainingState.acceptCount + trainingState.rejectCount > 0
    ? ((trainingState.acceptCount / (trainingState.acceptCount + trainingState.rejectCount)) * 100).toFixed(1) + '%'
    : 'N/A';

  const statsContent = document.createElement('div');
  statsContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:4px 0; border-bottom:1px solid var(--border-subtle);">
      <span style="color:var(--text-muted);">Training Steps</span>
      <span style="font-weight:var(--fw-semibold); color:var(--text-primary);">${trainingState.currentStep}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:4px 0; border-bottom:1px solid var(--border-subtle);">
      <span style="color:var(--text-muted);">Best Fitness</span>
      <span style="font-weight:var(--fw-semibold); color:var(--text-primary);">${bestFitness}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:4px 0; border-bottom:1px solid var(--border-subtle);">
      <span style="color:var(--text-muted);">Accept Rate</span>
      <span style="font-weight:var(--fw-semibold); color:var(--text-primary);">${acceptRate}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:4px 0; border-bottom:1px solid var(--border-subtle);">
      <span style="color:var(--text-muted);">Games Played</span>
      <span style="font-weight:var(--fw-semibold); color:var(--text-primary);">${learningStats.gamesPlayed}</span>
    </div>
    <div style="display:flex; justify-content:space-between; margin:6px 0; padding:4px 0;">
      <span style="color:var(--text-muted);">AI Win Rate</span>
      <span style="font-weight:var(--fw-semibold); color:${learningStats.winRate >= 0.3 ? 'var(--c-success)' : 'var(--c-danger)'};">${(learningStats.winRate * 100).toFixed(1)}%</span>
    </div>
  `;

  statsSummary.appendChild(statsTitle);
  statsSummary.appendChild(statsContent);
  content.appendChild(statsSummary);

  // 参数列表（可折叠）
  const paramsSection = document.createElement('div');
  paramsSection.style.marginBottom = '16px';

  const paramsHeader = document.createElement('div');
  paramsHeader.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    padding:var(--sp-2) var(--sp-3); background:var(--bg-hover);
    border-radius:var(--r-md); cursor:pointer; user-select:none;
  `;

  const paramsTitle = document.createElement('div');
  paramsTitle.style.cssText = 'font-weight:var(--fw-semibold); color:var(--text-primary);';
  paramsTitle.textContent = '🎛️ Parameter Details';

  const toggleIcon = document.createElement('span');
  toggleIcon.textContent = '▼';
  toggleIcon.style.cssText = 'font-size:12px; transition:transform 0.2s;';

  paramsHeader.appendChild(paramsTitle);
  paramsHeader.appendChild(toggleIcon);
  paramsSection.appendChild(paramsHeader);

  const paramsList = document.createElement('div');
  paramsList.style.cssText = 'font-size:var(--fs-xs); margin-top:var(--sp-2); display:none;';

  // 点击切换折叠
  paramsHeader.onclick = () => {
    const isExpanded = paramsList.style.display !== 'none';
    paramsList.style.display = isExpanded ? 'none' : 'block';
    toggleIcon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
  };

  // 分类显示参数
  const categories: Record<string, string[]> = {
    'Shanten & Stage': ['xiangtingBase', 'pimproveNStageA', 'pimproveNStageB', 'stageFactorB'],
    'Risk & Defense': ['basePloseScale', 'stageFactorPloseB', 'stageFactorPloseC', 'genbutsuRiskScale', 'dingQueRiskScale', 'turnRiskFactor'],
    'Value & Score': ['baseWinValue', 'speedBonusK', 'firstWinBonus', 'baseLoss'],
    'Meld Penalties': ['informationPenaltyPengA', 'informationPenaltyPengB', 'informationPenaltyGangA', 'informationPenaltyGangB'],
    'Multipliers': ['stageMultiplierA', 'stageMultiplierB', 'stageMultiplierC', 'oppNotHuMultiplier'],
  };

  for (const [category, keys] of Object.entries(categories)) {
    const categoryDiv = document.createElement('div');
    categoryDiv.style.marginBottom = 'var(--sp-3)';

    const categoryTitle = document.createElement('div');
    categoryTitle.style.cssText = `
      font-weight:var(--fw-semibold); font-size:10px; color:var(--text-muted);
      margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;
    `;
    categoryTitle.textContent = category;
    categoryDiv.appendChild(categoryTitle);

    for (const key of keys) {
      if (key in params) {
        const paramRow = document.createElement('div');
        paramRow.style.cssText = `
          display:flex; justify-content:space-between;
          padding:4px var(--sp-2); background:var(--bg-hover);
          margin-bottom:2px; border-radius:var(--r-sm);
        `;

        const keySpan = document.createElement('span');
        keySpan.style.color = 'var(--text-secondary)';
        keySpan.textContent = key;

        const valueSpan = document.createElement('span');
        const value = (params as any)[key];
        valueSpan.textContent = typeof value === 'number'
          ? (Number.isInteger(value) ? value.toString() : value.toFixed(4))
          : String(value);
        valueSpan.style.cssText = 'font-family:monospace; font-weight:var(--fw-semibold); color:var(--text-primary);';

        paramRow.appendChild(keySpan);
        paramRow.appendChild(valueSpan);
        categoryDiv.appendChild(paramRow);
      }
    }

    paramsList.appendChild(categoryDiv);
  }

  paramsSection.appendChild(paramsList);
  content.appendChild(paramsSection);

  // Action buttons
  const actions = document.createElement('div');
  actions.style.cssText = 'margin-top:var(--sp-4); display:flex; gap:var(--sp-2);';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-danger btn-sm';
  resetBtn.style.flex = '1';
  resetBtn.textContent = '🔄 Reset to Default';

  resetBtn.onclick = () => {
    if (confirm('Reset all AI parameters to default values?')) {
      const { resetParams } = require('../../training/paramPersistence');
      resetParams();
      alert('Parameters reset. Please refresh the page.');
    }
  };

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-success btn-sm';
  exportBtn.style.flex = '1';
  exportBtn.textContent = '📋 Export';

  exportBtn.onclick = () => {
    const json = JSON.stringify(paramsFile, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      exportBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        exportBtn.textContent = '📋 Export';
      }, 2000);
    });
  };

  actions.appendChild(resetBtn);
  actions.appendChild(exportBtn);
  content.appendChild(actions);

  panel.appendChild(header);
  panel.appendChild(content);

  return panel;
}
