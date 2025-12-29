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
  btn.textContent = `🤖 AI ${capability}/100`;
  btn.style.padding = '6px 12px';
  btn.style.backgroundColor = capability >= 70 ? '#28a745' : capability >= 40 ? '#ffc107' : '#dc3545';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '14px';
  btn.style.fontWeight = '600';
  btn.title = `AI能力评分: ${capability}/100 (点击查看详情)`;
  
  btn.onclick = () => {
    const panel = document.getElementById('ai-params-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      if (isVisible) {
        // 隐藏面板
        panel.style.display = 'none';
      } else {
        // 显示面板并更新数据
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
  panel.style.position = 'fixed';
  panel.style.top = '60px';
  panel.style.right = '10px';
  panel.style.width = '360px';
  panel.style.maxHeight = 'calc(100vh - 80px)';
  panel.style.backgroundColor = '#fff';
  panel.style.border = '1px solid #ddd';
  panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
  panel.style.zIndex = '1000';
  panel.style.display = 'none';
  panel.style.overflow = 'hidden';
  panel.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  
  // 头部
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '12px 16px';
  header.style.backgroundColor = '#4a90e2';
  header.style.color = '#fff';
  header.style.fontWeight = '600';
  
  const title = document.createElement('span');
  title.textContent = '⚙️ AI Parameters';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => {
    panel.style.display = 'none';
  };
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 内容区域
  const content = document.createElement('div');
  content.style.padding = '16px';
  content.style.maxHeight = 'calc(100vh - 160px)';
  content.style.overflowY = 'auto';
  
  // 加载当前参数
  const paramsFile = loadParams();
  const params = paramsFile.params;
  const trainingState = paramsFile.trainingState;
  const learningStats = getLearningStats();
  const capability = calculateAICapability();
  
  // AI能力评分卡片
  const capabilityCard = document.createElement('div');
  capabilityCard.style.marginBottom = '16px';
  capabilityCard.style.padding = '16px';
  capabilityCard.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  capabilityCard.style.borderRadius = '8px';
  capabilityCard.style.color = 'white';
  capabilityCard.style.textAlign = 'center';
  
  const capabilityScore = document.createElement('div');
  capabilityScore.style.fontSize = '36px';
  capabilityScore.style.fontWeight = '700';
  capabilityScore.style.marginBottom = '4px';
  capabilityScore.textContent = `${capability}/100`;
  
  const capabilityLabel = document.createElement('div');
  capabilityLabel.style.fontSize = '13px';
  capabilityLabel.style.opacity = '0.9';
  capabilityLabel.textContent = 'AI 能力评分';
  
  capabilityCard.appendChild(capabilityScore);
  capabilityCard.appendChild(capabilityLabel);
  content.appendChild(capabilityCard);
  
  // 训练状态摘要
  const statsSummary = document.createElement('div');
  statsSummary.style.marginBottom = '16px';
  statsSummary.style.padding = '12px';
  statsSummary.style.backgroundColor = '#f8f9fa';
  statsSummary.style.borderRadius = '8px';
  statsSummary.style.fontSize = '13px';
  
  const statsTitle = document.createElement('div');
  statsTitle.textContent = '📊 训练统计';
  statsTitle.style.fontWeight = '600';
  statsTitle.style.marginBottom = '8px';
  statsTitle.style.color = '#333';
  
  const bestFitness = !trainingState.bestFitness || trainingState.bestFitness === -Infinity || trainingState.bestFitness === -999999 || trainingState.bestFitness === null
    ? 'N/A' 
    : trainingState.bestFitness.toFixed(0);
  
  const acceptRate = trainingState.acceptCount + trainingState.rejectCount > 0 
    ? ((trainingState.acceptCount / (trainingState.acceptCount + trainingState.rejectCount)) * 100).toFixed(1) + '%'
    : 'N/A';
  
  const statsContent = document.createElement('div');
  statsContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
      <span style="color: #666;">训练步数</span>
      <span style="font-weight: 600; color: #333;">${trainingState.currentStep}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
      <span style="color: #666;">最佳适应度</span>
      <span style="font-weight: 600; color: #333;">${bestFitness}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
      <span style="color: #666;">接受率</span>
      <span style="font-weight: 600; color: #333;">${acceptRate}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef;">
      <span style="color: #666;">对局数</span>
      <span style="font-weight: 600; color: #333;">${learningStats.gamesPlayed}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 4px 0;">
      <span style="color: #666;">AI胜率</span>
      <span style="font-weight: 600; color: ${learningStats.winRate >= 0.3 ? '#28a745' : '#dc3545'};">${(learningStats.winRate * 100).toFixed(1)}%</span>
    </div>
  `;
  
  statsSummary.appendChild(statsTitle);
  statsSummary.appendChild(statsContent);
  content.appendChild(statsSummary);
  
  // 参数列表（可折叠）
  const paramsSection = document.createElement('div');
  paramsSection.style.marginBottom = '16px';
  
  const paramsHeader = document.createElement('div');
  paramsHeader.style.display = 'flex';
  paramsHeader.style.justifyContent = 'space-between';
  paramsHeader.style.alignItems = 'center';
  paramsHeader.style.padding = '8px 12px';
  paramsHeader.style.backgroundColor = '#e9ecef';
  paramsHeader.style.borderRadius = '6px';
  paramsHeader.style.cursor = 'pointer';
  paramsHeader.style.userSelect = 'none';
  
  const paramsTitle = document.createElement('div');
  paramsTitle.textContent = '🎛️ 参数详情';
  paramsTitle.style.fontWeight = '600';
  paramsTitle.style.color = '#333';
  
  const toggleIcon = document.createElement('span');
  toggleIcon.textContent = '▼';
  toggleIcon.style.fontSize = '12px';
  toggleIcon.style.transition = 'transform 0.2s';
  
  paramsHeader.appendChild(paramsTitle);
  paramsHeader.appendChild(toggleIcon);
  paramsSection.appendChild(paramsHeader);
  
  const paramsList = document.createElement('div');
  paramsList.style.fontSize = '12px';
  paramsList.style.marginTop = '8px';
  paramsList.style.display = 'none'; // 默认折叠
  
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
    categoryDiv.style.marginBottom = '12px';
    
    const categoryTitle = document.createElement('div');
    categoryTitle.textContent = category;
    categoryTitle.style.fontWeight = '600';
    categoryTitle.style.fontSize = '11px';
    categoryTitle.style.color = '#666';
    categoryTitle.style.marginBottom = '4px';
    categoryTitle.style.textTransform = 'uppercase';
    categoryDiv.appendChild(categoryTitle);
    
    for (const key of keys) {
      if (key in params) {
        const paramRow = document.createElement('div');
        paramRow.style.display = 'flex';
        paramRow.style.justifyContent = 'space-between';
        paramRow.style.padding = '4px 8px';
        paramRow.style.backgroundColor = '#f8f9fa';
        paramRow.style.marginBottom = '2px';
        paramRow.style.borderRadius = '3px';
        
        const keySpan = document.createElement('span');
        keySpan.textContent = key;
        keySpan.style.color = '#495057';
        
        const valueSpan = document.createElement('span');
        const value = (params as any)[key];
        valueSpan.textContent = typeof value === 'number' 
          ? (Number.isInteger(value) ? value.toString() : value.toFixed(4))
          : String(value);
        valueSpan.style.fontFamily = 'monospace';
        valueSpan.style.fontWeight = '600';
        
        paramRow.appendChild(keySpan);
        paramRow.appendChild(valueSpan);
        categoryDiv.appendChild(paramRow);
      }
    }
    
    paramsList.appendChild(categoryDiv);
  }
  
  paramsSection.appendChild(paramsList);
  content.appendChild(paramsSection);
  
  // 操作按钮
  const actions = document.createElement('div');
  actions.style.marginTop = '16px';
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '🔄 Reset to Default';
  resetBtn.style.flex = '1';
  resetBtn.style.padding = '8px';
  resetBtn.style.backgroundColor = '#dc3545';
  resetBtn.style.color = '#fff';
  resetBtn.style.border = 'none';
  resetBtn.style.borderRadius = '4px';
  resetBtn.style.cursor = 'pointer';
  resetBtn.style.fontSize = '12px';
  
  resetBtn.onclick = () => {
    if (confirm('Reset all AI parameters to default values?')) {
      const { resetParams } = require('../../training/paramPersistence');
      resetParams();
      alert('Parameters reset. Please refresh the page.');
    }
  };
  
  const exportBtn = document.createElement('button');
  exportBtn.textContent = '📋 Export';
  exportBtn.style.flex = '1';
  exportBtn.style.padding = '8px';
  exportBtn.style.backgroundColor = '#28a745';
  exportBtn.style.color = '#fff';
  exportBtn.style.border = 'none';
  exportBtn.style.borderRadius = '4px';
  exportBtn.style.cursor = 'pointer';
  exportBtn.style.fontSize = '12px';
  
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
