import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderEventLog } from '../components/eventLogView';
import { renderPlayerPanel } from '../components/PlayerPanel';
import { renderCenterStatus } from '../components/CenterStatus';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';

export function renderTableMode(root: HTMLElement, ctx: UiCtx): void {
  const s = ctx.gameStore.state;
  const evs = ctx.gameStore.events;

  if (!s) {
    root.innerHTML = '<div>No match running.</div>';
    return;
  }

  root.innerHTML = '';

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  tableContainer.style.display = 'grid';
  tableContainer.style.gridTemplateColumns = '200px 1fr 200px';
  tableContainer.style.gridTemplateRows = 'auto auto auto';
  tableContainer.style.gap = '12px';
  tableContainer.style.maxWidth = '1200px';
  tableContainer.style.margin = '0 auto';

  const topPanel = renderPlayerPanel('P2', s.hands.P2.length, s.discards.P2, s.currentPlayer === 'P2');
  topPanel.style.gridColumn = '2';
  topPanel.style.gridRow = '1';

  const leftPanel = renderPlayerPanel('P3', s.hands.P3.length, s.discards.P3, s.currentPlayer === 'P3');
  leftPanel.style.gridColumn = '1';
  leftPanel.style.gridRow = '2';

  const rightPanel = renderPlayerPanel('P1', s.hands.P1.length, s.discards.P1, s.currentPlayer === 'P1');
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
  bottomSection.style.border = '2px solid #4a90e2';
  bottomSection.style.padding = '12px';
  bottomSection.style.borderRadius = '4px';
  bottomSection.style.backgroundColor = '#f0f8ff';

  const p0Title = document.createElement('div');
  p0Title.style.fontWeight = '600';
  p0Title.style.marginBottom = '8px';
  p0Title.textContent = `P0 (You)${s.currentPlayer === 'P0' ? ' - Your Turn' : ''}`;

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

  bottomSection.appendChild(p0Title);
  bottomSection.appendChild(handWrap);
  bottomSection.appendChild(reactionWrap);

  tableContainer.appendChild(topPanel);
  tableContainer.appendChild(leftPanel);
  tableContainer.appendChild(centerStatus);
  tableContainer.appendChild(rightPanel);
  tableContainer.appendChild(bottomSection);

  const debugPanel = document.createElement('div');
  debugPanel.style.marginTop = '16px';
  debugPanel.style.maxHeight = '200px';
  debugPanel.style.overflow = 'auto';
  debugPanel.style.border = '1px solid #ddd';
  debugPanel.style.padding = '8px';
  debugPanel.style.borderRadius = '4px';
  debugPanel.style.backgroundColor = '#fafafa';

  const logTitle = document.createElement('div');
  logTitle.style.fontWeight = '600';
  logTitle.style.marginBottom = '4px';
  logTitle.textContent = 'Event Log (last 20)';

  const recentEvents = evs.slice(-20);
  debugPanel.appendChild(logTitle);
  debugPanel.appendChild(renderEventLog(recentEvents));

  root.appendChild(tableContainer);
  root.appendChild(debugPanel);
}
