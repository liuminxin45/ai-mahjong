import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderCenterStatus } from '../components/CenterStatus';
import { renderGameLogPanel } from '../components/GameLogPanel';
import { renderDiscardGrid } from '../components/DiscardGrid';
import { renderTile } from '../components/tileView';
import { renderEventLine } from '../components/eventLogView';
import { renderAIParamsPanel } from '../components/AIParamsPanel';
import { renderChatAssistantButton } from '../components/LLMChatAssistant';
import { initLLMConfig } from '../components/LLMSettingsPanel';
import { MahjongTableScene } from '../pixi/MahjongTableScene';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import type { PlayerId } from '../../core/model/types';
import type { GameEvent } from '../../core/model/event';
import type { Meld } from '../../core/model/state';
import { sortTiles } from '../../core/rules/packs/chengdu/sort';
import { languageStore } from '../../store/languageStore';

initLLMConfig();

const playerOrder: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
const playerScores: Record<PlayerId, number> = {
  P0: 4997,
  P1: 5000,
  P2: 5000,
  P3: 5003,
};

function getSeatWallCounts(wallRemaining: number): Record<PlayerId, number> {
  const perSide = Math.round(wallRemaining / 4);
  return {
    P0: wallRemaining - perSide * 3,
    P1: perSide,
    P2: perSide,
    P3: perSide,
  };
}

export function renderTableMode(root: HTMLElement, ctx: UiCtx): void {
  const s = ctx.gameStore.state;
  const evs = ctx.gameStore.events;

  if (!s) {
    root.innerHTML = '<div style="padding:var(--sp-8);text-align:center;color:var(--text-muted);">No match running.</div>';
    return;
  }

  if (s.phase === 'EXCHANGE') { renderExchangePhase(root, ctx, s); return; }
  if (s.phase === 'DING_QUE') { renderDingQuePhase(root, ctx, s); return; }
  if (s.phase === 'END') { renderEndPhase(root, ctx, s); return; }

  root.innerHTML = '';
  const t = languageStore.t().game;
  const chengduState = s as any;
  const dingQueSelections = chengduState.dingQueSelection || {};
  const lastEvent = evs.length > 0 ? evs[evs.length - 1] : null;

  const scene = document.createElement('div');
  scene.className = ctx.settingsStore.p0IsAI ? 'table-screen table-screen--spectator' : 'table-screen';

  const tableScene = document.createElement('div');
  tableScene.className = 'table-scene';

  mountPixiScene(tableScene, s, evs);
  tableScene.appendChild(renderPlayerAnchors(s, dingQueSelections));
  tableScene.appendChild(renderCenterZoneHudOnly(s, evs, lastEvent));
  tableScene.appendChild(renderBottomDock(ctx, s, dingQueSelections));
  mountTimer(tableScene);

  scene.appendChild(tableScene);

  if (ctx.settingsStore.p0IsAI) {
    const logPanel = document.createElement('div');
    logPanel.className = 'table-side-panel';
    renderGameLogPanel(logPanel);
    scene.appendChild(logPanel);
  }

  root.appendChild(scene);
  mountSharedPanels(root, ctx, s);
}

// --- Pixi scene management ---
let _pixiScene: MahjongTableScene | null = null;
let _pixiHost: HTMLElement | null = null;
let _pixiResizeObserver: ResizeObserver | null = null;

function mountPixiScene(tableScene: HTMLElement, state: any, evs: any[]): void {
  // If no existing host, create it
  if (!_pixiHost) {
    _pixiHost = document.createElement('div');
    _pixiHost.className = 'pixi-host';
    tableScene.insertBefore(_pixiHost, tableScene.firstChild);

    _pixiScene = new MahjongTableScene(_pixiHost);
    // Capture references so the closure uses the values at init time
    const capturedState = state;
    const capturedEvs = evs;
    void _pixiScene.init().then(() => {
      if (_pixiScene && _pixiHost) {
        _pixiScene.resize(_pixiHost.clientWidth, _pixiHost.clientHeight);
        _pixiScene.update(capturedState, capturedEvs);
      }
    });

    _pixiResizeObserver = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e && _pixiScene) {
        _pixiScene.resize(e.contentRect.width, e.contentRect.height);
      }
    });
    _pixiResizeObserver.observe(_pixiHost);
  } else {
    // Re-use existing scene, just update state
    tableScene.insertBefore(_pixiHost, tableScene.firstChild);
    if (_pixiScene) _pixiScene.update(state, evs);
  }
}

