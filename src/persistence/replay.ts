import type { GameEvent } from '../core/model/event';
import type { Difficulty, RuleId } from '../store/settingsStore';

export type ReplayMeta = {
  id: string;
  createdAt: number;
  rulePackId: string;
  rulePackVersion: string;
};

export type ReplaySettings = {
  difficulty: Difficulty;
  ruleId: RuleId;
  analysisEnabled: boolean;
};

export type ReplayFile = {
  meta: ReplayMeta;
  settings: ReplaySettings;
  events: GameEvent[];
};
