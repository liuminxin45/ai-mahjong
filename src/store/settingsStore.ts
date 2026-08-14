export type Difficulty = 'high' | 'mid' | 'low';
export type RuleId = 'placeholder' | 'chengdu';
export type UiMode = 'DEBUG' | 'TABLE';

type Listener = () => void;

/** 音频设置子对象（AUDIO_DESIGN.md §4.5）。 */
export interface AudioSettings {
  /** 总开关（默认 true，但首屏手势前实际静默） */
  enabled: boolean;
  /** 音效音量 0..1，默认 0.80 */
  sfxVolume: number;
  /** 音乐音量 0..1，默认 0.35（BGM 不进 MVP，仅预留总线） */
  bgmVolume: number;
  /** 语音音量 0..1，默认 1.00（A11Y-C3 预留） */
  voiceVolume: number;
  /** 减弱模式：缩短 sting 尾音、降亮度（呼应 prefers-reduced-motion） */
  reduceIntensity: boolean;
}

export interface PersistedSettings {
  difficulty: Difficulty;
  ruleId: RuleId;
  analysisEnabled: boolean;
  llmEnabled: boolean;
  uiMode: UiMode;
  timeoutEnabled: boolean;
  timeoutMs: number;
  p0IsAI: boolean;
  trainingGames: number;
  trainingBlocking: boolean;
  trainingVerbose: boolean;
  uiScale: number;
  hudSafeZonePercent: number;
  audio: AudioSettings;
}

export const SETTINGS_STORAGE_KEY = 'ai-mahjong:settings';

const DEFAULT_AUDIO: AudioSettings = {
  enabled: true,
  sfxVolume: 0.8,
  bgmVolume: 0.35,
  voiceVolume: 1,
  reduceIntensity: false,
};

const DEFAULT_SETTINGS: PersistedSettings = {
  difficulty: 'high',
  ruleId: 'chengdu',
  analysisEnabled: true,
  llmEnabled: true,
  uiMode: 'TABLE',
  timeoutEnabled: false,
  timeoutMs: 30000,
  p0IsAI: false,
  trainingGames: 100,
  trainingBlocking: false,
  trainingVerbose: false,
  uiScale: 1,
  hudSafeZonePercent: 3,
  audio: DEFAULT_AUDIO,
};

