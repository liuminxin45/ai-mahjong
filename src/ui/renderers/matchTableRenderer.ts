import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderDiscardGrid } from '../components/DiscardGrid';
import { renderTile } from '../components/tileView';
import { renderEventLine } from '../components/eventLogView';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import type { PlayerId } from '../../core/model/types';
import type { Meld } from '../../core/model/state';
import { sortTiles } from '../../core/rules/packs/chengdu/sort';
import { languageStore } from '../../store/languageStore';

const playerOrder: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
const seatDirectionByPlayer: Record<PlayerId, 'bottom' | 'right' | 'top' | 'left'> = {
  P0: 'bottom',
  P1: 'right',
  P2: 'top',
  P3: 'left',
};
const hiddenTileStub: Tile = { suit: 'W', rank: 1 };

export function renderTableMode(root: HTMLElement, ctx: UiCtx): void {
  const state = ctx.gameStore.state;

  if (!state) {
    root.innerHTML = '<div style="padding:var(--sp-8);text-align:center;color:var(--text-muted);">No match running.</div>';
    return;
  }

  if (state.phase === 'EXCHANGE') {
    renderExchangePhase(root, ctx, state);
    return;
  }
  if (state.phase === 'DING_QUE') {
    renderDingQuePhase(root, ctx, state);
    return;
  }
  if (state.phase === 'END') {
    renderEndPhase(root, ctx, state);
    return;
  }

  root.innerHTML = '';

  const tableScreen = document.createElement('div');
  tableScreen.className = 'pixel-table-screen';

  const table = document.createElement('section');
  table.className = 'pixel-table';
  table.setAttribute('aria-label', 'Mahjong table');

  const chengduState = state as any;
  const dingQueSelections = chengduState.dingQueSelection || {};

  table.appendChild(renderOpponentSeat('P2', state, dingQueSelections));
  table.appendChild(renderOpponentSeat('P3', state, dingQueSelections));
  table.appendChild(renderOpponentSeat('P1', state, dingQueSelections));
  table.appendChild(renderCenterBoard(state));
  table.appendChild(renderSelfAvatar(state.currentPlayer === 'P0'));
  table.appendChild(renderPlayerSeat(ctx, state, dingQueSelections));

  tableScreen.appendChild(table);
  root.appendChild(tableScreen);
}

function renderOpponentSeat(
  playerId: PlayerId,
  state: any,
  dingQueSelections: Record<string, 'W' | 'B' | 'T' | undefined>,
): HTMLElement {
  const direction = seatDirectionByPlayer[playerId];
  const seat = document.createElement('section');
  seat.className = `pixel-seat pixel-seat--${direction}`;

  seat.appendChild(renderOpponentAvatar(playerId, state.currentPlayer === playerId));
  const header = renderSeatHeader(playerId, state.currentPlayer === playerId, dingQueSelections[playerId], state.hands[playerId].length);
  seat.appendChild(header);
  seat.appendChild(renderHiddenHand(state.hands[playerId].length, direction));

  if (state.melds[playerId]?.length) {
    seat.appendChild(renderCompactMelds(state.melds[playerId], 'pixel-meld-strip pixel-meld-strip--opponent'));
  }

  return seat;
}

function renderOpponentAvatar(playerId: PlayerId, isCurrent: boolean): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = isCurrent
    ? `pixel-rival pixel-rival--${playerId.toLowerCase()} pixel-rival--active`
    : `pixel-rival pixel-rival--${playerId.toLowerCase()}`;
  wrap.setAttribute('aria-hidden', 'true');

  const sprite = document.createElement('div');
  sprite.className = 'pixel-rival__sprite';

  const hat = document.createElement('span');
  hat.className = 'pixel-rival__hat';
  sprite.appendChild(hat);

  const hair = document.createElement('span');
  hair.className = 'pixel-rival__hair';
  sprite.appendChild(hair);

  const head = document.createElement('span');
  head.className = 'pixel-rival__head';
  sprite.appendChild(head);

  const eyeLeft = document.createElement('span');
  eyeLeft.className = 'pixel-rival__eye pixel-rival__eye--left';
  sprite.appendChild(eyeLeft);

  const eyeRight = document.createElement('span');
  eyeRight.className = 'pixel-rival__eye pixel-rival__eye--right';
  sprite.appendChild(eyeRight);

  const body = document.createElement('span');
  body.className = 'pixel-rival__body';
  sprite.appendChild(body);

  const emblem = document.createElement('span');
  emblem.className = 'pixel-rival__emblem';
  sprite.appendChild(emblem);

  wrap.appendChild(sprite);
  return wrap;
}

function renderSelfAvatar(isCurrent: boolean): HTMLElement {
  const anchor = document.createElement('div');
  anchor.className = 'pixel-self-avatar';
  anchor.appendChild(renderOpponentAvatar('P0', isCurrent));
  return anchor;
}

