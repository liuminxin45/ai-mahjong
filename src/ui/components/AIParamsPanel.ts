/**
 * AI参数面板组件
 * 用于显示和调整AI参数
 */

import { loadParams } from '../../training/paramPersistence';

/**
 * 渲染AI参数按钮（用于头部控制栏）
 */
export function renderAIParamsButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.textContent = '⚙️ AI';
  btn.style.padding = '6px 12px';
  btn.style.backgroundColor = '#6c757d';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '14px';
  
  btn.onclick = () => {
    const panel = document.getElementById('ai-params-panel');
    if (panel) {
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
    }
  };
  
  return btn;
}

/**
 * 渲染AI参数面板（可折叠的侧边面板）
 */
export function renderAIParamsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '60px';
  panel.style.right = '10px';
  panel.style.width = '320px';
  panel.style.maxHeight = 'calc(100vh - 80px)';
  panel.style.backgroundColor = '#fff';
  panel.style.border = '1px solid #ccc';
  panel.style.borderRadius = '8px';
  panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  panel.style.zIndex = '1000';
  panel.style.display = 'none';
  panel.style.overflow = 'hidden';
  
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
  
  // 训练状态摘要
  const statsSummary = document.createElement('div');
  statsSummary.style.marginBottom = '16px';
  statsSummary.style.padding = '12px';
  statsSummary.style.backgroundColor = '#f8f9fa';
  statsSummary.style.borderRadius = '6px';
  statsSummary.style.fontSize = '13px';
  
  const statsTitle = document.createElement('div');
  statsTitle.textContent = '📊 Training Stats';
  statsTitle.style.fontWeight = '600';
  statsTitle.style.marginBottom = '8px';
  
  const statsContent = document.createElement('div');
  statsContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin: 4px 0;">
      <span>Best Fitness:</span>
      <span style="font-weight: 600;">${trainingState.bestFitness === -999999 ? 'N/A' : trainingState.bestFitness.toFixed(1)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 4px 0;">
      <span>Training Steps:</span>
      <span style="font-weight: 600;">${trainingState.currentStep}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin: 4px 0;">
      <span>Accept Rate:</span>
      <span style="font-weight: 600;">${trainingState.acceptCount + trainingState.rejectCount > 0 
        ? ((trainingState.acceptCount / (trainingState.acceptCount + trainingState.rejectCount)) * 100).toFixed(1) + '%'
        : 'N/A'}</span>
    </div>
  `;
  
  statsSummary.appendChild(statsTitle);
  statsSummary.appendChild(statsContent);
  content.appendChild(statsSummary);
  
  // 参数列表
  const paramsTitle = document.createElement('div');
  paramsTitle.textContent = '🎛️ Current Parameters';
  paramsTitle.style.fontWeight = '600';
  paramsTitle.style.marginBottom = '12px';
  content.appendChild(paramsTitle);
  
  const paramsList = document.createElement('div');
  paramsList.style.fontSize = '12px';
  
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
  
  content.appendChild(paramsList);
  
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