/** 尊重 prefers-reduced-motion：作为 reduceIntensity 的默认来源（AUDIO_DESIGN §4.5）。 */
function detectReduceMotionDefault(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sanitizeAudio(audio?: Partial<AudioSettings>): AudioSettings {
  // 只接受真正的 number（null / 字符串 / NaN 均回落默认）
  const sfxVolume = typeof audio?.sfxVolume === 'number' ? audio.sfxVolume : NaN;
  const bgmVolume = typeof audio?.bgmVolume === 'number' ? audio.bgmVolume : NaN;
  const voiceVolume = typeof audio?.voiceVolume === 'number' ? audio.voiceVolume : NaN;
  return {
    enabled: typeof audio?.enabled === 'boolean' ? audio.enabled : DEFAULT_AUDIO.enabled,
    sfxVolume: Number.isFinite(sfxVolume) ? clampVolume(sfxVolume) : DEFAULT_AUDIO.sfxVolume,
    bgmVolume: Number.isFinite(bgmVolume) ? clampVolume(bgmVolume) : DEFAULT_AUDIO.bgmVolume,
    voiceVolume: Number.isFinite(voiceVolume) ? clampVolume(voiceVolume) : DEFAULT_AUDIO.voiceVolume,
    reduceIntensity: typeof audio?.reduceIntensity === 'boolean'
      ? audio.reduceIntensity
      : detectReduceMotionDefault(),
  };
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function sanitizeSettings(settings?: Partial<PersistedSettings>): PersistedSettings {
  const timeoutMs = Number(settings?.timeoutMs);
  const trainingGames = Number(settings?.trainingGames);
  const uiScale = Number(settings?.uiScale);
  const hudSafeZonePercent = Number(settings?.hudSafeZonePercent);

  return {
    difficulty:
      settings?.difficulty === 'high' || settings?.difficulty === 'mid' || settings?.difficulty === 'low'
        ? settings.difficulty
        : DEFAULT_SETTINGS.difficulty,
    ruleId: settings?.ruleId === 'placeholder' ? 'placeholder' : 'chengdu',
    analysisEnabled: typeof settings?.analysisEnabled === 'boolean' ? settings.analysisEnabled : DEFAULT_SETTINGS.analysisEnabled,
    llmEnabled: typeof settings?.llmEnabled === 'boolean' ? settings.llmEnabled : DEFAULT_SETTINGS.llmEnabled,
    uiMode: settings?.uiMode === 'DEBUG' ? 'DEBUG' : 'TABLE',
    timeoutEnabled: typeof settings?.timeoutEnabled === 'boolean' ? settings.timeoutEnabled : DEFAULT_SETTINGS.timeoutEnabled,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1000
      ? Math.min(120000, Math.floor(timeoutMs))
      : DEFAULT_SETTINGS.timeoutMs,
    p0IsAI: typeof settings?.p0IsAI === 'boolean' ? settings.p0IsAI : DEFAULT_SETTINGS.p0IsAI,
    trainingGames: Number.isFinite(trainingGames) && trainingGames >= 1
      ? Math.min(10000, Math.floor(trainingGames))
      : DEFAULT_SETTINGS.trainingGames,
    trainingBlocking: typeof settings?.trainingBlocking === 'boolean' ? settings.trainingBlocking : DEFAULT_SETTINGS.trainingBlocking,
    trainingVerbose: typeof settings?.trainingVerbose === 'boolean' ? settings.trainingVerbose : DEFAULT_SETTINGS.trainingVerbose,
    uiScale: Number.isFinite(uiScale) ? Math.max(0.85, Math.min(1.35, uiScale)) : DEFAULT_SETTINGS.uiScale,
    hudSafeZonePercent: Number.isFinite(hudSafeZonePercent)
      ? Math.max(0, Math.min(8, Math.round(hudSafeZonePercent)))
      : DEFAULT_SETTINGS.hudSafeZonePercent,
    audio: sanitizeAudio(settings?.audio),
  };
}

function loadPersistedSettings(): PersistedSettings {
  if (!hasLocalStorage()) return DEFAULT_SETTINGS;

  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(saved) as Partial<PersistedSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

class SettingsStore {
  private state: PersistedSettings;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.state = loadPersistedSettings();
    this.persist();
  }

  get difficulty(): Difficulty { return this.state.difficulty; }
  set difficulty(difficulty: Difficulty) { this.update({ difficulty }); }

  get ruleId(): RuleId { return this.state.ruleId; }
  set ruleId(ruleId: RuleId) { this.update({ ruleId }); }

  get analysisEnabled(): boolean { return this.state.analysisEnabled; }
  set analysisEnabled(analysisEnabled: boolean) { this.update({ analysisEnabled }); }

  get llmEnabled(): boolean { return this.state.llmEnabled; }
  set llmEnabled(llmEnabled: boolean) { this.update({ llmEnabled }); }

  get uiMode(): UiMode { return this.state.uiMode; }
  set uiMode(uiMode: UiMode) { this.update({ uiMode }); }

  get timeoutEnabled(): boolean { return this.state.timeoutEnabled; }
  set timeoutEnabled(timeoutEnabled: boolean) { this.update({ timeoutEnabled }); }

  get timeoutMs(): number { return this.state.timeoutMs; }
  set timeoutMs(timeoutMs: number) { this.update({ timeoutMs }); }

  get p0IsAI(): boolean { return this.state.p0IsAI; }
  set p0IsAI(p0IsAI: boolean) { this.update({ p0IsAI }); }

  get trainingGames(): number { return this.state.trainingGames; }
  set trainingGames(trainingGames: number) { this.update({ trainingGames }); }

  get trainingBlocking(): boolean { return this.state.trainingBlocking; }
  set trainingBlocking(trainingBlocking: boolean) { this.update({ trainingBlocking }); }

  get trainingVerbose(): boolean { return this.state.trainingVerbose; }
  set trainingVerbose(trainingVerbose: boolean) { this.update({ trainingVerbose }); }

  get uiScale(): number { return this.state.uiScale; }
  set uiScale(uiScale: number) { this.update({ uiScale }); }

  get hudSafeZonePercent(): number { return this.state.hudSafeZonePercent; }
  set hudSafeZonePercent(hudSafeZonePercent: number) { this.update({ hudSafeZonePercent }); }

  get audio(): AudioSettings { return { ...this.state.audio }; }
  get audioEnabled(): boolean { return this.state.audio.enabled; }
  set audioEnabled(enabled: boolean) { this.updateAudio({ enabled }); }
  get sfxVolume(): number { return this.state.audio.sfxVolume; }
  set sfxVolume(sfxVolume: number) { this.updateAudio({ sfxVolume }); }
  get bgmVolume(): number { return this.state.audio.bgmVolume; }
  set bgmVolume(bgmVolume: number) { this.updateAudio({ bgmVolume }); }
  get voiceVolume(): number { return this.state.audio.voiceVolume; }
  set voiceVolume(voiceVolume: number) { this.updateAudio({ voiceVolume }); }
  get reduceAudioIntensity(): boolean { return this.state.audio.reduceIntensity; }
  set reduceAudioIntensity(reduceIntensity: boolean) { this.updateAudio({ reduceIntensity }); }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private persist(): void {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore persistence errors in restricted environments.
    }
  }

  private update(patch: Partial<PersistedSettings>): void {
    const next = sanitizeSettings({ ...this.state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    this.persist();
    this.emit();
  }

  private updateAudio(patch: Partial<AudioSettings>): void {
    this.update({ audio: { ...this.state.audio, ...patch } });
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  setRuleId(ruleId: RuleId): void {
    this.ruleId = ruleId;
  }

  setAnalysisEnabled(enabled: boolean): void {
    this.analysisEnabled = enabled;
  }

  setLlmEnabled(enabled: boolean): void {
    this.llmEnabled = enabled;
  }

  setUiMode(mode: UiMode): void {
    this.uiMode = mode;
  }

  setTimeoutEnabled(enabled: boolean): void {
    this.timeoutEnabled = enabled;
  }

  setTimeoutMs(ms: number): void {
    this.timeoutMs = ms;
  }

  setP0IsAI(enabled: boolean): void {
    this.p0IsAI = enabled;
  }

  setTrainingGames(games: number): void {
    this.trainingGames = games;
  }

  setTrainingBlocking(enabled: boolean): void {
    this.trainingBlocking = enabled;
  }

  setTrainingVerbose(enabled: boolean): void {
    this.trainingVerbose = enabled;
  }

  setUiScale(uiScale: number): void {
    this.uiScale = uiScale;
  }

  setHudSafeZonePercent(percent: number): void {
    this.hudSafeZonePercent = percent;
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = volume;
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = volume;
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = volume;
  }

  setReduceAudioIntensity(enabled: boolean): void {
    this.reduceAudioIntensity = enabled;
  }
}

export const settingsStore = new SettingsStore();