function renderPlayerSeat(
  ctx: UiCtx,
  state: any,
  dingQueSelections: Record<string, 'W' | 'B' | 'T' | undefined>,
): HTMLElement {
  const seat = document.createElement('section');
  seat.className = 'pixel-seat pixel-seat--bottom';

  const meldCountP0 = state.melds.P0.length;
  const baseP0 = 13 - meldCountP0 * 3;
  const canDiscard = !state.lastDiscard && state.currentPlayer === 'P0' && state.hands.P0.length === baseP0 + 1;
  const onClick = canDiscard
    ? (tile: Tile) => {
      const action: Action = { type: 'DISCARD', tile };
      ctx.orchestrator.dispatchHumanAction(action);
    }
    : undefined;

  const legal = ctx.orchestrator.getLegalActions('P0');
  const reactionTargetTiles: Tile[] =
    state.lastDiscard && state.lastDiscard.from !== 'P0'
      ? legal
        .filter((action) => action.type === 'PENG' || action.type === 'GANG')
        .map((action) => action.tile)
      : [];

  const handShell = document.createElement('div');
  handShell.className = 'pixel-hand-shell';

  const chrome = document.createElement('div');
  chrome.className = 'pixel-hand-shell__chrome';
  chrome.appendChild(renderSeatHeader('P0', state.currentPlayer === 'P0', dingQueSelections.P0, state.hands.P0.length, true));

  if (!ctx.settingsStore.p0IsAI) {
    chrome.appendChild(renderReactionRow(ctx, state));
  }

  handShell.appendChild(chrome);
  if (state.melds.P0.length > 0) {
    handShell.appendChild(renderCompactMelds(state.melds.P0, 'pixel-meld-strip pixel-meld-strip--self-tray'));
  }
  handShell.appendChild(renderHand(state.hands.P0, onClick, dingQueSelections.P0, reactionTargetTiles));
  seat.appendChild(handShell);

  return seat;
}

function renderSeatHeader(
  playerId: PlayerId,
  isCurrent: boolean,
  missingSuit: 'W' | 'B' | 'T' | undefined,
  handCount: number,
  isSelf = false,
): HTMLElement {
  const t = languageStore.t().game;
  const header = document.createElement('div');
  header.className = isCurrent ? 'pixel-seat__header pixel-seat__header--active' : 'pixel-seat__header';

  const title = document.createElement('div');
  title.className = isCurrent ? 'pixel-seat__title pixel-seat__title--active' : 'pixel-seat__title';
  title.textContent = isSelf ? `${playerId} / ${t.you}` : playerId;
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'pixel-seat__meta';

  const count = document.createElement('span');
  count.className = 'pixel-seat__badge';
  count.textContent = `${handCount}`;
  meta.appendChild(count);

  if (missingSuit) {
    const badge = document.createElement('span');
    badge.className = 'pixel-seat__badge pixel-seat__badge--accent';
    badge.textContent = missingSuit === 'W' ? t.wan : missingSuit === 'B' ? t.tiao : t.bing;
    meta.appendChild(badge);
  }
  header.appendChild(meta);
  return header;
}

function renderHiddenHand(count: number, direction: 'top' | 'right' | 'left' | 'bottom'): HTMLElement {
  const hand = document.createElement('div');
  hand.className = `pixel-hidden-hand pixel-hidden-hand--${direction}`;

  for (let i = 0; i < count; i += 1) {
    hand.appendChild(renderTile(hiddenTileStub, 'xs', 'back'));
  }

  return hand;
}

function renderCompactMelds(melds: Meld[], className: string): HTMLElement {
  const t = languageStore.t().game;
  const strip = document.createElement('div');
  strip.className = className;

  for (const meld of melds) {
    const group = document.createElement('div');
    group.className = `pixel-meld-group pixel-meld-group--${meld.type.toLowerCase()}`;
    const tag = document.createElement('span');
    tag.className = 'pixel-meld-group__tag';
    tag.textContent = meld.type === 'GANG' ? t.gang : t.peng;
    group.appendChild(tag);

    const tiles = document.createElement('div');
    tiles.className = 'pixel-meld-group__tiles';
    const tileCount = meld.type === 'GANG' ? 4 : 3;
    for (let i = 0; i < tileCount; i += 1) {
      tiles.appendChild(renderTile(meld.tile, 'sm', 'meld'));
    }
    group.appendChild(tiles);
    strip.appendChild(group);
  }

  return strip;
}

