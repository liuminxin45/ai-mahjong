import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderCenterStatus } from '../components/CenterStatus';
import { renderGameLogPanel } from '../components/GameLogPanel';
import { renderDiscardGrid } from '../components/DiscardGrid';
import { renderTile } from '../components/tileView';
import { renderAIParamsPanel } from '../components/AIParamsPanel';
import { renderChatAssistantButton } from '../components/LLMChatAssistant';
import { applyChineseButtonStyle, isChineseMode, applyChinesePlayerAreaStyle, applyChineseTitleStyle } from '../styles/chineseGameStyle';
import { initLLMConfig } from '../components/LLMSettingsPanel';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import type { PlayerId } from '../../core/model/types';
import type { Meld } from '../../core/model/state';
import { sortTiles } from '../../core/rules/packs/chengdu/sort';
import { languageStore } from '../../store/languageStore';

// 初始化LLM配置
initLLMConfig();

export function renderTableMode(root: HTMLElement, ctx: UiCtx): void {
  const s = ctx.gameStore.state;
  const evs = ctx.gameStore.events;

  if (!s) {
    root.innerHTML = '<div>No match running.</div>';
    return;
  }

  // 换三张阶段
  if (s.phase === 'EXCHANGE') {
    renderExchangePhase(root, ctx, s);
    return;
  }

  // 定缺阶段
  if (s.phase === 'DING_QUE') {
    renderDingQuePhase(root, ctx, s);
    return;
  }

  // 游戏结束阶段
  if (s.phase === 'END') {
    renderEndPhase(root, ctx, s);
    return;
  }

  root.innerHTML = '';

  // 主容器：左侧游戏区，右侧日志区（移动端垂直布局）
  const mainContainer = document.createElement('div');
  mainContainer.style.display = 'flex';
  mainContainer.style.flexDirection = window.innerWidth < 768 ? 'column' : 'row';
  mainContainer.style.gap = '8px';
  mainContainer.style.height = '100vh';
  mainContainer.style.padding = '8px';
  mainContainer.style.boxSizing = 'border-box';

  // 游戏区域
  const gameArea = document.createElement('div');
  gameArea.style.flex = '1';
  gameArea.style.minWidth = '0'; // 允许缩小
  gameArea.style.overflow = 'hidden'; // 禁止滚动，强制一屏显示
  gameArea.style.height = '100%';

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  tableContainer.style.display = 'grid';
  tableContainer.style.gridTemplateColumns = window.innerWidth < 768 ? '60px 1fr 60px' : '120px 1fr 120px';
  // 使用固定比例：顶部10%，中间55%，底部35%（确保P0手牌可见）
  tableContainer.style.gridTemplateRows = '10% 55% 35%';
  tableContainer.style.gap = '4px';
  tableContainer.style.maxWidth = '1200px';
  tableContainer.style.margin = '0 auto';
  tableContainer.style.fontSize = window.innerWidth < 768 ? '11px' : '13px';
  tableContainer.style.height = 'calc(100vh - 60px)';

  // 获取定缺信息
  const chengduState = s as any;
  const dingQueSelections = chengduState.dingQueSelection || {};
  
  // 调试日志
  if (s.phase === 'PLAYING' && Object.keys(dingQueSelections).length > 0) {
    console.log('[UI] Ding que selections:', JSON.stringify(dingQueSelections));
  }

  const t = languageStore.t().game;

  // 创建简化的玩家信息面板（不含弃牌）
  const topPanel = renderCompactPlayerInfo('P2', s.hands.P2.length, s.melds.P2, s.currentPlayer === 'P2', dingQueSelections.P2, t);
  topPanel.style.gridColumn = '1 / 4';
  topPanel.style.gridRow = '1';
  topPanel.style.display = 'flex';
  topPanel.style.alignItems = 'center';
  topPanel.style.gap = '16px';

  const leftPanel = renderCompactPlayerInfo('P3', s.hands.P3.length, s.melds.P3, s.currentPlayer === 'P3', dingQueSelections.P3, t);
  leftPanel.style.gridColumn = '1';
  leftPanel.style.gridRow = '2';

  const rightPanel = renderCompactPlayerInfo('P1', s.hands.P1.length, s.melds.P1, s.currentPlayer === 'P1', dingQueSelections.P1, t);
  rightPanel.style.gridColumn = '3';
  rightPanel.style.gridRow = '2';

  // 中央区域：包含状态信息和所有玩家的弃牌区
  const centerArea = document.createElement('div');
  centerArea.style.gridColumn = '2';
  centerArea.style.gridRow = '2';
  centerArea.style.display = 'flex';
  centerArea.style.flexDirection = 'column';
  centerArea.style.alignItems = 'center';
  centerArea.style.justifyContent = 'flex-start';
  centerArea.style.gap = '4px';
  centerArea.style.padding = '4px';
  centerArea.style.backgroundColor = '#e8f5e9';
  centerArea.style.borderRadius = '4px';
  centerArea.style.border = '1px solid #4caf50';
  
  // 中文模式下的中央区域样式
  if (isChineseMode()) {
    centerArea.style.background = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
    centerArea.style.borderRadius = '12px';
    centerArea.style.border = '2px solid #66bb6a';
    centerArea.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.05)';
  }
  centerArea.style.overflow = 'auto';
  centerArea.style.height = '100%';
  centerArea.style.boxSizing = 'border-box';
  
  // 状态信息
  const lastEvent = evs.length > 0 ? evs[evs.length - 1] : null;
  const lastActionText = lastEvent
    ? `${lastEvent.type} by ${lastEvent.playerId || 'system'}`
    : '';
  const centerStatus = renderCenterStatus(s.turn, s.wall.length, lastActionText);
  centerArea.appendChild(centerStatus);
  
  // 弃牌区布局（围绕中心）
  const discardsArea = document.createElement('div');
  discardsArea.style.display = 'grid';
  discardsArea.style.gridTemplateColumns = '80px 1fr 80px';
  discardsArea.style.gridTemplateRows = 'auto auto auto';
  discardsArea.style.gap = '4px';
  discardsArea.style.width = '100%';
  discardsArea.style.maxWidth = '500px';
  
  // P2 弃牌（上方）
  const p2Discards = renderDiscardArea('P2', s.discards.P2);
  p2Discards.style.gridColumn = '2';
  p2Discards.style.gridRow = '1';
  p2Discards.style.maxWidth = '300px';
  p2Discards.style.margin = '0 auto';
  
  // P3 弃牌（左侧）
  const p3Discards = renderDiscardArea('P3', s.discards.P3);
  p3Discards.style.gridColumn = '1';
  p3Discards.style.gridRow = '2';
  p3Discards.style.maxWidth = '80px';
  
  // P1 弃牌（右侧）
  const p1Discards = renderDiscardArea('P1', s.discards.P1);
  p1Discards.style.gridColumn = '3';
  p1Discards.style.gridRow = '2';
  p1Discards.style.maxWidth = '80px';
  
  // P0 弃牌（下方）
  const p0Discards = renderDiscardArea('P0', s.discards.P0);
  p0Discards.style.gridColumn = '2';
  p0Discards.style.gridRow = '3';
  p0Discards.style.maxWidth = '300px';
  p0Discards.style.margin = '0 auto';
  
  discardsArea.appendChild(p2Discards);
  discardsArea.appendChild(p3Discards);
  discardsArea.appendChild(p1Discards);
  discardsArea.appendChild(p0Discards);
  
  centerArea.appendChild(discardsArea);

  const bottomSection = document.createElement('div');
  bottomSection.style.gridColumn = '1 / 4';
  bottomSection.style.gridRow = '3';
  // P0 轮次时高亮，否则白色背景（与其他玩家一致）
  const isP0Turn = s.currentPlayer === 'P0';
  bottomSection.style.border = isP0Turn ? '2px solid #4a90e2' : '1px solid #ccc';
  bottomSection.style.padding = '6px';
  bottomSection.style.borderRadius = '4px';
  bottomSection.style.backgroundColor = isP0Turn ? '#f0f8ff' : '#fff';
  
  // 中文模式下的P0区域样式
  if (isChineseMode()) {
    bottomSection.style.background = isP0Turn
      ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)';
    bottomSection.style.border = isP0Turn ? '3px solid #4caf50' : '1px solid #e0e0e0';
    bottomSection.style.borderRadius = '12px';
    bottomSection.style.boxShadow = isP0Turn
      ? '0 4px 12px rgba(76, 175, 80, 0.3)'
      : '0 2px 6px rgba(0,0,0,0.1)';
  }
  bottomSection.style.height = '100%';
  bottomSection.style.boxSizing = 'border-box';
  bottomSection.style.overflow = 'auto';
  
  const p0Title = document.createElement('div');
  p0Title.style.fontWeight = '600';
  p0Title.style.marginBottom = '4px';
  p0Title.style.fontSize = '13px';
  p0Title.textContent = `P0 (${t.you})`;
  
  // 中文模式下的标题样式
  if (isChineseMode()) {
    p0Title.style.fontSize = '16px';
    p0Title.style.fontWeight = '700';
    p0Title.style.color = '#2e7d32';
    p0Title.style.textShadow = '0 1px 2px rgba(0,0,0,0.1)';
  }

  // 显示 P0 的缺门信息
  if (dingQueSelections.P0) {
    const p0MissingSuit = document.createElement('span');
    p0MissingSuit.style.fontSize = '12px';
    p0MissingSuit.style.fontWeight = '600';
    p0MissingSuit.style.marginLeft = '8px';
    p0MissingSuit.style.padding = '2px 8px';
    p0MissingSuit.style.backgroundColor = '#fff3cd';
    p0MissingSuit.style.border = '1px solid #ffc107';
    p0MissingSuit.style.borderRadius = '3px';
    p0MissingSuit.style.color = '#856404';
    
    const suitName = dingQueSelections.P0 === 'W' ? t.wan : dingQueSelections.P0 === 'B' ? t.tiao : t.bing;
    p0MissingSuit.textContent = suitName;
    
    p0Title.appendChild(p0MissingSuit);
  }

  const handWrap = document.createElement('div');
  const reactionWrap = document.createElement('div');

  const meldCountP0 = s.melds.P0.length;
  const baseP0 = 13 - meldCountP0 * 3;
  const canDiscard = !s.lastDiscard && s.currentPlayer === 'P0' && s.hands.P0.length === baseP0 + 1;
  const onClick = canDiscard
    ? (tile: Tile) => {
        const action: Action = { type: 'DISCARD', tile };
        ctx.orchestrator.dispatchHumanAction(action);
      }
    : undefined;

  handWrap.appendChild(renderHand(s.hands.P0, onClick, dingQueSelections.P0));

  // 显示 P0 的碰杠信息
  if (s.melds.P0.length > 0) {
    const meldsSection = document.createElement('div');
    meldsSection.style.marginTop = '12px';
    meldsSection.style.padding = '8px';
    meldsSection.style.backgroundColor = '#fff';
    meldsSection.style.borderRadius = '4px';
    meldsSection.style.border = '1px solid #ddd';
    
    const meldsLabel = document.createElement('div');
    meldsLabel.style.fontWeight = '600';
    meldsLabel.style.marginBottom = '6px';
    meldsLabel.style.fontSize = '14px';
    meldsLabel.textContent = `${t.yourMelds}:`;
    meldsSection.appendChild(meldsLabel);
    
    const meldsDisplay = document.createElement('div');
    meldsDisplay.style.display = 'flex';
    meldsDisplay.style.gap = '8px';
    meldsDisplay.style.flexWrap = 'wrap';
    
    for (const meld of s.melds.P0) {
      const meldGroup = document.createElement('div');
      meldGroup.style.display = 'flex';
      meldGroup.style.gap = '2px';
      meldGroup.style.padding = '4px 6px';
      meldGroup.style.backgroundColor = '#e8f4f8';
      meldGroup.style.borderRadius = '4px';
      
      // 使用麻将牌图像显示
      const tileCount = meld.type === 'GANG' ? 4 : 3;
      for (let i = 0; i < tileCount; i++) {
        const tileEl = renderTile(meld.tile);
        tileEl.style.width = '28px';
        tileEl.style.height = '38px';
        tileEl.style.padding = '1px';
        tileEl.style.border = 'none';
        tileEl.style.backgroundColor = 'transparent';
        
        const img = tileEl.querySelector('img');
        if (img) {
          img.style.width = '26px';
          img.style.height = '36px';
          img.style.objectFit = 'contain';
        }
        
        meldGroup.appendChild(tileEl);
      }
      
      meldsDisplay.appendChild(meldGroup);
    }
    
    meldsSection.appendChild(meldsDisplay);
    handWrap.appendChild(meldsSection);
  }

  const p0Legal = ctx.orchestrator.getLegalActions('P0');
  const p0Reactions = p0Legal.filter((a) => a.type === 'PASS' || a.type === 'PENG' || a.type === 'GANG' || a.type === 'HU');

  // 只有在有弃牌且P0可以反应时才显示按钮（排除P1-P3碰杠时的情况）
  const hasRealReactions = p0Reactions.some(a => a.type !== 'PASS');
  if (s.lastDiscard && s.lastDiscard.from !== 'P0' && hasRealReactions) {
    const title = document.createElement('div');
    title.textContent = `Response to ${s.lastDiscard.from} discard`;
    title.style.marginTop = '8px';
    title.style.fontWeight = '600';
    reactionWrap.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.marginTop = '4px';

    const order: Array<Action['type']> = ['HU', 'GANG', 'PENG', 'PASS'];
    for (const t of order) {
      const act = p0Reactions.find((a) => a.type === t);
      if (!act) continue;
      const b = document.createElement('button');
      b.textContent = act.type;
      b.style.padding = '6px 12px';
      b.style.fontSize = '14px';
      b.onclick = () => ctx.orchestrator.dispatchHumanAction(act);
      
      // 应用中文游戏风格
      if (act.type === 'HU') {
        applyChineseButtonStyle(b, 'success');
      } else if (act.type === 'GANG' || act.type === 'PENG') {
        applyChineseButtonStyle(b, 'warning');
      } else if (act.type === 'PASS') {
        applyChineseButtonStyle(b, 'info');
      } else {
        applyChineseButtonStyle(b, 'primary');
      }
      
      btnRow.appendChild(b);
    }

    reactionWrap.appendChild(btnRow);
  }

  // 自摸胡：当轮到 P0 且没有 lastDiscard 时，检查是否有 HU 动作
  if (s.currentPlayer === 'P0' && !s.lastDiscard) {
    const selfDrawHu = p0Legal.find((a) => a.type === 'HU');
    if (selfDrawHu) {
      const title = document.createElement('div');
      title.textContent = t.selfDrawWin;
      title.style.marginTop = '8px';
      title.style.fontWeight = '600';
      title.style.color = '#28a745';
      reactionWrap.appendChild(title);

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.flexWrap = 'wrap';
      btnRow.style.marginTop = '4px';

      const huBtn = document.createElement('button');
      huBtn.textContent = selfDrawHu.type;
      huBtn.style.padding = '8px 16px';
      huBtn.style.fontSize = '16px';
      huBtn.style.fontWeight = '600';
      huBtn.style.backgroundColor = '#28a745';
      huBtn.style.color = 'white';
      huBtn.style.border = 'none';
      huBtn.style.borderRadius = '4px';
      huBtn.style.cursor = 'pointer';
      huBtn.onclick = () => ctx.orchestrator.dispatchHumanAction(selfDrawHu);
      
      // 应用中文游戏风格
      applyChineseButtonStyle(huBtn, 'success');
      
      btnRow.appendChild(huBtn);

      reactionWrap.appendChild(btnRow);
    }
  }

  // P0 的弃牌现在在中央区域，底部只显示手牌和操作
  bottomSection.appendChild(p0Title);
  bottomSection.appendChild(handWrap);
  bottomSection.appendChild(reactionWrap);

  tableContainer.appendChild(topPanel);
  tableContainer.appendChild(leftPanel);
  tableContainer.appendChild(centerArea);
  tableContainer.appendChild(rightPanel);
  tableContainer.appendChild(bottomSection);

  gameArea.appendChild(tableContainer);

  // 仅在 P0 AI 模式下显示日志面板
  if (ctx.settingsStore.p0IsAI) {
    const logPanel = document.createElement('div');
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      logPanel.style.width = '100%';
      logPanel.style.height = '300px';
      logPanel.style.minHeight = '200px';
    } else {
      logPanel.style.width = '320px';
      logPanel.style.minWidth = '280px';
      logPanel.style.maxWidth = '400px';
      logPanel.style.height = 'calc(100vh - 16px)';
    }
    
    renderGameLogPanel(logPanel);
    mainContainer.appendChild(gameArea);
    mainContainer.appendChild(logPanel);
  } else {
    mainContainer.appendChild(gameArea);
  }

  root.appendChild(mainContainer);
  
  // 添加 AI 参数面板（右上角可折叠）
  const existingPanel = document.getElementById('ai-params-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  const aiParamsPanel = renderAIParamsPanel();
  aiParamsPanel.id = 'ai-params-panel';
  root.appendChild(aiParamsPanel);
  
  // 添加 LLM 聊天助手按钮（仅在真人模式下显示）
  if (!ctx.settingsStore.p0IsAI) {
    const existingChatBtn = document.getElementById('llm-chat-btn');
    if (existingChatBtn) {
      existingChatBtn.remove();
    }
    const chatBtn = renderChatAssistantButton(s);
    chatBtn.id = 'llm-chat-btn';
    root.appendChild(chatBtn);
  }
}
function renderExchangePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const renderTileFn = renderTile;
  
  const container = document.createElement('div');
  container.style.maxWidth = '100%';
  container.style.margin = '40px auto';
  container.style.padding = '20px';
  container.style.border = '2px solid #4a90e2';
  container.style.borderRadius = '8px';
  container.style.backgroundColor = '#f0f8ff';
  
  const title = document.createElement('h2');
  title.textContent = t.exchangeTitle;
  title.style.marginBottom = '20px';
  title.style.textAlign = 'center';
  
  const instruction = document.createElement('p');
  instruction.textContent = t.exchangeInstruction;
  instruction.style.marginBottom = '20px';
  instruction.style.textAlign = 'center';
  instruction.style.fontSize = '16px';
  
  const handWrap = document.createElement('div');
  handWrap.style.marginBottom = '20px';
  
  const selectedIndices = new Set<number>();
  const chengduState = state as any;
  const currentSelections = chengduState.exchangeSelections?.P0 || [];
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = t.exchangeConfirm;
  confirmBtn.style.padding = '12px 24px';
  confirmBtn.style.fontSize = '16px';
  confirmBtn.style.backgroundColor = '#4a90e2';
  confirmBtn.style.color = '#fff';
  confirmBtn.style.border = 'none';
  confirmBtn.style.borderRadius = '4px';
  confirmBtn.style.cursor = 'pointer';
  confirmBtn.style.display = 'block';
  confirmBtn.style.margin = '0 auto';
  
  const updateButtonState = () => {
    if (currentSelections.length === 3) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t.exchangeWaiting;
      confirmBtn.style.backgroundColor = '#ccc';
      confirmBtn.style.cursor = 'not-allowed';
    } else if (selectedIndices.size === 3) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = t.exchangeConfirm;
      confirmBtn.style.backgroundColor = '#4a90e2';
      confirmBtn.style.cursor = 'pointer';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t.exchangeConfirm;
      confirmBtn.style.backgroundColor = '#ccc';
      confirmBtn.style.cursor = 'not-allowed';
    }
  };
  
  const renderHandWithSelection = () => {
    handWrap.innerHTML = '';
    const handDiv = document.createElement('div');
    handDiv.style.display = 'flex';
    handDiv.style.flexWrap = 'nowrap';
    handDiv.style.gap = '4px';
    handDiv.style.justifyContent = 'center';
    handDiv.style.overflowX = 'auto';
    handDiv.style.padding = '8px 0';
    
    // Sort tiles before rendering
    const sortedHand = sortTiles(state.hands.P0);
    
    sortedHand.forEach((tile, index) => {
      const btn = renderTileFn(tile);
      btn.style.minWidth = '40px';
      btn.style.width = '40px';
      btn.style.height = '54px';
      btn.style.padding = '4px';
      btn.style.fontSize = '14px';
      btn.style.border = '2px solid #ccc';
      btn.style.borderRadius = '4px';
      btn.style.flexShrink = '0';
      
      // 调整内部图片尺寸
      const img = btn.querySelector('img');
      if (img) {
        img.style.width = '32px';
        img.style.height = '44px';
        img.style.objectFit = 'contain';
      }
      btn.style.cursor = 'pointer';
      btn.style.backgroundColor = '#fff';
      
      const isSelected = selectedIndices.has(index);
      if (isSelected) {
        btn.style.backgroundColor = '#4a90e2';
        btn.style.color = '#fff';
        btn.style.borderColor = '#2c5aa0';
      }
      
      btn.onclick = () => {
        if (isSelected) {
          selectedIndices.delete(index);
        } else {
          if (selectedIndices.size < 3) {
            selectedIndices.add(index);
          }
        }
        updateButtonState();
        renderHandWithSelection();
      };
      
      handDiv.appendChild(btn);
    });
    
    handWrap.appendChild(handDiv);
    
    const selectedInfo = document.createElement('div');
    selectedInfo.style.marginTop = '12px';
    selectedInfo.style.textAlign = 'center';
    selectedInfo.textContent = t.exchangeSelected(selectedIndices.size);
    handWrap.appendChild(selectedInfo);
  };
  
  confirmBtn.onclick = () => {
    if (selectedIndices.size === 3) {
      const sortedHand = sortTiles(state.hands.P0);
      const selectedTiles = Array.from(selectedIndices).map(idx => sortedHand[idx]);
      
      console.log('Exchange: Selected tiles:', selectedTiles);
      console.log('Exchange: Validating same suit:', selectedTiles.every(t => t.suit === selectedTiles[0].suit));
      
      ctx.orchestrator.dispatchHumanAction({ type: 'EXCHANGE_SELECT', tiles: selectedTiles });
      setTimeout(() => {
        ctx.orchestrator.dispatchHumanAction({ type: 'EXCHANGE_CONFIRM' });
      }, 100);
    }
  };
  
  renderHandWithSelection();
  updateButtonState();
  
  container.appendChild(title);
  container.appendChild(instruction);
  container.appendChild(handWrap);
  container.appendChild(confirmBtn);
  root.appendChild(container);
  
  // 添加 LLM 聊天助手按钮（换三张阶段）
  if (!ctx.settingsStore.p0IsAI) {
    const existingChatBtn = document.getElementById('llm-chat-btn');
    if (existingChatBtn) {
      existingChatBtn.remove();
    }
    const chatBtn = renderChatAssistantButton(state);
    chatBtn.id = 'llm-chat-btn';
    root.appendChild(chatBtn);
  }
}

function renderEndPhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  
  // 检查是否需要显示确认界面（非 P0 AI 模式）
  const needConfirmation = !ctx.settingsStore.p0IsAI;
  const hasConfirmed = (state as any).endConfirmed || false;
  
  // 如果需要确认但还未确认，显示简单的确认界面
  if (needConfirmation && !hasConfirmed) {
    const confirmContainer = document.createElement('div');
    confirmContainer.style.maxWidth = '600px';
    confirmContainer.style.margin = '100px auto';
    confirmContainer.style.padding = '40px';
    confirmContainer.style.border = '2px solid #4a90e2';
    confirmContainer.style.borderRadius = '12px';
    confirmContainer.style.backgroundColor = '#f0f8ff';
    confirmContainer.style.textAlign = 'center';
    
    const message = document.createElement('div');
    message.style.fontSize = '24px';
    message.style.marginBottom = '30px';
    message.style.fontWeight = '600';
    
    // 判断结果
    const isWin = state.declaredHu.P0;
    const isLose = (['P1', 'P2', 'P3'] as const).some(pid => state.declaredHu[pid]);
    
    if (isWin) {
      message.textContent = '🎊 You Win! 🎊';
      message.style.color = '#28a745';
    } else if (isLose) {
      message.textContent = '😢 You Lose';
      message.style.color = '#dc3545';
    } else {
      message.textContent = '🤝 Draw';
      message.style.color = '#6c757d';
    }
    
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'View Results';
    confirmBtn.style.padding = '15px 40px';
    confirmBtn.style.fontSize = '18px';
    confirmBtn.style.backgroundColor = '#4a90e2';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.cursor = 'pointer';
    
    confirmBtn.onclick = () => {
      // 标记已确认
      (state as any).endConfirmed = true;
      // 重新渲染
      renderEndPhase(root, ctx, state);
    };
    
    confirmContainer.appendChild(message);
    confirmContainer.appendChild(confirmBtn);
    root.appendChild(confirmContainer);
    return;
  }
  
  // 显示完整的游戏结束界面
  const container = document.createElement('div');
  container.style.maxWidth = '800px';
  container.style.margin = '40px auto';
  container.style.padding = '30px';
  container.style.border = '3px solid #4a90e2';
  container.style.borderRadius = '12px';
  container.style.backgroundColor = '#f0f8ff';
  container.style.textAlign = 'center';
  
  const title = document.createElement('h1');
  title.textContent = '🎉 Game Over 🎉';
  title.style.marginBottom = '30px';
  title.style.color = '#4a90e2';
  
  // 找出胡牌的玩家
  const winners = (['P0', 'P1', 'P2', 'P3'] as const).filter(pid => state.declaredHu[pid]);
  
  if (winners.length > 0) {
    const winnerSection = document.createElement('div');
    winnerSection.style.marginBottom = '20px';
    
    for (const winner of winners) {
      const winnerText = document.createElement('div');
      winnerText.style.fontSize = '24px';
      winnerText.style.fontWeight = 'bold';
      winnerText.style.marginBottom = '10px';
      winnerText.style.color = winner === 'P0' ? '#28a745' : '#dc3545';
      
      if (winner === 'P0') {
        winnerText.textContent = '🎊 You Win! 🎊';
      } else {
        winnerText.textContent = `${winner} Wins`;
      }
      
      winnerSection.appendChild(winnerText);
    }
    
    container.appendChild(title);
    container.appendChild(winnerSection);
  } else {
    const drawText = document.createElement('div');
    drawText.textContent = 'Draw - No Winner';
    drawText.style.fontSize = '24px';
    drawText.style.marginBottom = '20px';
    
    container.appendChild(title);
    container.appendChild(drawText);
  }
  
  const t = languageStore.t().game;
  
  // 显示最终手牌
  const finalHandsSection = document.createElement('div');
  finalHandsSection.style.marginTop = '30px';
  
  // 获取分数信息（从 Chengdu 规则包的 roundScores）
  const chengduState = state as any;
  const scoreChanges = chengduState.roundScores || { P0: 0, P1: 0, P2: 0, P3: 0 };
  
  // 从游戏事件中提取胡牌信息
  const huResults: Record<string, any> = {};
  for (const event of ctx.gameStore.events) {
    if (event.type === 'HU' && event.playerId && event.meta) {
      const yakuList = (event.meta as any).yakuList || [];
      huResults[event.playerId] = {
        yaku: yakuList.map((y: any) => y.description),
        fan: yakuList.reduce((sum: number, y: any) => sum + y.fan, 0),
        winningTile: event.tile,
        score: (event.meta as any).score || 0,
      };
    }
  }
  
  for (const pid of ['P0', 'P1', 'P2', 'P3'] as const) {
    const playerDiv = document.createElement('div');
    playerDiv.style.marginBottom = '15px';
    playerDiv.style.padding = '12px';
    playerDiv.style.backgroundColor = state.declaredHu[pid] ? '#d4edda' : '#fff';
    playerDiv.style.borderRadius = '8px';
    playerDiv.style.border = '1px solid #ddd';
    
    // 玩家标签行
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';
    
    const playerLabel = document.createElement('div');
    playerLabel.style.fontWeight = 'bold';
    playerLabel.style.fontSize = '16px';
    const youLabel = pid === 'P0' ? ` (${t.you})` : '';
    const winnerLabel = state.declaredHu[pid] ? ` 🏆 ${t.hu || 'Winner'}` : '';
    playerLabel.textContent = `${pid}${youLabel}${winnerLabel}`;
    playerLabel.style.color = state.declaredHu[pid] ? '#28a745' : '#333';
    
    // 分数变化
    const scoreDiv = document.createElement('div');
    scoreDiv.style.fontWeight = '600';
    const scoreChange = scoreChanges[pid] || 0;
    if (scoreChange > 0) {
      scoreDiv.textContent = `+${scoreChange} ${t.score || 'pts'}`;
      scoreDiv.style.color = '#28a745';
    } else if (scoreChange < 0) {
      scoreDiv.textContent = `${scoreChange} ${t.score || 'pts'}`;
      scoreDiv.style.color = '#dc3545';
    } else {
      scoreDiv.textContent = `±0 ${t.score || 'pts'}`;
      scoreDiv.style.color = '#6c757d';
    }
    
    headerRow.appendChild(playerLabel);
    headerRow.appendChild(scoreDiv);
    playerDiv.appendChild(headerRow);
    
    // 胡牌信息（番型）
    if (state.declaredHu[pid] && huResults[pid]) {
      const huInfo = huResults[pid];
      const huInfoDiv = document.createElement('div');
      huInfoDiv.style.marginBottom = '8px';
      huInfoDiv.style.padding = '6px 10px';
      huInfoDiv.style.backgroundColor = '#fff3cd';
      huInfoDiv.style.borderRadius = '4px';
      huInfoDiv.style.fontSize = '13px';
      
      const yakuList = huInfo.yaku || [];
      const fanCount = huInfo.fan || 0;
      const winningTile = huInfo.winningTile;
      
      let huText = '';
      if (winningTile) {
        huText += `${t.hu || 'Hu'}: ${winningTile.suit}${winningTile.rank} | `;
      }
      if (yakuList.length > 0) {
        huText += yakuList.join(', ') + ' | ';
      }
      huText += `${fanCount} ${t.fan || 'Fan'}`;
      
      huInfoDiv.textContent = huText;
      playerDiv.appendChild(huInfoDiv);
    }
    
    // 手牌显示（排序后的麻将牌图像）
    const handDisplay = document.createElement('div');
    handDisplay.style.display = 'flex';
    handDisplay.style.flexWrap = 'wrap';
    handDisplay.style.gap = '3px';
    handDisplay.style.marginBottom = '8px';
    
    // 排序手牌
    const sortedHand = sortTiles(state.hands[pid]);
    for (const tile of sortedHand) {
      const tileEl = renderTile(tile);
      tileEl.style.width = '28px';
      tileEl.style.height = '38px';
      tileEl.style.padding = '2px';
      
      const img = tileEl.querySelector('img');
      if (img) {
        img.style.width = '24px';
        img.style.height = '34px';
        img.style.objectFit = 'contain';
      }
      
      handDisplay.appendChild(tileEl);
    }
    
    playerDiv.appendChild(handDisplay);
    
    // 碰杠显示
    if (state.melds[pid] && state.melds[pid].length > 0) {
      const meldsDisplay = document.createElement('div');
      meldsDisplay.style.display = 'flex';
      meldsDisplay.style.flexWrap = 'wrap';
      meldsDisplay.style.gap = '8px';
      meldsDisplay.style.marginTop = '6px';
      meldsDisplay.style.paddingTop = '6px';
      meldsDisplay.style.borderTop = '1px dashed #ccc';
      
      for (const meld of state.melds[pid]) {
        const meldGroup = document.createElement('div');
        meldGroup.style.display = 'flex';
        meldGroup.style.gap = '1px';
        meldGroup.style.padding = '2px 4px';
        meldGroup.style.backgroundColor = '#f8f9fa';
        meldGroup.style.borderRadius = '4px';
        
        const tileCount = meld.type === 'GANG' ? 4 : 3;
        for (let i = 0; i < tileCount; i++) {
          const tileEl = renderTile(meld.tile);
          tileEl.style.width = '24px';
          tileEl.style.height = '32px';
          tileEl.style.padding = '1px';
          
          const img = tileEl.querySelector('img');
          if (img) {
            img.style.width = '20px';
            img.style.height = '28px';
            img.style.objectFit = 'contain';
          }
          
          meldGroup.appendChild(tileEl);
        }
        
        meldsDisplay.appendChild(meldGroup);
      }
      
      playerDiv.appendChild(meldsDisplay);
    }
    
    finalHandsSection.appendChild(playerDiv);
  }
  
  container.appendChild(finalHandsSection);
  
  // 按钮组
  const buttonGroup = document.createElement('div');
  buttonGroup.style.marginTop = '30px';
  buttonGroup.style.display = 'flex';
  buttonGroup.style.gap = '15px';
  buttonGroup.style.justifyContent = 'center';
  
  // 复制日志按钮
  const copyLogBtn = document.createElement('button');
  copyLogBtn.textContent = '📋 Copy Game Log';
  copyLogBtn.style.padding = '15px 30px';
  copyLogBtn.style.fontSize = '16px';
  copyLogBtn.style.backgroundColor = '#28a745';
  copyLogBtn.style.color = '#fff';
  copyLogBtn.style.border = 'none';
  copyLogBtn.style.borderRadius = '8px';
  copyLogBtn.style.cursor = 'pointer';
  
  copyLogBtn.onclick = () => {
    // 调用全局的 exportGameLog 函数
    if ((globalThis as any).exportGameLog) {
      (globalThis as any).exportGameLog();
      copyLogBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyLogBtn.textContent = '📋 Copy Game Log';
      }, 2000);
    } else {
      alert('Game log not available');
    }
  };
  
  // 重新开始按钮
  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'New Game';
  restartBtn.style.padding = '15px 40px';
  restartBtn.style.fontSize = '18px';
  restartBtn.style.backgroundColor = '#4a90e2';
  restartBtn.style.color = '#fff';
  restartBtn.style.border = 'none';
  restartBtn.style.borderRadius = '8px';
  restartBtn.style.cursor = 'pointer';
  
  restartBtn.onclick = () => {
    window.location.reload();
  };
  
  buttonGroup.appendChild(copyLogBtn);
  buttonGroup.appendChild(restartBtn);
  container.appendChild(buttonGroup);
  root.appendChild(container);
}

function renderDingQuePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const renderTileFn = renderTile;
  const getSuitLabel = (suit: 'W' | 'B' | 'T') =>
    suit === 'W' ? t.wan : suit === 'B' ? t.tiao : t.bing;
  
  const container = document.createElement('div');
  container.style.maxWidth = '900px';
  container.style.margin = '40px auto';
  container.style.padding = '20px';
  container.style.border = '2px solid #4a90e2';
  container.style.borderRadius = '8px';
  container.style.backgroundColor = '#f0f8ff';
  
  const title = document.createElement('h2');
  title.textContent = t.dingTitle;
  title.style.marginBottom = '20px';
  title.style.textAlign = 'center';
  
  const instruction = document.createElement('p');
  instruction.textContent = t.dingInstruction;
  instruction.style.marginBottom = '20px';
  instruction.style.textAlign = 'center';
  instruction.style.fontSize = '16px';
  
  const chengduState = state as any;
  const hasSelected = chengduState.dingQueSelection?.P0;
  
  if (hasSelected) {
    const waiting = document.createElement('div');
    const suitName = getSuitLabel(hasSelected);
    waiting.textContent = t.dingSelected(suitName);
    waiting.style.textAlign = 'center';
    waiting.style.fontSize = '18px';
    waiting.style.fontWeight = 'bold';
    container.appendChild(title);
    container.appendChild(waiting);
    root.appendChild(container);
    return;
  }
  
  // 显示当前手牌
  const handSection = document.createElement('div');
  handSection.style.marginBottom = '30px';
  
  const handTitle = document.createElement('h3');
  handTitle.textContent = t.dingHandTitle;
  handTitle.style.marginBottom = '10px';
  handTitle.style.textAlign = 'center';
  
  const handDisplay = document.createElement('div');
  handDisplay.style.display = 'flex';
  handDisplay.style.flexWrap = 'wrap';
  handDisplay.style.gap = '6px';
  handDisplay.style.justifyContent = 'center';
  handDisplay.style.padding = '15px';
  handDisplay.style.backgroundColor = '#fff';
  handDisplay.style.borderRadius = '8px';
  handDisplay.style.border = '1px solid #ddd';
  
  // 排序并显示手牌
  const sortedHand = sortTiles(state.hands.P0);
  for (const tile of sortedHand) {
    const tileBtn = renderTileFn(tile);
    tileBtn.style.padding = '10px 14px';
    tileBtn.style.fontSize = '16px';
    tileBtn.style.border = '2px solid #ccc';
    tileBtn.style.borderRadius = '4px';
    tileBtn.style.backgroundColor = '#fff';
    tileBtn.style.fontWeight = 'bold';
    handDisplay.appendChild(tileBtn);
  }
  
  // 统计每种花色的数量
  const suitCounts = {
    W: sortedHand.filter(t => t.suit === 'W').length,
    B: sortedHand.filter(t => t.suit === 'B').length,
    T: sortedHand.filter(t => t.suit === 'T').length,
  };
  
  const countInfo = document.createElement('div');
  countInfo.style.marginTop = '10px';
  countInfo.style.textAlign = 'center';
  countInfo.style.fontSize = '14px';
  countInfo.style.color = '#666';
  countInfo.textContent = t.dingSuitCount(suitCounts.W, suitCounts.B, suitCounts.T);
  
  handSection.appendChild(handTitle);
  handSection.appendChild(handDisplay);
  handSection.appendChild(countInfo);
  
  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '20px';
  btnContainer.style.justifyContent = 'center';
  
  const suits = [
    { suit: 'W' as const, name: getSuitLabel('W'), count: suitCounts.W },
    { suit: 'B' as const, name: getSuitLabel('B'), count: suitCounts.B },
    { suit: 'T' as const, name: getSuitLabel('T'), count: suitCounts.T },
  ];
  
  for (const { suit, name, count } of suits) {
    const btn = document.createElement('button');
    btn.textContent = t.dingSuitOption(name, count);
    btn.style.padding = '20px 30px';
    btn.style.fontSize = '18px';
    btn.style.backgroundColor = '#4a90e2';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    
    btn.onclick = () => {
      ctx.orchestrator.dispatchHumanAction({ type: 'DING_QUE', suit });
    };
    
    btnContainer.appendChild(btn);
  }
  
  container.appendChild(title);
  container.appendChild(instruction);
  container.appendChild(handSection);
  container.appendChild(btnContainer);
  root.appendChild(container);
  
  // 添加 LLM 聊天助手按钮（定缺阶段）
  if (!ctx.settingsStore.p0IsAI) {
    const existingChatBtn = document.getElementById('llm-chat-btn');
    if (existingChatBtn) {
      existingChatBtn.remove();
    }
    const chatBtn = renderChatAssistantButton(state);
    chatBtn.id = 'llm-chat-btn';
    root.appendChild(chatBtn);
  }
}

