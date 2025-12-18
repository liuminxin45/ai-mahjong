import type { GameOrchestrator } from '../orchestration/GameOrchestrator';
import type { HeuristicAnalyzer } from '../analysis/HeuristicAnalyzer';
import type { LLMAnalyzer } from '../analysis/LLMAnalyzer';

export type UiCtx = {
  orchestrator: GameOrchestrator;
  gameStore: typeof import('../store/gameStore').gameStore;
  settingsStore: typeof import('../store/settingsStore').settingsStore;
  analyzer: HeuristicAnalyzer;
  llmAnalyzer: LLMAnalyzer | null;
  storage: typeof import('../persistence/storage').storage;
  navigate: (hash: string) => void;
};