function renderCenterBoard(state: any): HTMLElement {
  const center = document.createElement('section');
  center.className = 'pixel-center';

  const wall = document.createElement('div');
  wall.className = 'pixel-table__wall';
  wall.textContent = `${languageStore.t().game.wallRemaining} ${state.wall.length}`;
  center.appendChild(wall);

  center.appendChild(renderDiscardLane(state.discards.P2, 'top', state.lastDiscard?.from === 'P2'));
  center.appendChild(renderDiscardLane(state.discards.P3, 'left', state.lastDiscard?.from === 'P3'));
  center.appendChild(renderDiscardLane(state.discards.P1, 'right', state.lastDiscard?.from === 'P1'));
  center.appendChild(renderDiscardLane(state.discards.P0, 'bottom', state.lastDiscard?.from === 'P0'));

  return center;
}

function renderDiscardLane(
  discards: Tile[],
  direction: 'top' | 'right' | 'bottom' | 'left',
  focusLast: boolean,
): HTMLElement {
  const lane = document.createElement('div');
  lane.className = `pixel-discard-lane pixel-discard-lane--${direction}`;
  lane.appendChild(renderDiscardGrid(discards, direction, focusLast));
  return lane;
}

function renderReactionRow(ctx: UiCtx, state: any): HTMLElement {
  const t = languageStore.t().game;
  const row = document.createElement('div');
  row.className = 'pixel-actions';

  const legal = ctx.orchestrator.getLegalActions('P0');
  const reactions = legal.filter((action) => action.type === 'PASS' || action.type === 'PENG' || action.type === 'GANG' || action.type === 'HU');
  const hasRealReactions = reactions.some((action) => action.type !== 'PASS');
  const actions: Action[] = [];

  if (state.lastDiscard && state.lastDiscard.from !== 'P0' && hasRealReactions) {
    const hu = reactions.find((action) => action.type === 'HU');
    const gangs = reactions.filter((action) => action.type === 'GANG');
    const peng = reactions.find((action) => action.type === 'PENG');
    const pass = reactions.find((action) => action.type === 'PASS');

    if (hu) actions.push(hu);
    actions.push(...gangs);
    if (peng) actions.push(peng);
    if (pass) actions.push(pass);
  }

  if (state.currentPlayer === 'P0' && !state.lastDiscard) {
    const selfActions = legal.filter((action) => action.type === 'HU' || action.type === 'GANG');
    actions.push(...selfActions);
  }

  if (actions.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'pixel-actions__hint';
    hint.textContent = state.currentPlayer === 'P0' ? '选择要打出的牌' : '';
    row.appendChild(hint);
    return row;
  }

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pixel-action-btn pixel-action-btn--${action.type.toLowerCase()}`;
    btn.textContent = formatActionLabel(action, t);
    btn.onclick = () => ctx.orchestrator.dispatchHumanAction(action);
    row.appendChild(btn);
  }

  return row;
}

function formatActionLabel(action: Action, t: ReturnType<typeof languageStore.t>['game']): string {
  if (action.type !== 'GANG') {
    return mapActionLabel(action.type, t);
  }

  const tile = `${action.tile.suit}${action.tile.rank}`;
  const gangPrefix =
    action.gangType === 'AN'
      ? '暗杠'
      : action.gangType === 'JIA'
        ? '补杠'
        : action.gangType === 'MING'
          ? '明杠'
          : '杠';

  return `${gangPrefix} ${tile}`;
}

function renderExchangePhase(root: HTMLElement, ctx: UiCtx, state: any): void {
  root.innerHTML = '';
  const t = languageStore.t().game;
  const container = createPhaseShell(t.exchangeTitle, t.exchangeInstruction);
  const body = container.querySelector('.phase-shell__body') as HTMLElement;
  const actions = container.querySelector('.phase-shell__actions') as HTMLElement;

  const selectedIndices = new Set<number>();

  const handWrap = document.createElement('div');
  handWrap.className = 'phase-shell__hand';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'phase-cta phase-cta--gold';

  const updateButtonState = () => {
    confirmBtn.disabled = selectedIndices.size !== 3;
    confirmBtn.textContent = t.exchangeConfirm;
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
  };

  renderHandWithSelection();
  updateButtonState();
  body.appendChild(handWrap);
  actions.appendChild(confirmBtn);
  root.appendChild(container);
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
    name.textContent = pid === 'P0' ? t.you : pid;

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
      item.appendChild(renderCompactMelds(state.melds[pid], 'pixel-meld-strip pixel-meld-strip--result'));
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
    const text = replay.events.map((event) => renderEventLine(event)).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      copyLogBtn.textContent = '✓ 已复制';
      setTimeout(() => { copyLogBtn.textContent = t.copyLog; }, 2000);
    }).catch(() => {
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
  restartBtn.onclick = () => {
    ctx.orchestrator.startNewMatch(ctx.settingsStore.ruleId);
    ctx.navigate('#/match');
  };

  actions.appendChild(copyLogBtn);
  actions.appendChild(restartBtn);
  panel.appendChild(list);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  root.appendChild(overlay);
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
