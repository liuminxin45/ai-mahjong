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
    root.innerHTML = '<div style="padding:var(--sp-8);text-align:center;color:var(--text-muted);">No match running.</div>';
    return;
  }

  // Phase-specific renders
  if (s.phase === 'EXCHANGE') { renderExchangePhase(root, ctx, s); return; }
  if (s.phase === 'DING_QUE') { renderDingQuePhase(root, ctx, s); return; }
  if (s.phase === 'END') { renderEndPhase(root, ctx, s); return; }

  root.innerHTML = '';
  const isMobile = window.innerWidth < 768;

  // Main layout: game area + optional log panel
  const mainContainer = document.createElement('div');
  mainContainer.style.cssText = `
    display: flex; flex-direction: ${isMobile ? 'column' : 'row'};
    gap: var(--sp-2); height: 100%; padding: var(--sp-2);
  `;

  // Game area
  const gameArea = document.createElement('div');
  gameArea.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; height: 100%;';

  // Mahjong table — 3 × 3 grid
  const table = document.createElement('div');
  table.className = 'mj-table';
  table.style.cssText = `
    display: grid;
    grid-template-columns: ${isMobile ? '56px 1fr 56px' : '110px 1fr 110px'};
    grid-template-rows: auto 1fr minmax(80px, auto);
    gap: var(--sp-1);
    max-width: 1200px; margin: 0 auto;
    height: 100%; padding: var(--sp-2);
  `;

  const chengduState = s as any;
  const dingQueSelections = chengduState.dingQueSelection || {};
  const t = languageStore.t().game;

  // --- Top row: P2 info ---
  const topPanel = renderCompactPlayerInfo('P2', s.hands.P2.length, s.melds.P2, s.currentPlayer === 'P2', dingQueSelections.P2, t);
  topPanel.style.gridColumn = '1 / 4';

  // --- Middle row: P3 | Center | P1 ---
  const leftPanel = renderCompactPlayerInfo('P3', s.hands.P3.length, s.melds.P3, s.currentPlayer === 'P3', dingQueSelections.P3, t);

  const rightPanel = renderCompactPlayerInfo('P1', s.hands.P1.length, s.melds.P1, s.currentPlayer === 'P1', dingQueSelections.P1, t);

  // Center area: status + discards
  const centerArea = document.createElement('div');
  centerArea.style.cssText = `
    display: flex; flex-direction: column; align-items: center;
    justify-content: flex-start; gap: var(--sp-1);
    padding: var(--sp-2); overflow: auto;
    background: rgba(40, 80, 60, 0.3); border-radius: var(--r-md);
  `;

  // Status info
  const lastEvent = evs.length > 0 ? evs[evs.length - 1] : null;
  const lastActionText = lastEvent
    ? `${lastEvent.type} by ${lastEvent.playerId || 'system'}`
    : '';
  const centerStatus = renderCenterStatus(s.turn, s.wall.length, lastActionText);
  centerArea.appendChild(centerStatus);

  // Discard areas in cross pattern
  const discardsArea = document.createElement('div');
  discardsArea.style.cssText = `
    display: grid; grid-template-columns: 70px 1fr 70px;
    grid-template-rows: auto auto auto;
    gap: var(--sp-1); width: 100%; max-width: 500px;
  `;

  const p2Discards = renderDiscardArea('P2', s.discards.P2);
  p2Discards.style.cssText += 'grid-column:2; grid-row:1; max-width:300px; margin:0 auto;';

  const p3Discards = renderDiscardArea('P3', s.discards.P3);
  p3Discards.style.cssText += 'grid-column:1; grid-row:2; max-width:70px;';

  const p1Discards = renderDiscardArea('P1', s.discards.P1);
  p1Discards.style.cssText += 'grid-column:3; grid-row:2; max-width:70px;';

  const p0Discards = renderDiscardArea('P0', s.discards.P0);
  p0Discards.style.cssText += 'grid-column:2; grid-row:3; max-width:300px; margin:0 auto;';

  discardsArea.appendChild(p2Discards);
  discardsArea.appendChild(p3Discards);
  discardsArea.appendChild(p1Discards);
  discardsArea.appendChild(p0Discards);
  centerArea.appendChild(discardsArea);

  // --- Bottom row: P0 hand + actions ---
  const isP0Turn = s.currentPlayer === 'P0';
  const bottomSection = document.createElement('div');
  bottomSection.className = isP0Turn ? 'player-panel player-panel--active' : 'player-panel';
  bottomSection.style.cssText += `
    grid-column: 1 / 4; padding: var(--sp-3);
    overflow-y: auto;
  `;

  const p0Title = document.createElement('div');
  p0Title.style.cssText = `
    font-weight: var(--fw-semibold); font-size: var(--fs-sm);
    color: ${isP0Turn ? 'var(--c-primary-light)' : 'var(--text-secondary)'};
    margin-bottom: var(--sp-1); display: flex; align-items: center; gap: var(--sp-2);
  `;
  p0Title.textContent = `P0 (${t.you})`;

  if (dingQueSelections.P0) {
    const missBadge = document.createElement('span');
    missBadge.className = 'badge badge-gold';
    const suitName = dingQueSelections.P0 === 'W' ? t.wan : dingQueSelections.P0 === 'B' ? t.tiao : t.bing;
    missBadge.textContent = suitName;
    p0Title.appendChild(missBadge);
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

  // P0 melds display
  if (s.melds.P0.length > 0) {
    const meldsSection = document.createElement('div');
    meldsSection.style.cssText = `
      margin-top: var(--sp-2); padding: var(--sp-2);
      background: var(--bg-hover); border-radius: var(--r-md);
    `;

    const meldsLabel = document.createElement('div');
    meldsLabel.style.cssText = 'font-weight:var(--fw-semibold); margin-bottom:var(--sp-1); font-size:var(--fs-sm); color:var(--text-secondary);';
    meldsLabel.textContent = `${t.yourMelds}:`;
    meldsSection.appendChild(meldsLabel);

    const meldsDisplay = document.createElement('div');
    meldsDisplay.style.cssText = 'display:flex; gap:var(--sp-2); flex-wrap:wrap;';

    for (const meld of s.melds.P0) {
      const meldGroup = document.createElement('div');
      meldGroup.style.cssText = `
        display:flex; gap:2px; padding:var(--sp-1);
        background: var(--bg-active); border-radius: var(--r-sm);
      `;

      const tileCount = meld.type === 'GANG' ? 4 : 3;
      for (let i = 0; i < tileCount; i++) {
        const tileEl = renderTile(meld.tile, 'sm');
        meldGroup.appendChild(tileEl);
      }
      meldsDisplay.appendChild(meldGroup);
    }
    meldsSection.appendChild(meldsDisplay);
    handWrap.appendChild(meldsSection);
  }

  // Reaction buttons
  const p0Legal = ctx.orchestrator.getLegalActions('P0');
  const p0Reactions = p0Legal.filter((a) => a.type === 'PASS' || a.type === 'PENG' || a.type === 'GANG' || a.type === 'HU');
  const hasRealReactions = p0Reactions.some(a => a.type !== 'PASS');

  if (s.lastDiscard && s.lastDiscard.from !== 'P0' && hasRealReactions) {
    const rtitle = document.createElement('div');
    rtitle.style.cssText = 'margin-top:var(--sp-2); font-weight:var(--fw-semibold); font-size:var(--fs-sm); color:var(--text-secondary);';
    rtitle.textContent = `Response to ${s.lastDiscard.from} discard`;
    reactionWrap.appendChild(rtitle);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:var(--sp-2); flex-wrap:wrap; margin-top:var(--sp-1);';

    const order: Array<Action['type']> = ['HU', 'GANG', 'PENG', 'PASS'];
    for (const tp of order) {
      const act = p0Reactions.find((a) => a.type === tp);
      if (!act) continue;
      const b = document.createElement('button');
      b.textContent = act.type;
      b.onclick = () => ctx.orchestrator.dispatchHumanAction(act);

      if (act.type === 'HU') {
        applyChineseButtonStyle(b, 'success');
        b.classList.add('btn-lg');
      } else if (act.type === 'GANG' || act.type === 'PENG') {
        applyChineseButtonStyle(b, 'warning');
      } else {
        applyChineseButtonStyle(b, 'info');
      }
      btnRow.appendChild(b);
    }
    reactionWrap.appendChild(btnRow);
  }

  // Self-draw hu
  if (s.currentPlayer === 'P0' && !s.lastDiscard) {
    const selfDrawHu = p0Legal.find((a) => a.type === 'HU');
    if (selfDrawHu) {
      const sdTitle = document.createElement('div');
      sdTitle.style.cssText = 'margin-top:var(--sp-2); font-weight:var(--fw-bold); font-size:var(--fs-base); color:var(--c-success);';
      sdTitle.textContent = t.selfDrawWin;
      reactionWrap.appendChild(sdTitle);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex; gap:var(--sp-2); margin-top:var(--sp-1);';

      const huBtn = document.createElement('button');
      huBtn.textContent = selfDrawHu.type;
      huBtn.onclick = () => ctx.orchestrator.dispatchHumanAction(selfDrawHu);
      applyChineseButtonStyle(huBtn, 'success');
      huBtn.classList.add('btn-lg');
      btnRow.appendChild(huBtn);
      reactionWrap.appendChild(btnRow);
    }
  }

  bottomSection.appendChild(p0Title);
  bottomSection.appendChild(handWrap);
  bottomSection.appendChild(reactionWrap);

  table.appendChild(topPanel);
  table.appendChild(leftPanel);
  table.appendChild(centerArea);
  table.appendChild(rightPanel);
  table.appendChild(bottomSection);

  gameArea.appendChild(table);

  // Log panel (AI mode only)
  if (ctx.settingsStore.p0IsAI) {
    const logPanel = document.createElement('div');
    logPanel.style.cssText = isMobile
      ? 'width:100%; height:250px;'
      : 'width:320px; min-width:280px; max-width:400px; height:100%;';
    logPanel.classList.add('card');
    renderGameLogPanel(logPanel);
    mainContainer.appendChild(gameArea);
    mainContainer.appendChild(logPanel);
  } else {
    mainContainer.appendChild(gameArea);
  }

  root.appendChild(mainContainer);

  // AI params panel
  const existingPanel = document.getElementById('ai-params-panel');
  if (existingPanel) existingPanel.remove();
  const aiParamsPanel = renderAIParamsPanel();
  aiParamsPanel.id = 'ai-params-panel';
  root.appendChild(aiParamsPanel);

  // LLM chat button (human mode)
  if (!ctx.settingsStore.p0IsAI) {
    const existingChatBtn = document.getElementById('llm-chat-btn');
    if (existingChatBtn) existingChatBtn.remove();
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
  container.className = 'card-elevated animate-fadeIn';
  container.style.cssText = 'max-width:700px; margin:var(--sp-10) auto; padding:var(--sp-6);';

  const title = document.createElement('h2');
  title.style.cssText = 'text-align:center; color:var(--c-accent); margin-bottom:var(--sp-3);';
  title.textContent = t.exchangeTitle;

  const instruction = document.createElement('p');
  instruction.style.cssText = 'text-align:center; color:var(--text-secondary); font-size:var(--fs-base); margin-bottom:var(--sp-5);';
  instruction.textContent = t.exchangeInstruction;

  const handWrap = document.createElement('div');
  handWrap.style.marginBottom = 'var(--sp-5)';

  const selectedIndices = new Set<number>();
  const chengduState = state as any;
  const currentSelections = chengduState.exchangeSelections?.P0 || [];

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-accent btn-lg';
  confirmBtn.style.cssText = 'display:block; margin:0 auto; min-width:200px;';
  confirmBtn.textContent = t.exchangeConfirm;

  const updateButtonState = () => {
    if (currentSelections.length === 3) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t.exchangeWaiting;
      confirmBtn.className = 'btn btn-ghost btn-lg';
      confirmBtn.style.cssText = 'display:block; margin:0 auto; min-width:200px;';
    } else if (selectedIndices.size === 3) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = t.exchangeConfirm;
      confirmBtn.className = 'btn btn-accent btn-lg';
      confirmBtn.style.cssText = 'display:block; margin:0 auto; min-width:200px;';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t.exchangeConfirm;
      confirmBtn.className = 'btn btn-ghost btn-lg';
      confirmBtn.style.cssText = 'display:block; margin:0 auto; min-width:200px;';
    }
  };

  const renderHandWithSelection = () => {
    handWrap.innerHTML = '';
    const handDiv = document.createElement('div');
    handDiv.style.cssText = `
      display:flex; flex-wrap:nowrap; gap:4px; justify-content:center;
      overflow-x:auto; padding:var(--sp-2) 0;
    `;

    const sortedHand = sortTiles(state.hands.P0);

    sortedHand.forEach((tile, index) => {
      const btn = renderTileFn(tile, 'lg');
      btn.classList.add('mj-tile--clickable');
      (btn as HTMLButtonElement).style.flexShrink = '0';

      const isSelected = selectedIndices.has(index);
      if (isSelected) {
        btn.classList.add('mj-tile--selected');
      }

      (btn as HTMLButtonElement).onclick = () => {
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
    selectedInfo.style.cssText = 'margin-top:var(--sp-3); text-align:center; color:var(--text-secondary); font-size:var(--fs-sm);';
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

  const needConfirmation = !ctx.settingsStore.p0IsAI;
  const hasConfirmed = (state as any).endConfirmed || false;

  // Quick confirmation screen
  if (needConfirmation && !hasConfirmed) {
    const confirmContainer = document.createElement('div');
    confirmContainer.className = 'card-elevated animate-fadeIn';
    confirmContainer.style.cssText = `
      max-width:500px; margin:var(--sp-12) auto; padding:var(--sp-10);
      text-align:center;
    `;

    const message = document.createElement('div');
    message.style.cssText = 'font-size:var(--fs-2xl); margin-bottom:var(--sp-8); font-weight:var(--fw-bold);';

    const isWin = state.declaredHu.P0;
    const isLose = (['P1', 'P2', 'P3'] as const).some(pid => state.declaredHu[pid]);

    if (isWin) {
      message.textContent = '🎊 You Win! 🎊';
      message.style.color = 'var(--c-success)';
    } else if (isLose) {
      message.textContent = '😢 You Lose';
      message.style.color = 'var(--c-danger)';
    } else {
      message.textContent = '🤝 Draw';
      message.style.color = 'var(--text-secondary)';
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary btn-lg';
    confirmBtn.style.minWidth = '200px';
    confirmBtn.textContent = 'View Results';
    confirmBtn.onclick = () => {
      (state as any).endConfirmed = true;
      renderEndPhase(root, ctx, state);
    };

    confirmContainer.appendChild(message);
    confirmContainer.appendChild(confirmBtn);
    root.appendChild(confirmContainer);
    return;
  }

  // Full results screen
  const container = document.createElement('div');
  container.className = 'animate-slideUp';
  container.style.cssText = 'max-width:800px; margin:var(--sp-6) auto; padding:var(--sp-6);';

  const title = document.createElement('h2');
  title.style.cssText = 'text-align:center; color:var(--c-accent); margin-bottom:var(--sp-6);';
  title.textContent = '🎉 Game Over 🎉';

  // Winners
  const winners = (['P0', 'P1', 'P2', 'P3'] as const).filter(pid => state.declaredHu[pid]);

  if (winners.length > 0) {
    const winnerSection = document.createElement('div');
    winnerSection.style.cssText = 'text-align:center; margin-bottom:var(--sp-5);';

    for (const winner of winners) {
      const winnerText = document.createElement('div');
      winnerText.style.cssText = `
        font-size:var(--fs-xl); font-weight:var(--fw-bold); margin-bottom:var(--sp-2);
        color: ${winner === 'P0' ? 'var(--c-success)' : 'var(--c-danger)'};
      `;
      winnerText.textContent = winner === 'P0' ? '🎊 You Win! 🎊' : `${winner} Wins`;
      winnerSection.appendChild(winnerText);
    }
    container.appendChild(title);
    container.appendChild(winnerSection);
  } else {
    const drawText = document.createElement('div');
    drawText.style.cssText = 'font-size:var(--fs-xl); text-align:center; color:var(--text-secondary); margin-bottom:var(--sp-5);';
    drawText.textContent = 'Draw - No Winner';
    container.appendChild(title);
    container.appendChild(drawText);
  }

  const t = languageStore.t().game;

  // Final hands
  const finalHandsSection = document.createElement('div');
  finalHandsSection.style.cssText = 'display:flex; flex-direction:column; gap:var(--sp-3);';

  const chengduState = state as any;
  const scoreChanges = chengduState.roundScores || { P0: 0, P1: 0, P2: 0, P3: 0 };

  // Hu results from events
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
    playerDiv.className = state.declaredHu[pid] ? 'player-panel player-panel--winner' : 'player-panel';
    playerDiv.style.padding = 'var(--sp-3)';

    // Header row
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--sp-2);';

    const playerLabel = document.createElement('div');
    playerLabel.style.cssText = `
      font-weight:var(--fw-bold); font-size:var(--fs-base);
      color: ${state.declaredHu[pid] ? 'var(--c-accent)' : 'var(--text-primary)'};
    `;
    const youLabel = pid === 'P0' ? ` (${t.you})` : '';
    const winnerLabel = state.declaredHu[pid] ? ' 🏆' : '';
    playerLabel.textContent = `${pid}${youLabel}${winnerLabel}`;

    const scoreDiv = document.createElement('div');
    scoreDiv.style.fontWeight = 'var(--fw-semibold)';
    const scoreChange = scoreChanges[pid] || 0;
    if (scoreChange > 0) {
      scoreDiv.textContent = `+${scoreChange} ${t.score || 'pts'}`;
      scoreDiv.style.color = 'var(--c-success)';
    } else if (scoreChange < 0) {
      scoreDiv.textContent = `${scoreChange} ${t.score || 'pts'}`;
      scoreDiv.style.color = 'var(--c-danger)';
    } else {
      scoreDiv.textContent = `±0 ${t.score || 'pts'}`;
      scoreDiv.style.color = 'var(--text-muted)';
    }

    headerRow.appendChild(playerLabel);
    headerRow.appendChild(scoreDiv);
    playerDiv.appendChild(headerRow);

    // Hu info (yaku)
    if (state.declaredHu[pid] && huResults[pid]) {
      const huInfo = huResults[pid];
      const huInfoDiv = document.createElement('div');
      huInfoDiv.className = 'badge badge-gold';
      huInfoDiv.style.cssText += 'margin-bottom:var(--sp-2); display:inline-block;';

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

    // Hand display
    const handDisplay = document.createElement('div');
    handDisplay.style.cssText = 'display:flex; flex-wrap:wrap; gap:3px; margin-bottom:var(--sp-2);';

    const sortedHand = sortTiles(state.hands[pid]);
    for (const tile of sortedHand) {
      const tileEl = renderTile(tile, 'sm');
      handDisplay.appendChild(tileEl);
    }
    playerDiv.appendChild(handDisplay);

    // Melds display
    if (state.melds[pid] && state.melds[pid].length > 0) {
      const meldsDisplay = document.createElement('div');
      meldsDisplay.style.cssText = `
        display:flex; flex-wrap:wrap; gap:var(--sp-2);
        margin-top:var(--sp-1); padding-top:var(--sp-1);
        border-top:1px solid var(--border-subtle);
      `;

      for (const meld of state.melds[pid]) {
        const meldGroup = document.createElement('div');
        meldGroup.style.cssText = `
          display:flex; gap:1px; padding:2px 4px;
          background:var(--bg-hover); border-radius:var(--r-sm);
        `;

        const tileCount = meld.type === 'GANG' ? 4 : 3;
        for (let i = 0; i < tileCount; i++) {
          const tileEl = renderTile(meld.tile, 'sm');
          meldGroup.appendChild(tileEl);
        }
        meldsDisplay.appendChild(meldGroup);
      }
      playerDiv.appendChild(meldsDisplay);
    }

    finalHandsSection.appendChild(playerDiv);
  }

  container.appendChild(finalHandsSection);

  // Button group
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    margin-top:var(--sp-6); display:flex; gap:var(--sp-3);
    justify-content:center; flex-wrap:wrap;
  `;

  // Copy log button
  const copyLogBtn = document.createElement('button');
  copyLogBtn.className = 'btn btn-ghost btn-lg';
  copyLogBtn.textContent = '📋 Copy Game Log';

  copyLogBtn.onclick = () => {
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

  // New game button
  const restartBtn = document.createElement('button');
  restartBtn.className = 'btn btn-primary btn-lg';
  restartBtn.textContent = 'New Game';
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
  container.className = 'card-elevated animate-fadeIn';
  container.style.cssText = 'max-width:900px; margin:var(--sp-10) auto; padding:var(--sp-6);';

  const title = document.createElement('h2');
  title.style.cssText = 'text-align:center; color:var(--c-accent); margin-bottom:var(--sp-3);';
  title.textContent = t.dingTitle;

  const instruction = document.createElement('p');
  instruction.style.cssText = 'text-align:center; color:var(--text-secondary); font-size:var(--fs-base); margin-bottom:var(--sp-5);';
  instruction.textContent = t.dingInstruction;

  const chengduState = state as any;
  const hasSelected = chengduState.dingQueSelection?.P0;

  if (hasSelected) {
    const waiting = document.createElement('div');
    const suitName = getSuitLabel(hasSelected);
    waiting.textContent = t.dingSelected(suitName);
    waiting.style.cssText = 'text-align:center; font-size:var(--fs-xl); font-weight:var(--fw-bold); color:var(--c-accent);';
    container.appendChild(title);
    container.appendChild(waiting);
    root.appendChild(container);
    return;
  }

  // Hand display
  const handSection = document.createElement('div');
  handSection.style.marginBottom = 'var(--sp-6)';

  const handTitle = document.createElement('h3');
  handTitle.style.cssText = 'text-align:center; margin-bottom:var(--sp-3); color:var(--text-secondary);';
  handTitle.textContent = t.dingHandTitle;

  const handDisplay = document.createElement('div');
  handDisplay.style.cssText = `
    display:flex; flex-wrap:wrap; gap:6px; justify-content:center;
    padding:var(--sp-4); background:var(--bg-hover); border-radius:var(--r-md);
  `;

  const sortedHand = sortTiles(state.hands.P0);
  for (const tile of sortedHand) {
    const tileBtn = renderTileFn(tile, 'lg');
    handDisplay.appendChild(tileBtn);
  }

  // Suit counts
  const suitCounts = {
    W: sortedHand.filter(t => t.suit === 'W').length,
    B: sortedHand.filter(t => t.suit === 'B').length,
    T: sortedHand.filter(t => t.suit === 'T').length,
  };

  const countInfo = document.createElement('div');
  countInfo.style.cssText = 'margin-top:var(--sp-2); text-align:center; font-size:var(--fs-sm); color:var(--text-muted);';
  countInfo.textContent = t.dingSuitCount(suitCounts.W, suitCounts.B, suitCounts.T);

  handSection.appendChild(handTitle);
  handSection.appendChild(handDisplay);
  handSection.appendChild(countInfo);

  // Suit selection buttons
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display:flex; gap:var(--sp-4); justify-content:center; flex-wrap:wrap;';

  const suits = [
    { suit: 'W' as const, name: getSuitLabel('W'), count: suitCounts.W },
    { suit: 'B' as const, name: getSuitLabel('B'), count: suitCounts.B },
    { suit: 'T' as const, name: getSuitLabel('T'), count: suitCounts.T },
  ];

  for (const { suit, name, count } of suits) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-lg';
    btn.style.minWidth = '120px';
    btn.textContent = t.dingSuitOption(name, count);
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

// Helper: compact player info panel (no discards)
function renderCompactPlayerInfo(
  playerId: PlayerId,
  handCount: number,
  melds: Meld[],
  isCurrent: boolean,
  missingSuit?: 'W' | 'B' | 'T',
  t?: any
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = isCurrent ? 'player-panel player-panel--active' : 'player-panel';
  panel.style.cssText += 'font-size:var(--fs-sm); height:100%; box-sizing:border-box; overflow:hidden; padding:var(--sp-2);';

  const header = document.createElement('div');
  header.style.cssText = `
    font-weight:var(--fw-bold); margin-bottom:var(--sp-1);
    color: ${isCurrent ? 'var(--c-primary-light)' : 'var(--text-primary)'};
  `;
  header.textContent = `${playerId}${isCurrent ? ' ⬅' : ''}`;

  const handInfo = document.createElement('div');
  handInfo.style.cssText = 'font-size:var(--fs-xs); color:var(--text-muted);';
  handInfo.textContent = t ? `${t.hand}: ${handCount} ${t.tiles}` : `Hand: ${handCount} tiles`;

  panel.appendChild(header);
  panel.appendChild(handInfo);

  // Missing suit badge
  if (missingSuit && t) {
    const missingSuitInfo = document.createElement('span');
    missingSuitInfo.className = 'badge badge-gold';
    missingSuitInfo.style.cssText += 'margin-top:var(--sp-1); display:inline-block; font-size:10px;';
    const suitName = missingSuit === 'W' ? t.wan : missingSuit === 'B' ? t.tiao : t.bing;
    missingSuitInfo.textContent = suitName;
    panel.appendChild(missingSuitInfo);
  }

  // Melds (small tile images)
  if (melds.length > 0) {
    const meldsContainer = document.createElement('div');
    meldsContainer.style.cssText = 'margin-top:var(--sp-1); display:flex; flex-direction:column; gap:2px;';

    for (const meld of melds) {
      const meldRow = document.createElement('div');
      meldRow.style.cssText = 'display:flex; gap:1px;';

      const tileCount = meld.type === 'GANG' ? 4 : 3;
      for (let i = 0; i < tileCount; i++) {
        const tileEl = renderTile(meld.tile, 'sm');
        meldRow.appendChild(tileEl);
      }
      meldsContainer.appendChild(meldRow);
    }
    panel.appendChild(meldsContainer);
  }

  return panel;
}

// Helper: discard area (no label, no scrollbar)
function renderDiscardArea(
  _playerId: PlayerId,
  discards: Tile[]
): HTMLElement {
  const area = document.createElement('div');
  area.style.cssText = 'padding:2px; background:transparent; overflow:hidden;';
  const grid = renderDiscardGrid(discards);
  area.appendChild(grid);
  return area;
}
