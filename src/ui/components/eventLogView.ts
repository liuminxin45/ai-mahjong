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
  wrap.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  wrap.style.fontSize = '12px';
  wrap.style.whiteSpace = 'pre-wrap';
  wrap.style.border = '1px solid #eee';
  wrap.style.borderRadius = '8px';
  wrap.style.padding = '8px';
  wrap.style.maxHeight = '240px';
  wrap.style.overflow = 'auto';

  const lines = events.slice(-20).map(renderEventLine);
  wrap.textContent = lines.join('\n');
  return wrap;
}
