import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderPlayerPanel } from '../components/PlayerPanel';
import { renderCenterStatus } from '../components/CenterStatus';
import { renderGameLogPanel } from '../components/GameLogPanel';
import { renderDiscardGrid } from '../components/DiscardGrid';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import { sortTiles } from '../../core/rules/packs/chengdu/sort';

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
  gameArea.style.overflow = 'auto';

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  tableContainer.style.display = 'grid';
  tableContainer.style.gridTemplateColumns = window.innerWidth < 768 ? '60px 1fr 60px' : '150px 1fr 150px';
  tableContainer.style.gridTemplateRows = 'auto auto auto';
  tableContainer.style.gap = '6px';
  tableContainer.style.maxWidth = '100%';
  tableContainer.style.margin = '0 auto';
  tableContainer.style.fontSize = window.innerWidth < 768 ? '12px' : '14px';

  // 获取定缺信息
  const chengduState = s as any;
  const dingQueSelections = chengduState.dingQueSelection || {};
  
  // 调试日志
  if (s.phase === 'PLAYING' && Object.keys(dingQueSelections).length > 0) {
    console.log('[UI] Ding que selections:', JSON.stringify(dingQueSelections));
  }

  const topPanel = renderPlayerPanel('P2', s.hands.P2.length, s.discards.P2, s.melds.P2, s.currentPlayer === 'P2', dingQueSelections.P2);
  topPanel.style.gridColumn = '2';
  topPanel.style.gridRow = '1';

  const leftPanel = renderPlayerPanel('P3', s.hands.P3.length, s.discards.P3, s.melds.P3, s.currentPlayer === 'P3', dingQueSelections.P3);
  leftPanel.style.gridColumn = '1';
  leftPanel.style.gridRow = '2';

  const rightPanel = renderPlayerPanel('P1', s.hands.P1.length, s.discards.P1, s.melds.P1, s.currentPlayer === 'P1', dingQueSelections.P1);
  rightPanel.style.gridColumn = '3';
  rightPanel.style.gridRow = '2';

  const lastEvent = evs.length > 0 ? evs[evs.length - 1] : null;
  const lastActionText = lastEvent
    ? `${lastEvent.type} by ${lastEvent.playerId || 'system'}`
    : '';

  const centerStatus = renderCenterStatus(s.turn, s.wall.length, lastActionText);
  centerStatus.style.gridColumn = '2';
  centerStatus.style.gridRow = '2';

  const bottomSection = document.createElement('div');
  bottomSection.style.gridColumn = '1 / 4';
  bottomSection.style.gridRow = '3';
  bottomSection.style.border = '1px solid #4a90e2';
  bottomSection.style.padding = window.innerWidth < 768 ? '6px' : '8px';
  bottomSection.style.borderRadius = '4px';
  bottomSection.style.backgroundColor = '#f0f8ff';

  const p0Title = document.createElement('div');
  p0Title.style.fontWeight = '600';
  p0Title.style.marginBottom = '8px';
  p0Title.textContent = 'P0 (You)';

  // 显示 P0 的缺门信息
  if (dingQueSelections.P0) {
    const p0MissingSuit = document.createElement('div');
    p0MissingSuit.style.fontSize = '14px';
    p0MissingSuit.style.fontWeight = '600';
    p0MissingSuit.style.marginBottom = '8px';
    p0MissingSuit.style.padding = '6px 12px';
    p0MissingSuit.style.backgroundColor = '#fff3cd';
    p0MissingSuit.style.border = '2px solid #ffc107';
    p0MissingSuit.style.borderRadius = '4px';
    p0MissingSuit.style.color = '#856404';
    p0MissingSuit.style.display = 'inline-block';
    
    const suitName = dingQueSelections.P0 === 'W' ? 'Wan' : dingQueSelections.P0 === 'B' ? 'Bamboo' : 'Dot';
    p0MissingSuit.textContent = suitName;
    
    bottomSection.appendChild(p0Title);
    bottomSection.appendChild(p0MissingSuit);
  } else {
    bottomSection.appendChild(p0Title);
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

  handWrap.appendChild(renderHand(s.hands.P0, onClick));

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
    meldsLabel.textContent = 'Your Melds:';
    meldsSection.appendChild(meldsLabel);
    
    const meldsDisplay = document.createElement('div');
    meldsDisplay.style.display = 'flex';
    meldsDisplay.style.gap = '8px';
    meldsDisplay.style.flexWrap = 'wrap';
    
    for (const meld of s.melds.P0) {
      const meldDiv = document.createElement('div');
      meldDiv.style.padding = '6px 10px';
      meldDiv.style.backgroundColor = '#e8f4f8';
      meldDiv.style.borderRadius = '4px';
      meldDiv.style.fontSize = '14px';
      meldDiv.style.fontWeight = '600';
      
      let meldText = '';
      const tileStr = `${meld.tile.suit}${meld.tile.rank}`;
      
      if (meld.type === 'PENG') {
        meldText = `Pong ${tileStr}×3`;
      } else if (meld.type === 'GANG') {
        const gangMeld = meld as any;
        if (gangMeld.gangType === 'AN') {
          meldText = `Kong(Hidden) ${tileStr}×4`;
        } else if (gangMeld.gangType === 'MING') {
          meldText = `Kong(Open) ${tileStr}×4`;
        } else if (gangMeld.gangType === 'JIA') {
          meldText = `Kong(Add) ${tileStr}×4`;
        } else {
          meldText = `Kong ${tileStr}×4`;
        }
      }
      
      meldDiv.textContent = meldText;
      meldsDisplay.appendChild(meldDiv);
    }
    
    meldsSection.appendChild(meldsDisplay);
    handWrap.appendChild(meldsSection);
  }

  const p0Legal = ctx.orchestrator.getLegalActions('P0');
  const p0Reactions = p0Legal.filter((a) => a.type === 'PASS' || a.type === 'PENG' || a.type === 'GANG' || a.type === 'HU');

  if (s.lastDiscard && s.lastDiscard.from !== 'P0' && p0Reactions.length > 0) {
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
      btnRow.appendChild(b);
    }

    reactionWrap.appendChild(btnRow);
  }

  // 显示 P0 的弃牌
  if (s.discards.P0.length > 0) {
    const discardsSection = document.createElement('div');
    discardsSection.style.marginTop = '8px';
    
    const discardsLabel = document.createElement('div');
    discardsLabel.style.fontSize = '12px';
    discardsLabel.style.fontWeight = '600';
    discardsLabel.style.marginBottom = '4px';
    discardsLabel.style.color = '#666';
    discardsLabel.textContent = `Your Discards (${s.discards.P0.length}):`;
    
    discardsSection.appendChild(discardsLabel);
    discardsSection.appendChild(renderDiscardGrid(s.discards.P0));
    
    bottomSection.appendChild(p0Title);
    bottomSection.appendChild(discardsSection);
    bottomSection.appendChild(handWrap);
    bottomSection.appendChild(reactionWrap);
  } else {
    bottomSection.appendChild(p0Title);
    bottomSection.appendChild(handWrap);
    bottomSection.appendChild(reactionWrap);
  }

  tableContainer.appendChild(topPanel);
  tableContainer.appendChild(leftPanel);
  tableContainer.appendChild(centerStatus);
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
}

function renderExchangePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  
  const container = document.createElement('div');
  container.style.maxWidth = '800px';
  container.style.margin = '40px auto';
  container.style.padding = '20px';
  container.style.border = '2px solid #4a90e2';
  container.style.borderRadius = '8px';
  container.style.backgroundColor = '#f0f8ff';
  
  const title = document.createElement('h2');
  title.textContent = 'Exchange 3 Tiles';
  title.style.marginBottom = '20px';
  title.style.textAlign = 'center';
  
  const instruction = document.createElement('p');
  instruction.textContent = 'Select 3 tiles of the same suit to exchange (clockwise)';
  instruction.style.marginBottom = '20px';
  instruction.style.textAlign = 'center';
  instruction.style.fontSize = '16px';
  
  const handWrap = document.createElement('div');
  handWrap.style.marginBottom = '20px';
  
  const selectedIndices = new Set<number>();
  const chengduState = state as any;
  const currentSelections = chengduState.exchangeSelections?.P0 || [];
  
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm Exchange';
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
      confirmBtn.textContent = 'Waiting for other players...';
      confirmBtn.style.backgroundColor = '#ccc';
      confirmBtn.style.cursor = 'not-allowed';
    } else if (selectedIndices.size === 3) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm Exchange';
      confirmBtn.style.backgroundColor = '#4a90e2';
      confirmBtn.style.cursor = 'pointer';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Confirm Exchange';
      confirmBtn.style.backgroundColor = '#ccc';
      confirmBtn.style.cursor = 'not-allowed';
    }
  };
  
  const renderHandWithSelection = () => {
    handWrap.innerHTML = '';
    const handDiv = document.createElement('div');
    handDiv.style.display = 'flex';
    handDiv.style.flexWrap = 'wrap';
    handDiv.style.gap = '6px';
    handDiv.style.justifyContent = 'center';
    
    // Sort tiles before rendering
    const sortedHand = sortTiles(state.hands.P0);
    
    sortedHand.forEach((tile, index) => {
      const btn = document.createElement('button');
      btn.textContent = `${tile.suit}${tile.rank}`;
      btn.style.padding = '12px 16px';
      btn.style.fontSize = '16px';
      btn.style.border = '2px solid #ccc';
      btn.style.borderRadius = '4px';
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
    selectedInfo.textContent = `Selected: ${selectedIndices.size}/3`;
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
}

function renderEndPhase(root: HTMLElement, _ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  
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
  
  // 显示最终手牌
  const finalHandsSection = document.createElement('div');
  finalHandsSection.style.marginTop = '30px';
  
  for (const pid of ['P0', 'P1', 'P2', 'P3'] as const) {
    const playerDiv = document.createElement('div');
    playerDiv.style.marginBottom = '15px';
    playerDiv.style.padding = '10px';
    playerDiv.style.backgroundColor = state.declaredHu[pid] ? '#d4edda' : '#fff';
    playerDiv.style.borderRadius = '8px';
    
    const playerLabel = document.createElement('div');
    playerLabel.style.fontWeight = 'bold';
    playerLabel.style.marginBottom = '5px';
    playerLabel.textContent = `${pid}${pid === 'P0' ? ' (You)' : ''}${state.declaredHu[pid] ? ' - Winner' : ''}:`;
    
    const handDisplay = document.createElement('div');
    handDisplay.style.fontSize = '14px';
    handDisplay.textContent = state.hands[pid].map((t: Tile) => `${t.suit}${t.rank}`).join(' ');
    
    playerDiv.appendChild(playerLabel);
    playerDiv.appendChild(handDisplay);
    finalHandsSection.appendChild(playerDiv);
  }
  
  container.appendChild(finalHandsSection);
  
  // 重新开始按钮
  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'New Game';
  restartBtn.style.marginTop = '30px';
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
  
  container.appendChild(restartBtn);
  root.appendChild(container);
}

function renderDingQuePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  
  const container = document.createElement('div');
  container.style.maxWidth = '900px';
  container.style.margin = '40px auto';
  container.style.padding = '20px';
  container.style.border = '2px solid #4a90e2';
  container.style.borderRadius = '8px';
  container.style.backgroundColor = '#f0f8ff';
  
  const title = document.createElement('h2');
  title.textContent = 'Choose Missing Suit';
  title.style.marginBottom = '20px';
  title.style.textAlign = 'center';
  
  const instruction = document.createElement('p');
  instruction.textContent = 'Select which suit you will not use to win (required for Chengdu rules)';
  instruction.style.marginBottom = '20px';
  instruction.style.textAlign = 'center';
  instruction.style.fontSize = '16px';
  
  const chengduState = state as any;
  const hasSelected = chengduState.dingQueSelection?.P0;
  
  if (hasSelected) {
    const waiting = document.createElement('div');
    const suitName = hasSelected === 'W' ? 'Wan' : hasSelected === 'B' ? 'Bamboo' : 'Dot';
    waiting.textContent = `Selected missing suit: ${suitName}. Waiting for other players...`;
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
  handTitle.textContent = 'Your Current Hand:';
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
    const tileBtn = document.createElement('div');
    tileBtn.textContent = `${tile.suit}${tile.rank}`;
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
  countInfo.textContent = `Wan: ${suitCounts.W} | Bamboo: ${suitCounts.B} | Dot: ${suitCounts.T}`;
  
  handSection.appendChild(handTitle);
  handSection.appendChild(handDisplay);
  handSection.appendChild(countInfo);
  
  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '20px';
  btnContainer.style.justifyContent = 'center';
  
  const suits = [
    { suit: 'W' as const, name: 'Wan', count: suitCounts.W },
    { suit: 'B' as const, name: 'Bamboo', count: suitCounts.B },
    { suit: 'T' as const, name: 'Dot', count: suitCounts.T },
  ];
  
  for (const { suit, name, count } of suits) {
    const btn = document.createElement('button');
    btn.textContent = `${name} (${count})`;
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
}
