/**
 * 游戏日志存储
 * 用于在 UI 中显示游戏日志
 */

export interface GameLogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'action' | 'phase' | 'error';
}

type Listener = () => void;

class GameLogStore {
  private logs: GameLogEntry[] = [];
  private readonly listeners = new Set<Listener>();
  private maxLogs = 1000; // 最多保存 1000 条日志

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  addLog(message: string, type: GameLogEntry['type'] = 'info'): void {
    const entry: GameLogEntry = {
      timestamp: Date.now(),
      message,
      type,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    this.emit();
  }

  getLogs(): GameLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    this.emit();
  }

  getAllLogsAsText(): string {
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `[${time}] ${log.message}`;
    }).join('\n');
  }
}

export const gameLogStore = new GameLogStore();
