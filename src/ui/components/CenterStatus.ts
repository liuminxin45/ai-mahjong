import type { PlayerId } from '../../core/model/types';
import type { Tile } from '../../core/model/tile';
import { renderTile } from './tileView';
import { languageStore } from '../../store/languageStore';

type CenterStatusOptions = {
  currentPlayer: PlayerId;
  wallRemaining: number;
  turn: number;
  lastActionText: string;
  lastDiscardTile: Tile | null;
  lastDiscardFrom: PlayerId | null;
};

export function renderCenterStatus(options: CenterStatusOptions): HTMLElement {
  const t = languageStore.t().game;

  const center = document.createElement('div');
  center.className = 'center-hud';

  const core = document.createElement('div');
  core.className = 'center-hud__core';

  const wall = document.createElement('div');
  wall.className = 'center-hud__metric';
  wall.innerHTML = `<span>${t.wallRemaining}</span><strong>${options.wallRemaining}</strong>`;

  const turn = document.createElement('div');
  turn.className = 'center-hud__metric center-hud__metric--subtle';
  turn.innerHTML = `<span>${t.turn}</span><strong>${options.turn}</strong>`;

  const lastAction = document.createElement('div');
  lastAction.className = 'center-hud__action';
  lastAction.textContent = options.lastActionText || t.waiting;

  core.appendChild(wall);
  core.appendChild(turn);
  core.appendChild(lastAction);

  if (options.lastDiscardTile) {
    const focus = document.createElement('div');
    focus.className = 'center-hud__focus';

    const tile = renderTile(options.lastDiscardTile, 'md', 'discard-focus');
    const label = document.createElement('div');
    label.className = 'center-hud__focus-label';
    label.textContent = options.lastDiscardFrom ? `${options.lastDiscardFrom} ${t.discard}` : t.discard;

    focus.appendChild(tile);
    focus.appendChild(label);
    core.appendChild(focus);
  }

  center.appendChild(core);
  return center;
}