export function destroyPixiScene(): void {
  _pixiResizeObserver?.disconnect();
  _pixiResizeObserver = null;
  _pixiScene?.destroy();
  _pixiScene = null;
  _pixiHost?.remove();
  _pixiHost = null;
}

// --- Game timer ---
let _timerInterval: ReturnType<typeof setInterval> | null = null;
let _timerStartMs = 0;

function mountTimer(tableScene: HTMLElement): void {
  // Remove existing timer if any
  tableScene.querySelector('.game-timer')?.remove();

  const timerEl = document.createElement('div');
  timerEl.className = 'game-timer';
  tableScene.appendChild(timerEl);

  if (_timerInterval === null) {
    _timerStartMs = Date.now();
  }

  const update = () => {
    const elapsed = Math.floor((Date.now() - _timerStartMs) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  };
  update();

  if (_timerInterval === null) {
    _timerStartMs = Date.now();
    _timerInterval = setInterval(update, 1000);
  }
}

export function resetTimer(): void {
  if (_timerInterval !== null) clearInterval(_timerInterval);
  _timerInterval = null;
  _timerStartMs = 0;
}

function renderPlayerAnchors(state: any, dingQueSelections: Record<string, 'W' | 'B' | 'T' | undefined>): HTMLElement {
  const anchors = document.createElement('div');
  anchors.className = 'table-anchors';
  const wallCounts = getSeatWallCounts(state.wall.length);

  for (const playerId of playerOrder.filter((pid) => pid !== 'P0')) {
    const anchor = document.createElement('div');
    const dir = playerId === 'P1' ? 'right' : playerId === 'P2' ? 'top' : 'left';
    anchor.className = `table-anchor table-anchor--${dir}`;

    const seat = document.createElement('div');
    seat.className = `table-anchor__seat table-anchor__seat--${dir}`;

    const count = document.createElement('div');
    count.className = 'table-anchor__count';
    count.textContent = String(wallCounts[playerId]);
    seat.appendChild(count);

    const body = document.createElement('div');
    body.className = `table-anchor__body table-anchor__body--${dir}`;

    const chip = document.createElement('div');
    chip.className = state.currentPlayer === playerId ? 'score-chip score-chip--active' : 'score-chip';

    const name = document.createElement('span');
    name.className = 'score-chip__name';
    name.textContent = playerId;

    const score = document.createElement('span');
    score.className = 'score-chip__score';
    score.textContent = String(playerScores[playerId]);

    chip.appendChild(name);
    chip.appendChild(score);

    const dingQue = dingQueSelections[playerId];
    if (dingQue) {
      const suitBadge = document.createElement('span');
      suitBadge.className = 'table-pill table-pill--gold';
      suitBadge.textContent = dingQue === 'W' ? '万' : dingQue === 'B' ? '条' : '饼';
      chip.appendChild(suitBadge);
    }

    body.appendChild(chip);

    // Keep exposed melds aligned toward the center-facing side of each seat,
    // instead of floating over the remaining hand tiles.
    if (state.melds[playerId]?.length) {
      const meldRow = document.createElement('div');
      meldRow.className = `anchor-melds anchor-melds--${dir}`;
      for (const meld of state.melds[playerId] as Meld[]) {
        const group = document.createElement('div');
        group.className = 'anchor-melds__group';
        const tileCount = meld.type === 'GANG' ? 4 : 3;
        for (let i = 0; i < tileCount; i++) {
          group.appendChild(renderTile(meld.tile, 'sm', 'meld'));
        }
        meldRow.appendChild(group);
      }
      body.appendChild(meldRow);
    }

    seat.appendChild(body);
    anchor.appendChild(seat);
    anchors.appendChild(anchor);
  }

  return anchors;
}

/** Renders only the HUD card (compass + wall + turn). Discard/focus tiles are handled by Pixi. */
function renderCenterZoneHudOnly(state: any, evs: GameEvent[], lastEvent: GameEvent | null): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'table-center';

  const lastActionText = formatLastAction(lastEvent);
  zone.appendChild(renderCenterStatus({
    currentPlayer: state.currentPlayer,
    wallRemaining: state.wall.length,
    turn: state.turn,
    lastActionText,
    lastDiscardTile: null,  // shown by Pixi instead
    lastDiscardFrom: state.lastDiscard?.from ?? null,
  }));

  return zone;
}

