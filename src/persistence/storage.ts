import type { ReplayFile } from './replay';

class MemoryStorage {
  // TODO: replace with persistent storage (localStorage/IndexedDB/file) when needed.
  private latest: ReplayFile | null = null;

  saveLatest(replay: ReplayFile): void {
    this.latest = replay;
  }

  loadLatest(): ReplayFile | null {
    return this.latest;
  }
}

export const storage = new MemoryStorage();
