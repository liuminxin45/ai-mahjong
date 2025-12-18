import type { GameEvent } from '../core/model/event';
import type { GameState } from '../core/model/state';

export type GameStatus = 'idle' | 'running' | 'ended';

type Listener = () => void;

class GameStore {
  state: GameState | null = null;
  events: GameEvent[] = [];
  status: GameStatus = 'idle';

  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  reset(): void {
    this.state = null;
    this.events = [];
    this.status = 'idle';
    this.emit();
  }

  setRunning(state: GameState): void {
    this.state = state;
    this.status = 'running';
    this.emit();
  }

  setEnded(state: GameState): void {
    this.state = state;
    this.status = 'ended';
    this.emit();
  }

  applyState(state: GameState): void {
    this.state = state;
    this.emit();
  }

  pushEvent(ev: GameEvent): void {
    this.events = this.events.concat([ev]);
    this.emit();
  }
}

export const gameStore = new GameStore();
