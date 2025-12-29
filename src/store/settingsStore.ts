export type Difficulty = 'high';
export type RuleId = 'placeholder' | 'chengdu';
export type UiMode = 'DEBUG' | 'TABLE';

type Listener = () => void;

class SettingsStore {
  difficulty: Difficulty = 'high';
  ruleId: RuleId = 'chengdu';
  analysisEnabled = true;
  llmEnabled = true;
  uiMode: UiMode = 'TABLE';
  timeoutEnabled = false;
  timeoutMs = 30000;
  p0IsAI = false; // P0 AI 模式，用于测试（默认开启）

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

  setTimeoutEnabled(enabled: boolean): void {
    this.timeoutEnabled = enabled;
    this.emit();
  }

  setTimeoutMs(ms: number): void {
    this.timeoutMs = ms;
    this.emit();
  }

  setP0IsAI(enabled: boolean): void {
    this.p0IsAI = enabled;
    this.emit();
  }
}

export const settingsStore = new SettingsStore();
