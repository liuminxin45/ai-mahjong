import type { GameEvent } from '../core/model/event';
import { tileToString } from '../core/model/tile';
import { settingsStore } from '../store/settingsStore';

/**
 * AudioEngine — 纯 Web Audio API 程序化合成（零二进制资产）。
 * 规格锚点：design/audio/AUDIO_DESIGN.md §3（SFX 表）/§4（总线与混音）。
 *
 * 关键约束：
 * - AudioContext 惰性创建，仅在首次用户手势后 resume（无自动播放，A11Y §1.1）。
 * - 总线结构 Master→[SFX/BGM/Voice]，Master 末端接 DynamicsCompressor 限幅。
 * - 并发预算：同时发声 SFX ≤ 16 voice；HU sting 同发 ≤ 3（§4.3）。
 * - BGM 不进 MVP：BGM 总线保留增益映射，但不调度任何声源（§6.2）。
 * - Voice 总线预留给 speechSynthesis（A11Y-C3，延后）。
 */

/** MVP 音效事件 ID（AUDIO_DESIGN §6.3 Must-have 集）。 */
export type SfxId =
  | 'SFX_DISCARD'
  | 'SFX_PENG'
  | 'SFX_GANG'
  | 'SFX_HU'
  | 'SFX_SETTLE_WIN'
  | 'SFX_SETTLE_LOSE'
  | 'SFX_FLOW_END'
  | 'SFX_FEEDBACK_CORRECT'
  | 'SFX_FEEDBACK_INCORRECT'
  | 'SFX_UI_CLICK';

export const MAX_VOICES = 16;
const MAX_HU_STINGS = 3;

type Envelope = { attack: number; decay: number; peak: number };

type OscSpec = {
  wave: OscillatorType;
  /** [起始频率, 结束频率]，结束频率缺省等于起始 */
  freq: [number, number?];
  env: Envelope;
};

type NoiseSpec = {
  bandHz: number;
  q: number;
  env: Envelope;
};

/** 单条音效定义：纯数据，便于测试。 */
export type SfxSpec = {
  duration: number;
  oscillators: OscSpec[];
  noise?: NoiseSpec;
};

/** 减弱模式（reduceIntensity）：缩短尾音、降亮度（AUDIO_DESIGN §4.5）。 */
function reduced(spec: SfxSpec): SfxSpec {
  return {
    duration: spec.duration * 0.6,
    oscillators: spec.oscillators.map((o) => ({
      ...o,
      env: { ...o.env, decay: o.env.decay * 0.6, peak: o.env.peak * 0.85 },
    })),
    noise: spec.noise
      ? { ...spec.noise, env: { ...spec.noise.env, decay: spec.noise.env.decay * 0.6 } }
      : undefined,
  };
}

