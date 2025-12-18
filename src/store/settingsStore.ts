export type Difficulty = 'low' | 'mid' | 'high';
export type RuleId = 'placeholder' | 'chengdu';
export type UiMode = 'DEBUG' | 'TABLE';

type Listener = () => void;

class SettingsStore {
  difficulty: Difficulty = 'mid';
  ruleId: RuleId = 'placeholder';
  analysisEnabled = false;
  llmEnabled = false;
  uiMode: UiMode = 'TABLE';

  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.emit();
  }

  setRuleId(ruleId: RuleId): void {
    this.ruleId = ruleId;
    this.emit();
  }

  setAnalysisEnabled(enabled: boolean): void {
    this.analysisEnabled = enabled;
    this.emit();
  }

  setLlmEnabled(enabled: boolean): void {
    this.llmEnabled = enabled;
    this.emit();
  }

  setUiMode(mode: UiMode): void {
    this.uiMode = mode;
    this.emit();
  }
}

export const settingsStore = new SettingsStore();
