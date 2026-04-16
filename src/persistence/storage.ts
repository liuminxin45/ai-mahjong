import type { ReplayFile } from './replay';

const STORAGE_KEY = 'ai-mahjong:latest-replay';

class PersistentStorage {
  private cache: ReplayFile | null = null;

  saveLatest(replay: ReplayFile): void {
    this.cache = replay;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(replay));
    } catch {
      // localStorage full or unavailable — keep in-memory fallback
    }
  }

  loadLatest(): ReplayFile | null {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw) as ReplayFile;
        return this.cache;
      }
    } catch {
      // parse error — ignore
    }
    return null;
  }
}

export const storage = new PersistentStorage();