/** 音色调色板（§1.3）。全部程序化合成参数。 */
const BASE_SPECS: Record<SfxId, SfxSpec> = {
  // Tile Clack：短噪声 band-pass ~3kHz + 180Hz 共振体
  SFX_DISCARD: {
    duration: 0.15,
    noise: { bandHz: 3000, q: 1.2, env: { attack: 0.002, decay: 0.07, peak: 0.5 } },
    oscillators: [{ wave: 'sine', freq: [180, 150], env: { attack: 0.002, decay: 0.12, peak: 0.35 } }],
  },
  // 碰：clack 加重 + 确认小上行
  SFX_PENG: {
    duration: 0.3,
    noise: { bandHz: 2600, q: 1.1, env: { attack: 0.002, decay: 0.09, peak: 0.55 } },
    oscillators: [
      { wave: 'sine', freq: [190, 160], env: { attack: 0.002, decay: 0.14, peak: 0.4 } },
      { wave: 'sine', freq: [523, 660], env: { attack: 0.01, decay: 0.16, peak: 0.25 } },
    ],
  },
  // Resonant Thud：低频 sine/triangle 共振，gangType 变体见 specsFor
  SFX_GANG: {
    duration: 0.45,
    noise: { bandHz: 2200, q: 1, env: { attack: 0.002, decay: 0.06, peak: 0.4 } },
    oscillators: [
      { wave: 'triangle', freq: [100, 70], env: { attack: 0.004, decay: 0.4, peak: 0.7 } },
      { wave: 'sine', freq: [200, 150], env: { attack: 0.004, decay: 0.3, peak: 0.3 } },
    ],
  },
  // Warm Bell：基频 + 纯五度，明亮上行
  SFX_HU: {
    duration: 1.2,
    oscillators: [
      { wave: 'sine', freq: [523], env: { attack: 0.01, decay: 1.0, peak: 0.5 } },
      { wave: 'sine', freq: [784], env: { attack: 0.01, decay: 1.0, peak: 0.35 } },
      { wave: 'sine', freq: [1046], env: { attack: 0.05, decay: 1.0, peak: 0.25 } },
    ],
  },
  // 结算·胜：上行琶音
  SFX_SETTLE_WIN: {
    duration: 1.5,
    oscillators: [
      { wave: 'sine', freq: [523], env: { attack: 0.01, decay: 1.3, peak: 0.4 } },
      { wave: 'sine', freq: [659], env: { attack: 0.08, decay: 1.2, peak: 0.35 } },
      { wave: 'sine', freq: [784], env: { attack: 0.16, decay: 1.2, peak: 0.35 } },
      { wave: 'sine', freq: [1046], env: { attack: 0.24, decay: 1.1, peak: 0.3 } },
    ],
  },
  // 结算·负：柔和低下行，非惩罚
  SFX_SETTLE_LOSE: {
    duration: 1.0,
    oscillators: [
      { wave: 'sine', freq: [330, 262], env: { attack: 0.02, decay: 0.9, peak: 0.35 } },
      { wave: 'triangle', freq: [165, 131], env: { attack: 0.02, decay: 0.9, peak: 0.3 } },
    ],
  },
  // 流局：中性收束
  SFX_FLOW_END: {
    duration: 0.8,
    oscillators: [
      { wave: 'sine', freq: [392], env: { attack: 0.01, decay: 0.7, peak: 0.3 } },
      { wave: 'sine', freq: [330], env: { attack: 0.1, decay: 0.6, peak: 0.3 } },
    ],
  },
  // 正确反馈：温暖上行铃（大三度）
  SFX_FEEDBACK_CORRECT: {
    duration: 0.4,
    oscillators: [
      { wave: 'sine', freq: [523, 659], env: { attack: 0.01, decay: 0.35, peak: 0.4 } },
      { wave: 'sine', freq: [1046], env: { attack: 0.04, decay: 0.3, peak: 0.2 } },
    ],
  },
  // 错误反馈：Soft Low Cue，低 triangle 下滑（"请再想想"）
  SFX_FEEDBACK_INCORRECT: {
    duration: 0.4,
    oscillators: [
      { wave: 'triangle', freq: [160, 120], env: { attack: 0.01, decay: 0.35, peak: 0.45 } },
      { wave: 'sine', freq: [80, 60], env: { attack: 0.01, decay: 0.35, peak: 0.25 } },
    ],
  },
  // UI 点击：极短噪声点击
  SFX_UI_CLICK: {
    duration: 0.05,
    noise: { bandHz: 4000, q: 1.5, env: { attack: 0.001, decay: 0.04, peak: 0.3 } },
    oscillators: [{ wave: 'sine', freq: [900, 700], env: { attack: 0.001, decay: 0.04, peak: 0.15 } }],
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private activeVoices = 0;
  private huStings = 0;
  private mutedByVisibility = false;

  constructor(private readonly ss: typeof settingsStore = settingsStore) {}

  /** 是否可发声（已初始化且设置允许）。 */
  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running' && this.ss.audioEnabled && !this.mutedByVisibility;
  }

  get contextState(): string {
    return this.ctx?.state ?? 'idle';
  }

  /** 首次用户手势后调用：创建/恢复 AudioContext。 */
  async ensureRunning(): Promise<boolean> {
    if (!this.ss.audioEnabled) return false;
    if (!this.ctx) this.initContext();
    if (!this.ctx) return false;
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    return this.ctx.state === 'running';
  }

  /** 后台标签页挂起 / 前台恢复（§4.3 省电）。 */
  setVisibilitySuspended(suspended: boolean): void {
    this.mutedByVisibility = suspended;
    if (!this.ctx) return;
    if (suspended) {
      void this.ctx.suspend().catch(() => undefined);
    } else if (this.ss.audioEnabled) {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  /** 设置变更时调用：总开关关闭立即静音并挂起。 */
  applySettings(): void {
    if (!this.ctx) return;
    const audio = this.ss.audio;
    const enabledGain = audio.enabled ? 1 : 0;
    this.master?.gain.setTargetAtTime(enabledGain, this.ctx.currentTime, 0.01);
    this.sfxBus?.gain.setTargetAtTime(audio.sfxVolume, this.ctx.currentTime, 0.01);
    this.bgmBus?.gain.setTargetAtTime(audio.bgmVolume, this.ctx.currentTime, 0.01);
    this.voiceBus?.gain.setTargetAtTime(audio.voiceVolume, this.ctx.currentTime, 0.01);
    if (!audio.enabled) {
      void this.ctx.suspend().catch(() => undefined);
    } else {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  /** 播放指定音效。未就绪（无手势/被禁用/超并发）时静默丢弃。 */
  play(id: SfxId, variant?: { gangType?: GameEvent['gangType'] }): void {
    if (!this.isReady || !this.sfxBus) return;
    if (this.activeVoices >= MAX_VOICES) return;
    if (id === 'SFX_HU' && this.huStings >= MAX_HU_STINGS) return;

    let spec = this.specFor(id, variant);
    if (this.ss.reduceAudioIntensity) spec = reduced(spec);

    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const track = (ended: () => void) => {
      this.activeVoices++;
      if (id === 'SFX_HU') this.huStings++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.activeVoices--;
        if (id === 'SFX_HU') this.huStings--;
        ended();
      };
      // 兜底释放（包络 stop 的 onended 应该先到，超时保护）
      setTimeout(release, (spec.duration + 0.3) * 1000);
      return release;
    };

    const noop = () => undefined;

    if (spec.noise) {
      const release = track(noop)!;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx, spec.noise.env.decay + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = spec.noise.bandHz;
      filter.Q.value = spec.noise.q;
      const gain = ctx.createGain();
      this.applyEnvelope(gain, spec.noise.env, t0);
      src.connect(filter).connect(gain).connect(this.sfxBus);
      src.onended = release;
      src.start(t0);
      src.stop(t0 + spec.noise.env.attack + spec.noise.env.decay + 0.05);
    }

    for (const osc of spec.oscillators) {
      const release = track(noop)!;
      const node = ctx.createOscillator();
      node.type = osc.wave;
      node.frequency.setValueAtTime(osc.freq[0], t0);
      if (osc.freq[1] && osc.freq[1] !== osc.freq[0]) {
        node.frequency.exponentialRampToValueAtTime(Math.max(1, osc.freq[1]), t0 + osc.env.attack + osc.env.decay);
      }
      const gain = ctx.createGain();
      this.applyEnvelope(gain, osc.env, t0);
      node.connect(gain).connect(this.sfxBus);
      node.onended = release;
      node.start(t0);
      node.stop(t0 + osc.env.attack + osc.env.decay + 0.05);
    }
  }

  /** 从 GameEvent 路由到 MVP 音效（§7.2 钩点表）。返回应播报的事件（供 aria-live）。 */
  sfxForEvent(ev: GameEvent, p0Result: 'HU' | 'LOSE' | 'DRAW' | null): SfxId | null {
    switch (ev.type) {
      case 'DISCARD':
        return 'SFX_DISCARD';
      case 'PENG':
        return 'SFX_PENG';
      case 'GANG':
        return 'SFX_GANG';
      case 'HU':
        return 'SFX_HU';
      case 'END':
        if (p0Result === 'HU') return 'SFX_SETTLE_WIN';
        if (p0Result === 'LOSE') return 'SFX_SETTLE_LOSE';
        return 'SFX_FLOW_END';
      default:
        return null;
    }
  }

  /** gangType / meta 变体（§3.5）：暗杠更闷、明杠更亮。 */
  private specFor(id: SfxId, variant?: { gangType?: GameEvent['gangType'] }): SfxSpec {
    const base = BASE_SPECS[id];
    if (id !== 'SFX_GANG' || !variant?.gangType) return base;
    const shift = variant.gangType === 'AN' ? 0.8 : variant.gangType === 'MING' ? 1.1 : 1.0;
    return {
      ...base,
      oscillators: base.oscillators.map((o) => ({
        ...o,
        freq: [o.freq[0] * shift, o.freq[1] ? o.freq[1] * shift : undefined] as [number, number?],
      })),
    };
  }

  private applyEnvelope(gain: GainNode, env: Envelope, t0: number): void {
    const g = gain.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0001, env.peak), t0 + env.attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + env.attack + env.decay);
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** 总线结构（§4.2）。 */
  private initContext(): void {
    if (typeof AudioContext === 'undefined') return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 4;
    this.compressor.knee.value = 12;
    this.compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(this.compressor);

    this.sfxBus = ctx.createGain();
    this.bgmBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.bgmBus.connect(this.master);
    this.voiceBus.connect(this.master);
    this.applySettings();
  }
}

export const audioEngine = new AudioEngine();

/** aria-live 播报文案（音频替代文本通道，AUDIO_DESIGN §5.2）。 */
export function describeEventForAnnouncement(
  ev: GameEvent,
  p0Result: 'HU' | 'LOSE' | 'DRAW' | null,
): string | null {
  const player = ev.playerId === 'P0' ? '你' : ev.playerId ?? '';
  const tile = ev.tile ? tileToString(ev.tile) : '';
  switch (ev.type) {
    case 'PENG':
      return ev.playerId === 'P0' ? `你碰了 ${tile}` : `${player} 碰了 ${tile}`;
    case 'GANG':
      return ev.playerId === 'P0' ? `你杠了 ${tile}` : `${player} 杠了 ${tile}`;
    case 'HU':
      return ev.playerId === 'P0' ? `你胡了，${tile}` : `${player} 胡了`;
    case 'DISCARD':
      return ev.playerId === 'P0' ? `你打出了 ${tile}` : null;
    case 'END':
      if (p0Result === 'HU') return '对局结束，你赢了';
      if (p0Result === 'LOSE') return '对局结束，你输了';
      return '对局结束，流局';
    default:
      return null;
  }
}
