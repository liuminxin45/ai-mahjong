import type { GameEvent } from '../../core/model/event';
import { tileToString } from '../../core/model/tile';

export function renderEventLine(ev: GameEvent): string {
  if (ev.type === 'INIT') return `INIT t=${ev.turn}`;
  if (ev.type === 'DRAW') return `DRAW ${ev.playerId} ${ev.tile ? tileToString(ev.tile) : ''} t=${ev.turn}`;
  if (ev.type === 'DISCARD')
    return `DISCARD ${ev.playerId} ${ev.tile ? tileToString(ev.tile) : ''} t=${ev.turn}`;
  if (ev.type === 'PENG')
    return `PENG ${ev.playerId} ${ev.tile ? tileToString(ev.tile) : ''} from=${ev.from ?? ''} t=${ev.turn}`;
  if (ev.type === 'GANG')
    return `GANG ${ev.playerId} ${ev.tile ? tileToString(ev.tile) : ''} from=${ev.from ?? ''} ${ev.gangType ?? ''} t=${ev.turn}`;
  if (ev.type === 'HU')
    return `HU ${ev.playerId} ${ev.tile ? tileToString(ev.tile) : ''} from=${ev.from ?? ''} t=${ev.turn}`;
  if (ev.type === 'TURN') return `TURN -> ${ev.playerId} t=${ev.turn}`;
  if (ev.type === 'END') return `END t=${ev.turn}`;
  return JSON.stringify(ev);
}

export function renderEventLog(events: GameEvent[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-log pixel-log--compact';

  const lines = events.slice(-20).map(renderEventLine);
  wrap.textContent = lines.join('\n');
  return wrap;
}
