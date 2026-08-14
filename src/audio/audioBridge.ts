import type { GameEvent } from '../core/model/event';
import type { GameState } from '../core/model/state';
import type { PlayerId } from '../core/model/types';
import { audioEngine, describeEventForAnnouncement } from './AudioEngine';
import { settingsStore } from '../store/settingsStore';
import { testConfig } from '../config/testConfig';

/**
 * audioBridge — AudioEngine 的接线层（AUDIO_DESIGN §7.2 钩点表）。
 *
 * 职责：
 * 1. 订阅 gameStore 事件流 → 路由到 SFX（G1/G3/G4/G5/G12/G13/G14）。
 * 2. match 页 aria-live 播报区（音频替代文本通道，A11Y-S2）。
 * 3. 全局 UI_CLICK（捕获阶段委托到 button/select/input，不打断业务处理）。
 * 4. visibilitychange 挂起/恢复 AudioContext。
 * 5. settingsStore 订阅 → 总线增益实时更新。
 *
 * 非职责：BGM 调度（MVP 不含）、speechSynthesis（延后）。
 *
 * 训练模式下完全惰性：不创建 AudioContext、不响（play 内部也会因未就绪而丢弃）。
 */

type GameStoreLike = {
  events: GameEvent[];
  state: GameState | null;
  status: 'idle' | 'running' | 'ended';
  subscribe(listener: () => void): () => void;
};

export type AudioBridgeHandle = { dispose: () => void };

function p0ResultFrom(state: GameState | null): 'HU' | 'LOSE' | 'DRAW' | null {
  if (!state || state.phase !== 'END') return null;
  if (state.declaredHu.P0) return 'HU';
  const others: PlayerId[] = ['P1', 'P2', 'P3'];
  if (others.some((pid) => state.declaredHu[pid])) return 'LOSE';
  return 'DRAW';
}

/** 在 match 页创建 aria-live 播报区并订阅事件流。页面卸载时 dispose。 */
export function attachAudioBridge(
  container: HTMLElement,
  gameStore: GameStoreLike,
): AudioBridgeHandle {
  // aria-live 播报区：视觉隐藏的 role="status" 文本区（§5.2）。
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.className = 'audio-announcer';
  liveRegion.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
  container.appendChild(liveRegion);

  let lastIndex = gameStore.events.length;
  let announcedResult: 'HU' | 'LOSE' | 'DRAW' | null = null;

  const onGameEvent = () => {
    const events = gameStore.events;
    if (events.length < lastIndex) {
      // 对局重置
      lastIndex = 0;
      announcedResult = null;
      liveRegion.textContent = '';
    }
    for (let i = lastIndex; i < events.length; i++) {
      const ev = events[i];
      const p0Result = ev.type === 'END' ? p0ResultFrom(gameStore.state) : null;
      const sfxId = audioEngine.sfxForEvent(ev, p0Result);
      if (sfxId) {
        audioEngine.play(sfxId, { gangType: ev.gangType });
      }
      const text = describeEventForAnnouncement(ev, p0Result);
      if (text) liveRegion.textContent = text;
      if (p0Result) announcedResult = p0Result;
    }
    lastIndex = events.length;
    // END 事件已在循环内处理；状态直接 setEnded 的兜底
    if (gameStore.status === 'ended' && !announcedResult) {
      const result = p0ResultFrom(gameStore.state);
      if (result) {
        announcedResult = result;
        const sfxId = result === 'HU' ? 'SFX_SETTLE_WIN' : result === 'LOSE' ? 'SFX_SETTLE_LOSE' : 'SFX_FLOW_END';
        audioEngine.play(sfxId);
        liveRegion.textContent =
          result === 'HU' ? '对局结束，你赢了' : result === 'LOSE' ? '对局结束，你输了' : '对局结束，流局';
      }
    }
  };

  const unsubGame = gameStore.subscribe(onGameEvent);

  // 设置变更 → 总线增益实时更新（§7.2）
  const unsubSettings = settingsStore.subscribe(() => audioEngine.applySettings());

  // 全局 UI_CLICK：捕获阶段事件委托（§3.2 U1）。不打断任何业务 handler。
  const clickTarget = 'button, select, input[type="checkbox"], input[type="range"], a[href]';
  const onUiClick = (ev: Event) => {
    const el = ev.target as HTMLElement | null;
    if (el && typeof el.closest === 'function' && el.closest(clickTarget)) {
      audioEngine.play('SFX_UI_CLICK');
    }
  };
  document.addEventListener('click', onUiClick, true);

  // 首次任意手势也尝试 resume（覆盖非"开始游戏"入口，如回放页）
  const onFirstGesture = () => {
    void audioEngine.ensureRunning();
  };
  document.addEventListener('pointerdown', onFirstGesture);
  document.addEventListener('keydown', onFirstGesture);

  const onVisibility = () => {
    audioEngine.setVisibilitySuspended(document.hidden);
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    dispose: () => {
      unsubGame();
      unsubSettings();
      document.removeEventListener('click', onUiClick, true);
      document.removeEventListener('pointerdown', onFirstGesture);
      document.removeEventListener('keydown', onFirstGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      liveRegion.remove();
    },
  };
}

/** 反馈音效（教学反馈 T3/T4）。由 UI 层在确认动作结果时调用。 */
export function playFeedback(correct: boolean): void {
  if (testConfig.trainingMode) return;
  audioEngine.play(correct ? 'SFX_FEEDBACK_CORRECT' : 'SFX_FEEDBACK_INCORRECT');
}

/** 首次手势 resume：绑定"开始游戏"按钮等入口（§8-6 决策：开始游戏按钮 + 任意首次手势）。 */
export function resumeAudioOnGesture(): void {
  if (testConfig.trainingMode) return;
  void audioEngine.ensureRunning();
}