/** @deprecated kept for reference — now handled by Pixi */
function renderCenterZone(state: any, evs: GameEvent[], lastEvent: GameEvent | null): HTMLElement {
  return renderCenterZoneHudOnly(state, evs, lastEvent);
}

function createDiscardTray(direction: 'top' | 'right' | 'bottom' | 'left', discards: Tile[], focusLast: boolean): HTMLElement {
  const tray = document.createElement('div');
  tray.className = `discard-tray discard-tray--${direction}`;
  tray.appendChild(renderDiscardGrid(discards, direction, focusLast));
  return tray;
}

function renderBottomDock(ctx: UiCtx, state: any, dingQueSelections: Record<string, 'W' | 'B' | 'T' | undefined>): HTMLElement {
  const t = languageStore.t().game;
  const dock = document.createElement('div');
  dock.className = 'hand-area';
  const wallCounts = getSeatWallCounts(state.wall.length);

  const handDock = document.createElement('div');
  handDock.className = state.currentPlayer === 'P0' ? 'player-hand-dock player-hand-dock--active' : 'player-hand-dock';

  // Minimal tag bar — no identity or tile-count text, just status pills
  if (dingQueSelections.P0 || state.currentPlayer === 'P0' || wallCounts.P0 >= 0) {
    const tags = document.createElement('div');
    tags.className = 'player-hand-dock__tags';
    if (dingQueSelections.P0) {
      const suit = document.createElement('span');
      suit.className = 'table-pill table-pill--gold';
      suit.textContent = dingQueSelections.P0 === 'W' ? t.wan : dingQueSelections.P0 === 'B' ? t.tiao : t.bing;
      tags.appendChild(suit);
    }
    if (state.currentPlayer === 'P0') {
      const active = document.createElement('span');
      active.className = 'table-pill table-pill--jade';
      active.textContent = '你的回合';
      tags.appendChild(active);
    }
    const wallCount = document.createElement('span');
    wallCount.className = 'table-pill table-pill--mist';
    wallCount.textContent = `${wallCounts.P0}`;
    tags.appendChild(wallCount);
    handDock.appendChild(tags);
  }

  if (state.melds.P0.length > 0) {
    handDock.appendChild(renderMeldStrip(state.melds.P0, '碰杠'));
  }

  const meldCountP0 = state.melds.P0.length;
  const baseP0 = 13 - meldCountP0 * 3;
  const canDiscard = !state.lastDiscard && state.currentPlayer === 'P0' && state.hands.P0.length === baseP0 + 1;
  const onClick = canDiscard
    ? (tile: Tile) => {
      const action: Action = { type: 'DISCARD', tile };
      ctx.orchestrator.dispatchHumanAction(action);
    }
    : undefined;
  handDock.appendChild(renderHand(state.hands.P0, onClick, dingQueSelections.P0));

  dock.appendChild(handDock);

  if (!ctx.settingsStore.p0IsAI) {
    dock.appendChild(renderReactionDock(ctx, state));
  }

  return dock;
}