// 辅助函数：渲染简化的玩家信息面板（不含弃牌）
function renderCompactPlayerInfo(
  playerId: PlayerId,
  handCount: number,
  melds: Meld[],
  isCurrent: boolean,
  missingSuit?: 'W' | 'B' | 'T',
  t?: any
): HTMLElement {
  const panel = document.createElement('div');
  panel.style.border = isCurrent ? '2px solid #4a90e2' : '1px solid #ccc';
  panel.style.padding = '4px 6px';
  panel.style.borderRadius = '4px';
  panel.style.backgroundColor = isCurrent ? '#f0f8ff' : '#fff';
  panel.style.fontSize = '12px';
  panel.style.height = '100%';
  panel.style.boxSizing = 'border-box';
  panel.style.overflow = 'hidden';
  
  // 应用中文游戏风格
  if (isChineseMode()) {
    panel.style.background = isCurrent 
      ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
      : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)';
    panel.style.border = isCurrent ? '2px solid #2196f3' : '1px solid #e0e0e0';
    panel.style.borderRadius = '8px';
    panel.style.boxShadow = isCurrent 
      ? '0 2px 8px rgba(33, 150, 243, 0.3)'
      : '0 1px 4px rgba(0,0,0,0.1)';
  }

  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.marginBottom = '4px';
  header.textContent = `${playerId}${isCurrent ? ' ⬅' : ''}`;
  
  // 中文模式下的标题样式
  if (isChineseMode()) {
    header.style.fontSize = '14px';
    header.style.color = isCurrent ? '#1976d2' : '#424242';
    header.style.fontWeight = '700';
  }

  const handInfo = document.createElement('div');
  handInfo.style.fontSize = '12px';
  handInfo.style.color = '#666';
  handInfo.textContent = t ? `${t.hand}: ${handCount} ${t.tiles}` : `Hand: ${handCount} tiles`;

  panel.appendChild(header);
  panel.appendChild(handInfo);

  // 显示缺门信息
  if (missingSuit && t) {
    const missingSuitInfo = document.createElement('div');
    missingSuitInfo.style.fontSize = '11px';
    missingSuitInfo.style.fontWeight = '600';
    missingSuitInfo.style.marginTop = '4px';
    missingSuitInfo.style.padding = '3px 6px';
    missingSuitInfo.style.backgroundColor = '#fff3cd';
    missingSuitInfo.style.border = '1px solid #ffc107';
    missingSuitInfo.style.borderRadius = '3px';
    missingSuitInfo.style.color = '#856404';
    
    const suitName = missingSuit === 'W' ? t.wan : missingSuit === 'B' ? t.tiao : t.bing;
    missingSuitInfo.textContent = suitName;
    panel.appendChild(missingSuitInfo);
  }

  // 显示碰杠信息（使用麻将牌图像）
  if (melds.length > 0) {
    const meldsContainer = document.createElement('div');
    meldsContainer.style.marginTop = '2px';
    meldsContainer.style.display = 'flex';
    meldsContainer.style.flexDirection = 'column';
    meldsContainer.style.gap = '2px';
    
    for (const meld of melds) {
      const meldRow = document.createElement('div');
      meldRow.style.display = 'flex';
      meldRow.style.gap = '1px';
      
      // PENG = 3张, GANG = 4张
      const tileCount = meld.type === 'GANG' ? 4 : 3;
      for (let i = 0; i < tileCount; i++) {
        const tileEl = renderTile(meld.tile);
        tileEl.style.width = '20px';
        tileEl.style.height = '28px';
        tileEl.style.padding = '1px';
        tileEl.style.display = 'flex';
        tileEl.style.alignItems = 'center';
        tileEl.style.justifyContent = 'center';
        
        // 调整内部图片尺寸
        const img = tileEl.querySelector('img');
        if (img) {
          img.style.width = '16px';
          img.style.height = '24px';
          img.style.objectFit = 'contain';
        }
        
        meldRow.appendChild(tileEl);
      }
      
      meldsContainer.appendChild(meldRow);
    }
    
    panel.appendChild(meldsContainer);
  }

  return panel;
}

// 辅助函数：渲染弃牌区域（无标签，无滚动条）
function renderDiscardArea(
  _playerId: PlayerId,
  discards: Tile[]
): HTMLElement {
  const area = document.createElement('div');
  area.style.padding = '2px';
  area.style.backgroundColor = 'transparent';
  area.style.overflow = 'hidden'; // 禁止滚动条

  const grid = renderDiscardGrid(discards);
  area.appendChild(grid);

  return area;
}