function renderMeldStrip(melds: Meld[], label: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'meld-strip';

  const title = document.createElement('div');
  title.className = 'meld-strip__title';
  title.textContent = label;
  section.appendChild(title);

  const list = document.createElement('div');
  list.className = 'meld-strip__list';

  for (const meld of melds) {
    const group = document.createElement('div');
    group.className = 'meld-strip__group';
    const tileCount = meld.type === 'GANG' ? 4 : 3;
    for (let i = 0; i < tileCount; i++) {
      group.appendChild(renderTile(meld.tile, 'sm', 'meld'));
    }
    list.appendChild(group);
  }

  section.appendChild(list);
  return section;
}

function renderReactionDock(ctx: UiCtx, state: any): HTMLElement {
  const t = languageStore.t().game;
  const panel = document.createElement('div');
  panel.className = 'reaction-dock';

  const p0Legal = ctx.orchestrator.getLegalActions('P0');
  const p0Reactions = p0Legal.filter((a) => a.type === 'PASS' || a.type === 'PENG' || a.type === 'GANG' || a.type === 'HU');
  const hasRealReactions = p0Reactions.some((a) => a.type !== 'PASS');
  const actions: Action[] = [];

  if (state.lastDiscard && state.lastDiscard.from !== 'P0' && hasRealReactions) {
    actions.push(...['HU', 'GANG', 'PENG', 'PASS'].map((type) => p0Reactions.find((a) => a.type === type as Action['type'])).filter(Boolean) as Action[]);
  }

  if (state.currentPlayer === 'P0' && !state.lastDiscard) {
    const selfDrawHu = p0Legal.find((a) => a.type === 'HU');
    if (selfDrawHu) actions.push(selfDrawHu);
  }

  if (actions.length === 0) {
    panel.classList.add('reaction-dock--hidden');
    const hintText = state.currentPlayer === 'P0' ? '请选择要打出的牌' : '';
    if (hintText) {
      panel.innerHTML = `<div class="reaction-dock__hint">${hintText}</div>`;
    }
    return panel;
  }

  const list = document.createElement('div');
  list.className = 'reaction-dock__actions';

  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-btn reaction-btn--${action.type.toLowerCase()}`;
    btn.textContent = mapActionLabel(action.type, t);
    btn.onclick = () => ctx.orchestrator.dispatchHumanAction(action);
    list.appendChild(btn);
  });

  panel.appendChild(list);
  return panel;
}

// Wall ring removed — rendered by Pixi MahjongTableScene

function mountSharedPanels(root: HTMLElement, ctx: UiCtx, state: any): void {
  const existingPanel = document.getElementById('ai-params-panel');
  if (existingPanel) existingPanel.remove();
  const aiParamsPanel = renderAIParamsPanel();
  aiParamsPanel.id = 'ai-params-panel';
  root.appendChild(aiParamsPanel);

  const existingChatBtn = document.getElementById('llm-chat-btn');
  if (existingChatBtn) existingChatBtn.remove();
  if (!ctx.settingsStore.p0IsAI) {
    const chatBtn = renderChatAssistantButton(state);
    chatBtn.id = 'llm-chat-btn';
    root.appendChild(chatBtn);
  }
}

function renderExchangePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const container = createPhaseShell(t.exchangeTitle, t.exchangeInstruction);
  const body = container.querySelector('.phase-shell__body') as HTMLElement;
  const actions = container.querySelector('.phase-shell__actions') as HTMLElement;

  const selectedIndices = new Set<number>();
  const chengduState = state as any;
  const currentSelections = chengduState.exchangeSelections?.P0 || [];

  const handWrap = document.createElement('div');
  handWrap.className = 'phase-shell__hand';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'phase-cta phase-cta--gold';

  const updateButtonState = () => {
    if (currentSelections.length === 3) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = t.exchangeWaiting;
    } else {
      confirmBtn.disabled = selectedIndices.size !== 3;
      confirmBtn.textContent = t.exchangeConfirm;
    }
  };

  const renderHandWithSelection = () => {
    handWrap.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'phase-shell__tiles';

    const sortedHand = sortTiles(state.hands.P0);
    sortedHand.forEach((tile, index) => {
      const tileEl = renderTile(tile, 'lg', 'hand') as HTMLButtonElement;
      tileEl.classList.add('mj-tile--clickable');
      if (selectedIndices.has(index)) tileEl.classList.add('mj-tile--selected');
      tileEl.onclick = () => {
        if (selectedIndices.has(index)) selectedIndices.delete(index);
        else if (selectedIndices.size < 3) selectedIndices.add(index);
        updateButtonState();
        renderHandWithSelection();
      };
      row.appendChild(tileEl);
    });

    const helper = document.createElement('div');
    helper.className = 'phase-shell__helper';
    helper.textContent = t.exchangeSelected(selectedIndices.size);

    handWrap.appendChild(row);
    handWrap.appendChild(helper);
  };

  confirmBtn.onclick = () => {
    if (selectedIndices.size !== 3) return;
    const sortedHand = sortTiles(state.hands.P0);
    const selectedTiles = Array.from(selectedIndices).map((idx) => sortedHand[idx]);
    ctx.orchestrator.dispatchHumanAction({ type: 'EXCHANGE_SELECT', tiles: selectedTiles });
    setTimeout(() => ctx.orchestrator.dispatchHumanAction({ type: 'EXCHANGE_CONFIRM' }), 100);
  };

  renderHandWithSelection();
  updateButtonState();
  body.appendChild(handWrap);
  actions.appendChild(confirmBtn);
  root.appendChild(container);
  mountSharedPanels(root, ctx, state);
}

function renderDingQuePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const getSuitLabel = (suit: 'W' | 'B' | 'T') => suit === 'W' ? t.wan : suit === 'B' ? t.tiao : t.bing;
  const container = createPhaseShell(t.dingTitle, t.dingInstruction);
  const body = container.querySelector('.phase-shell__body') as HTMLElement;
  const actions = container.querySelector('.phase-shell__actions') as HTMLElement;
  const chengduState = state as any;
  const hasSelected = chengduState.dingQueSelection?.P0;

  if (hasSelected) {
    const waiting = document.createElement('div');
    waiting.className = 'phase-shell__helper phase-shell__helper--hero';
    waiting.textContent = t.dingSelected(getSuitLabel(hasSelected));
    body.appendChild(waiting);
    root.appendChild(container);
    mountSharedPanels(root, ctx, state);
    return;
  }

  const handDisplay = document.createElement('div');
  handDisplay.className = 'phase-shell__tiles';

  const sortedHand = sortTiles(state.hands.P0);
  for (const tile of sortedHand) {
    handDisplay.appendChild(renderTile(tile, 'lg', 'hand'));
  }

  const suitCounts = {
    W: sortedHand.filter((tile) => tile.suit === 'W').length,
    B: sortedHand.filter((tile) => tile.suit === 'B').length,
    T: sortedHand.filter((tile) => tile.suit === 'T').length,
  };

  const helper = document.createElement('div');
  helper.className = 'phase-shell__helper';
  helper.textContent = t.dingSuitCount(suitCounts.W, suitCounts.B, suitCounts.T);

  body.appendChild(handDisplay);
  body.appendChild(helper);

  (['W', 'B', 'T'] as const).forEach((suit) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'phase-cta';
    btn.textContent = t.dingSuitOption(getSuitLabel(suit), suitCounts[suit]);
    btn.onclick = () => ctx.orchestrator.dispatchHumanAction({ type: 'DING_QUE', suit });
    actions.appendChild(btn);
  });

  root.appendChild(container);
  mountSharedPanels(root, ctx, state);
}

function renderEndPhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const overlay = document.createElement('div');
  overlay.className = 'phase-screen phase-screen--end';

  const panel = document.createElement('div');
  panel.className = 'result-panel animate-slideUp';

  const title = document.createElement('div');
  title.className = 'result-panel__title';
  if (state.declaredHu.P0) title.textContent = t.youWin;
  else if ((['P1', 'P2', 'P3'] as const).some((pid) => state.declaredHu[pid])) title.textContent = t.youLose;
  else title.textContent = t.drawResult;
  panel.appendChild(title);

  const rounds = (state as any).roundScores || { P0: 0, P1: 0, P2: 0, P3: 0 };
  const list = document.createElement('div');
  list.className = 'result-panel__players';

  for (const pid of playerOrder) {
    const item = document.createElement('div');
    item.className = state.declaredHu[pid] ? 'result-player result-player--winner' : 'result-player';

    const row = document.createElement('div');
    row.className = 'result-player__row';

    const name = document.createElement('div');
    name.className = 'result-player__name';
    name.textContent = pid === 'P0' ? '你' : pid;

    const score = document.createElement('div');
    score.className = 'result-player__score';
    const delta = rounds[pid] || 0;
    score.textContent = delta > 0 ? `+${delta}` : `${delta}`;

    row.appendChild(name);
    row.appendChild(score);
    item.appendChild(row);

    const hand = document.createElement('div');
    hand.className = 'result-player__hand';
    for (const tile of sortTiles(state.hands[pid])) {
      hand.appendChild(renderTile(tile, 'sm', 'meld'));
    }
    item.appendChild(hand);

    if (state.melds[pid]?.length) {
      item.appendChild(renderMeldStrip(state.melds[pid], '碰杠'));
    }

    list.appendChild(item);
  }

  const actions = document.createElement('div');
  actions.className = 'result-panel__actions';

  const copyLogBtn = document.createElement('button');
  copyLogBtn.type = 'button';
  copyLogBtn.className = 'phase-cta';
  copyLogBtn.textContent = t.copyLog;
  copyLogBtn.onclick = () => {
    const replay = ctx.orchestrator.exportReplay();
    const lines = replay.events.map(ev => renderEventLine(ev));
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      copyLogBtn.textContent = '✓ 已复制';
      setTimeout(() => { copyLogBtn.textContent = t.copyLog; }, 2000);
    }).catch(() => {
      // Fallback: select text in a temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      copyLogBtn.textContent = '✓ 已复制';
      setTimeout(() => { copyLogBtn.textContent = t.copyLog; }, 2000);
    });
  };

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'phase-cta phase-cta--gold';
  restartBtn.textContent = t.newGame;
  restartBtn.onclick = () => window.location.reload();

  actions.appendChild(copyLogBtn);
  actions.appendChild(restartBtn);
  panel.appendChild(list);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  root.appendChild(overlay);
  mountSharedPanels(root, ctx, state);
}

function createPhaseShell(titleText: string, descriptionText: string): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'phase-screen';
  shell.innerHTML = `
    <div class="phase-shell animate-slideUp">
      <div class="phase-shell__title">${titleText}</div>
      <div class="phase-shell__desc">${descriptionText}</div>
      <div class="phase-shell__body"></div>
      <div class="phase-shell__actions"></div>
    </div>
  `;
  return shell;
}

function mapActionLabel(type: Action['type'], t: ReturnType<typeof languageStore.t>['game']): string {
  switch (type) {
    case 'HU': return t.hu;
    case 'GANG': return t.gang;
    case 'PENG': return t.peng;
    case 'PASS': return t.pass;
    default: return type;
  }
}

function formatLastAction(event: GameEvent | null): string {
  const t = languageStore.t().game;
  if (!event) return t.waiting;
  const actor = event.playerId ?? '系统';
  switch (event.type) {
    case 'DRAW': return `${actor} 摸牌`;
    case 'DISCARD': return `${actor} 打出`;
    case 'PENG': return `${actor} 碰牌`;
    case 'GANG': return `${actor} 杠牌`;
    case 'HU': return `${actor} 胡牌`;
    case 'TURN': return `${actor} ${t.thinking}`;
    case 'END': return t.gameOver;
    default: return `${actor} 行动`;
  }
}
