import { llmService } from '../../llm';
import type { GuidanceLevel, QAMessage } from '../../llm/types';
import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import { languageStore } from '../../store/languageStore';
import { getAiText } from '../aiLocale';
import {
  createSpeechToTextController,
  isSpeechToTextSupported,
  type SpeechRecognitionState,
  type SpeechToTextController,
} from '../speechToText';
import {
  createPixelButton,
  createPixelDrawerSurface,
  createPixelLoadingState,
  createPixelToast,
  mountPixelSurface,
} from './pixelFrame';

export type CoachPanelContext = {
  gameState?: GameState;
  legalActions?: Action[];
};

let chatHistory: QAMessage[] = [];
let isTyping = false;
type CoachAdviceView = {
  headline: string;
  body: string;
  badge: string;
  badgeTone: 'good' | 'warn' | 'bad' | 'neutral';
  confidence?: number | null;
  hints: string[];
  alternatives: Array<{ label: string; detail: string }>;
};

let currentAdvice: CoachAdviceView | null = null;
let isAdviceLoading = false;
let guidanceLevel: GuidanceLevel = 'learning';
let draftMessage = '';
let latestContext: CoachPanelContext = {};
let adviceRequestId = 0;
let panelCloseHandler: (() => void) | undefined;
let speechController: SpeechToTextController | null = null;
let speechState: SpeechRecognitionState = isSpeechToTextSupported() ? 'idle' : 'unsupported';
let speechError: string | null = null;

const CHAT_PANEL_ID_CONST = 'llm-chat-assistant-panel';
const CHAT_OVERLAY_ID_CONST = 'llm-chat-assistant-overlay';

export function renderLLMChatAssistant(
  context: CoachPanelContext = latestContext,
  onClose?: () => void,
): HTMLElement {
  latestContext = context;
  panelCloseHandler = onClose;
  return mountCoachPanel('bottom');
}

export function syncCoachPanelContext(context: CoachPanelContext): void {
  const nextKey = getCoachContextKey(context);
  const previousKey = getCoachContextKey(latestContext);
  latestContext = context;

  if (nextKey !== previousKey) {
    currentAdvice = null;
    isAdviceLoading = false;
    adviceRequestId += 1;
  }

  if (document.getElementById(CHAT_PANEL_ID_CONST)) {
    mountCoachPanel('preserve');
  }
}

export function clearChatHistory(): void {
  chatHistory = [];
}

export function renderChatAssistantButton(context: CoachPanelContext = {}): HTMLElement {
  latestContext = context;
  const btn = createPixelButton('AI', 'accent');
  btn.classList.add('pixel-chat-launcher');
  btn.dataset.open = 'false';
  btn.onclick = () => {
    if (document.getElementById(CHAT_PANEL_ID_CONST)) {
      removeChatAssistantSurface();
      return;
    }

    renderLLMChatAssistant(latestContext, () => {
      setLauncherOpen(false);
    });
    setLauncherOpen(true);
  };
  return btn;
}

export function ensureChatPanel(context: CoachPanelContext = {}): void {
  latestContext = context;
  if (!document.getElementById(CHAT_PANEL_ID_CONST)) {
    renderLLMChatAssistant(latestContext, () => {
      setLauncherOpen(false);
    });
    setLauncherOpen(true);
  }
}

export function removeChatAssistantSurface(): void {
  removeMountedSurface();
  destroySpeechController();
  setLauncherOpen(false);
}

function mountCoachPanel(scrollMode: 'bottom' | 'preserve'): HTMLElement {
  const previousScrollTop = getCurrentMessageScrollTop();
  const text = getAiText().coach;
  removeMountedSurface();

  const surface = createPixelDrawerSurface({
    title: text.title,
    subtitle: text.subtitle,
    width: 'min(94vw, 420px)',
    onClose: () => {
      destroySpeechController();
      panelCloseHandler?.();
      setLauncherOpen(false);
    },
  });

  surface.overlay.id = CHAT_OVERLAY_ID_CONST;
  surface.panel.id = CHAT_PANEL_ID_CONST;

  const speechSupported = configureSpeechController();
  const llmReady = hasConfiguredLlm();
  const state = latestContext.gameState;
  const legalActions = latestContext.legalActions ?? [];

  surface.body.appendChild(renderAdviceSection(state, legalActions, llmReady));
  surface.body.appendChild(renderChatSection(state, llmReady));

  const errorSlot = document.createElement('div');
  errorSlot.className = 'pixel-coach-error-slot';
  surface.body.appendChild(errorSlot);

  surface.footer.appendChild(renderInputRow(llmReady, speechSupported));
  mountPixelSurface(surface);
  syncSpeechUi();
  syncInputControls();
  restoreMessageScroll(scrollMode, previousScrollTop);
  return surface.panel;
}

function renderAdviceSection(
  state: GameState | undefined,
  legalActions: Action[],
  llmReady: boolean,
): HTMLElement {
  const text = getAiText().coach;
  const section = createSection(text.adviceTitle, text.adviceSubtitle);
  const body = section.querySelector('.pixel-page-section__body') as HTMLElement;

  const controls = document.createElement('div');
  controls.className = 'pixel-coach-control-row';

  const levelField = document.createElement('div');
  levelField.className = 'pixel-field';
  const levelLabel = document.createElement('div');
  levelLabel.className = 'pixel-field__label';
  levelLabel.textContent = text.guidance;
  const select = document.createElement('select');
  select.className = 'pixel-select';
  for (const level of ['beginner', 'learning', 'practicing', 'advanced'] as GuidanceLevel[]) {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = text.levelNames[level];
    option.selected = level === guidanceLevel;
    select.appendChild(option);
  }
  select.onchange = () => {
    guidanceLevel = select.value as GuidanceLevel;
    currentAdvice = null;
    mountCoachPanel('preserve');
  };
  levelField.appendChild(levelLabel);
  levelField.appendChild(select);
  controls.appendChild(levelField);

  body.appendChild(controls);

  const statusRow = document.createElement('div');
  statusRow.className = 'pixel-coach-chip-row';
  const speechChip = createChip(getSpeechStatusLabel(), speechState === 'error' ? 'bad' : speechState === 'listening' ? 'good' : 'neutral');
  speechChip.classList.add('pixel-coach-speech-status-chip');
  statusRow.appendChild(speechChip);
  if (!llmReady) {
    statusRow.appendChild(createChip(text.llmKeyRequired, 'warn'));
  }
  body.appendChild(statusRow);

  if (!llmReady) {
    const note = document.createElement('div');
    note.className = 'pixel-note-box pixel-note-box--danger';
    note.innerHTML = `
      <div class="pixel-page-section__title" style="font-size:11px;">${text.configTitle}</div>
      <div class="pixel-note" style="margin-top:8px;">${text.configHint}</div>
    `;
    body.appendChild(note);
    body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
    return section;
  }

  if (!state) {
    body.appendChild(createPixelLoadingState(text.adviceTitle, text.waitingAdvice));
    body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
    return section;
  }

  if (!canRequestAdvice(state, legalActions)) {
    const note = document.createElement('div');
    note.className = 'pixel-note-box';
    note.innerHTML = `
      <div class="pixel-page-section__title" style="font-size:11px;">${text.adviceUnavailableTitle}</div>
      <div class="pixel-note" style="margin-top:8px;">${text.adviceUnavailableHint}</div>
    `;
    body.appendChild(note);
    body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
    return section;
  }

  if (isAdviceLoading) {
    body.appendChild(createPixelLoadingState(text.adviceTitle, text.analyzing));
    body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
    return section;
  }

  if (!currentAdvice) {
    const note = document.createElement('div');
    note.className = 'pixel-note-box pixel-note-box--accent';
    note.innerHTML = `
      <div class="pixel-page-section__title" style="font-size:11px;">${text.adviceReadyTitle}</div>
      <div class="pixel-note" style="margin-top:8px;">${text.adviceReadyHint}</div>
    `;
    body.appendChild(note);
    body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
    return section;
  }

  body.appendChild(renderAdviceCard(currentAdvice));
  body.appendChild(renderAdviceActionRow(llmReady, state, legalActions));
  return section;
}

function renderAdviceActionRow(
  llmReady: boolean,
  state: GameState | undefined,
  legalActions: Action[],
): HTMLElement {
  const text = getAiText().coach;
  const row = document.createElement('div');
  row.className = 'pixel-coach-action-row';

  const refresh = createPixelButton(isAdviceLoading ? text.analyzing : text.getAdvice, 'success');
  refresh.disabled = isAdviceLoading || !llmReady || !state || !canRequestAdvice(state, legalActions);
  refresh.onclick = () => void requestAdvice();
  row.appendChild(refresh);
  return row;
}

function renderAdviceCard(advice: CoachAdviceView): HTMLElement {
  const text = getAiText().coach;
  const card = document.createElement('div');
  card.className = 'pixel-note-box pixel-note-box--success pixel-coach-advice-card';

  card.innerHTML = `
    <div class="pixel-list-item__row">
      <div class="pixel-page-section__title" style="font-size:11px;">${text.recommended}</div>
      <span class="pixel-chip ${advice.badgeTone === 'neutral' ? '' : `pixel-chip--${advice.badgeTone}`}">${advice.badge}</span>
    </div>
    <div class="pixel-coach-action">${advice.headline}</div>
    ${advice.confidence !== null && advice.confidence !== undefined ? `<div class="pixel-note" style="margin-top:8px;">${text.confidence} ${(advice.confidence * 100).toFixed(0)}%</div>` : ''}
    <div class="pixel-note" style="margin-top:8px;">${advice.body}</div>
  `;

  if (advice.hints.length > 0) {
    const hints = document.createElement('div');
    hints.className = 'pixel-note';
    hints.style.marginTop = '8px';
    hints.textContent = advice.hints.join(' / ');
    card.appendChild(hints);
  }

  if (advice.alternatives.length > 0) {
    const alt = document.createElement('div');
    alt.className = 'pixel-coach-alt-list';
    alt.innerHTML = advice.alternatives.slice(0, 3).map((item) => `
      <div class="pixel-kv__row">
        <span class="pixel-kv__label">${item.label}</span>
        <span class="pixel-kv__value">${item.detail}</span>
      </div>
    `).join('');
    card.appendChild(alt);
  }

  return card;
}

function renderChatSection(state: GameState | undefined, llmReady: boolean): HTMLElement {
  const text = getAiText().coach;
  const section = createSection(text.askTitle, text.askSubtitle);
  const body = section.querySelector('.pixel-page-section__body') as HTMLElement;

  const messagesArea = document.createElement('div');
  messagesArea.className = 'pixel-log pixel-log--short pixel-message-list pixel-coach-log';

  if (chatHistory.length === 0) {
    messagesArea.appendChild(createPixelLoadingState(text.readyCode, text.readyHint));
  } else {
    for (const message of chatHistory) {
      messagesArea.appendChild(renderMessage(message));
    }
  }

  if (isTyping) {
    messagesArea.appendChild(createTypingMessage());
  }

  body.appendChild(messagesArea);

  const quickRow = document.createElement('div');
  quickRow.className = 'pixel-quick-row';
  for (const question of getQuickQuestions(state?.phase)) {
    const quick = document.createElement('button');
    quick.type = 'button';
    quick.className = 'pixel-quick-btn';
    quick.textContent = question;
    quick.onclick = () => {
      if (!llmReady) {
        promptLlmSettings();
        return;
      }
      void sendMessage(question);
    };
    quickRow.appendChild(quick);
  }
  body.appendChild(quickRow);

  return section;
}

function renderInputRow(llmReady: boolean, speechSupported: boolean): HTMLElement {
  const text = getAiText().coach;
  const row = document.createElement('div');
  row.className = speechSupported ? 'pixel-coach-input-row pixel-coach-input-row--voice' : 'pixel-coach-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pixel-input pixel-coach-input';
  input.placeholder = llmReady ? text.inputPlaceholderReady : text.inputPlaceholderSetup;
  input.value = draftMessage;

  const send = createPixelButton(isTyping ? text.sending : text.send, 'success');
  send.classList.add('pixel-coach-send');
  send.onclick = () => void sendCurrentDraft();

  input.oninput = () => {
    draftMessage = input.value;
    syncInputControls();
  };
  input.onkeypress = (event) => {
    if (event.key === 'Enter' && draftMessage.trim()) {
      void sendCurrentDraft();
    }
  };
  row.appendChild(input);

  if (speechSupported) {
    const mic = createPixelButton(getSpeechButtonLabel(), speechState === 'listening' ? 'danger' : 'neutral');
    mic.classList.add('pixel-coach-mic');
    mic.dataset.state = speechState;
    mic.onclick = () => {
      if (!llmReady) {
        promptLlmSettings();
        return;
      }
      toggleSpeechInput();
    };
    row.appendChild(mic);
  }

  row.appendChild(send);
  return row;
}

async function requestAdvice(): Promise<void> {
  const text = getAiText().coach;
  const state = latestContext.gameState;
  const legalActions = latestContext.legalActions ?? [];

  if (!hasConfiguredLlm()) {
    promptLlmSettings();
    return;
  }
  if (!state || !canRequestAdvice(state, legalActions)) {
    createPixelToast(text.adviceUnavailableToast);
    return;
  }

  currentAdvice = null;
  isAdviceLoading = true;
  speechError = null;
  const requestId = ++adviceRequestId;
  const requestKey = getCoachContextKey(latestContext);
  mountCoachPanel('preserve');

  try {
    const advice = await buildAdviceForCurrentPhase(state, legalActions);
    if (requestId !== adviceRequestId) return;
    if (requestKey !== getCoachContextKey(latestContext)) return;
    currentAdvice = advice;
  } catch (error) {
    console.error('[Coach] Failed to get advice:', error);
    createPixelToast(text.adviceErrorToast);
  } finally {
    if (requestId === adviceRequestId && document.getElementById(CHAT_PANEL_ID_CONST)) {
      isAdviceLoading = false;
      mountCoachPanel('preserve');
    }
  }
}

async function sendCurrentDraft(): Promise<void> {
  const content = draftMessage.trim();
  if (!content) return;
  if (!hasConfiguredLlm()) {
    promptLlmSettings();
    return;
  }
  draftMessage = '';
  await sendMessage(content);
}

async function sendMessage(content: string): Promise<void> {
  if (!hasConfiguredLlm()) {
    promptLlmSettings();
    return;
  }

  chatHistory.push({
    role: 'user',
    content,
    timestamp: new Date(),
    context: latestContext.gameState ? { gameState: latestContext.gameState } : undefined,
  });

  isTyping = true;
  mountCoachPanel('bottom');

  try {
    const historyContext = chatHistory.slice(-6).map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`);
    const response = await llmService.answerQuestion(content, {
      gameState: latestContext.gameState,
      history: historyContext,
    });

    chatHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Coach] Chat error:', error);
    chatHistory.push({
      role: 'assistant',
      content: languageStore.getLanguage() === 'zh'
        ? '抱歉，我暂时无法回答这个问题。请稍后再试。'
        : 'Sorry, I cannot answer that right now. Please try again later.',
      timestamp: new Date(),
    });
  }

  isTyping = false;
  if (document.getElementById(CHAT_PANEL_ID_CONST)) {
    mountCoachPanel('bottom');
  }
}

function renderMessage(msg: QAMessage): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = msg.role === 'user' ? 'pixel-message pixel-message--user' : 'pixel-message pixel-message--assistant';

  const bubble = document.createElement('div');
  bubble.className = 'pixel-message__bubble pixel-markdown';
  if (msg.role === 'user') bubble.textContent = msg.content;
  else bubble.innerHTML = parseMarkdown(msg.content);

  wrap.appendChild(bubble);
  return wrap;
}

function createTypingMessage(): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = 'pixel-message pixel-message--assistant';

  const inner = document.createElement('div');
  inner.className = 'pixel-message__bubble';
  inner.textContent = languageStore.getLanguage() === 'zh' ? '思考中...' : 'Thinking...';
  bubble.appendChild(inner);
  return bubble;
}

function configureSpeechController(): boolean {
  if (!isSpeechToTextSupported()) {
    speechState = 'unsupported';
    return false;
  }

  const desiredLang = languageStore.getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
  if (!speechController) {
    speechController = createSpeechToTextController({
      lang: desiredLang,
      onResult: (text) => {
        speechError = null;
        draftMessage = appendRecognizedText(draftMessage, text);
        syncInputControls();
        syncSpeechUi();
      },
      onError: (message) => {
        speechError = message;
        createPixelToast(getAiText().coach.voiceErrorToast);
        syncSpeechUi();
      },
      onStateChange: (state) => {
        speechState = state;
        syncSpeechUi();
      },
    });
  }

  speechController.setLang(desiredLang);
  speechState = speechController.getState();
  return speechController.isSupported;
}

function toggleSpeechInput(): void {
  if (!speechController) {
    configureSpeechController();
  }
  if (!speechController || !speechController.isSupported) return;

  speechError = null;
  if (speechState === 'listening') {
    speechController.stop();
    return;
  }

  speechController.start();
}

function destroySpeechController(): void {
  speechController?.destroy();
  speechController = null;
  speechError = null;
  speechState = isSpeechToTextSupported() ? 'idle' : 'unsupported';
}

function promptLlmSettings(): void {
  createPixelToast(getAiText().coach.openSettingsToast);
}

function hasConfiguredLlm(): boolean {
  return Boolean(llmService.getConfig().apiKey?.trim());
}

function canRequestAdvice(state: GameState | undefined, legalActions: Action[]): boolean {
  return Boolean(state && state.phase !== 'END');
}

function createSection(title: string, subtitle?: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pixel-page-section';
  section.innerHTML = `
    <div class="pixel-page-section__header">
      <div class="pixel-page-section__title">${title}</div>
      ${subtitle ? `<div class="pixel-page-section__subtitle">${subtitle}</div>` : ''}
    </div>
  `;
  const body = document.createElement('div');
  body.className = 'pixel-page-section__body';
  section.appendChild(body);
  return section;
}

function createChip(label: string, tone: 'neutral' | 'good' | 'warn' | 'bad'): HTMLElement {
  const chip = document.createElement('span');
  chip.className = tone === 'neutral' ? 'pixel-chip' : `pixel-chip pixel-chip--${tone}`;
  chip.textContent = label;
  return chip;
}

function parseMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n/g, '<br>');

  html = html.replace(/(?:^|<br>)[-•]\s+(.+?)(?=<br>|$)/g, '<li>$1</li>');
  html = html.replace(/(?:^|<br>)(\d+)\.\s+(.+?)(?=<br>|$)/g, '<li>$2</li>');
  return html;
}

function getQuickQuestions(phase: string | undefined): string[] {
  const text = getAiText().coach.quickQuestions;
  if (phase === 'EXCHANGE') return text.exchange;
  if (phase === 'DING_QUE') return text.dingQue;
  return text.playing;
}

function formatPhase(phase: string | undefined): string {
  const text = getAiText().coach;
  if (!phase) return text.notAvailable;
  return text.phaseNames[phase] || phase;
}

function formatRecommendedAction(action: Action | string): string {
  const text = getAiText().coach;
  if (typeof action === 'string') return action;

  const tileAction = action as Action & { tile?: { suit: 'W' | 'B' | 'T'; rank: number } };
  if (action.type === 'DISCARD' && tileAction.tile) {
    return `${text.actionNames.DISCARD} ${formatTile(tileAction.tile.suit, tileAction.tile.rank)}`;
  }
  if (tileAction.tile) {
    return `${text.actionNames[action.type] || action.type} ${formatTile(tileAction.tile.suit, tileAction.tile.rank)}`;
  }
  return text.actionNames[action.type] || action.type;
}

function formatTile(suit: 'W' | 'B' | 'T', rank: number): string {
  if (languageStore.getLanguage() === 'zh') {
    const suitName = suit === 'W' ? '万' : suit === 'B' ? '条' : '筒';
    return `${rank}${suitName}`;
  }
  const suitName = suit === 'W' ? 'Character' : suit === 'B' ? 'Bamboo' : 'Dot';
  return `${rank} ${suitName}`;
}

function formatRiskLabel(risk: 'low' | 'medium' | 'high'): string {
  if (languageStore.getLanguage() !== 'zh') return risk;
  if (risk === 'low') return '低风险';
  if (risk === 'medium') return '中风险';
  return '高风险';
}

async function buildAdviceForCurrentPhase(state: GameState, legalActions: Action[]): Promise<CoachAdviceView> {
  if (state.phase === 'EXCHANGE') {
    const exchange = await llmService.getExchangeAdvice(state.hands.P0 as Array<{ suit: string; rank: number }>, guidanceLevel);
    return {
      headline: exchange.recommendedTiles.length > 0
        ? exchange.recommendedTiles.join(' / ')
        : languageStore.getLanguage() === 'zh' ? '优先换出孤张和碎张' : 'Discard isolated tiles first',
      body: exchange.reasoning,
      badge: exchange.selectedSuit,
      badgeTone: 'warn',
      confidence: null,
      hints: [exchange.afterExchangePlan],
      alternatives: [],
    };
  }

  if (state.phase === 'DING_QUE') {
    const dingQue = await llmService.getDingQueAdvice(state.hands.P0 as Array<{ suit: string; rank: number }>, guidanceLevel);
    return {
      headline: dingQue.recommendedSuit,
      body: dingQue.reasoning,
      badge: `${Math.round(dingQue.confidence * 100)}%`,
      badgeTone: 'good',
      confidence: dingQue.confidence,
      hints: [dingQue.playPlan],
      alternatives: dingQue.suitRanking.slice(0, 3).map((item) => ({
        label: item.suit,
        detail: item.reason,
      })),
    };
  }

  const advice = await llmService.getCoachingAdvice(state, 'P0', legalActions, guidanceLevel);
  const riskTone = advice.riskAssessment.dealInRisk === 'high'
    ? 'bad'
    : advice.riskAssessment.dealInRisk === 'medium'
      ? 'warn'
      : 'good';
  return {
    headline: formatRecommendedAction(advice.recommendedAction),
    body: advice.reasoning,
    badge: formatRiskLabel(advice.riskAssessment.dealInRisk),
    badgeTone: riskTone,
    confidence: advice.confidence,
    hints: advice.strategicHints,
    alternatives: advice.alternatives.slice(0, 3).map((item) => ({
      label: formatRecommendedAction(item.action as Action | string),
      detail: item.pros[0] || item.cons[0] || getAiText().coach.recommended,
    })),
  };
}

function getSpeechStatusLabel(): string {
  const text = getAiText().coach;
  switch (speechState) {
    case 'listening':
      return text.voiceListening;
    case 'processing':
      return text.voiceProcessing;
    case 'error':
      return text.voiceError;
    case 'unsupported':
      return text.voiceOff;
    default:
      return text.voiceReady;
  }
}

function getSpeechButtonLabel(): string {
  const text = getAiText().coach;
  switch (speechState) {
    case 'listening':
      return text.recording;
    case 'processing':
      return text.processing;
    case 'error':
      return text.errorShort;
    default:
      return text.mic;
  }
}

function appendRecognizedText(existing: string, recognized: string): string {
  const left = existing.trim();
  const right = recognized.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

function getCoachContextKey(context: CoachPanelContext): string {
  const state = context.gameState;
  if (!state) return 'none';
  return [
    state.phase,
    state.turn,
    state.currentPlayer,
    state.wall.length,
    state.hands.P0.length,
    state.discards.P0.length,
    state.discards.P1.length,
    state.discards.P2.length,
    state.discards.P3.length,
    context.legalActions?.length ?? 0,
  ].join('|');
}

function getCurrentMessageScrollTop(): number | null {
  const area = document.querySelector('.pixel-coach-log') as HTMLElement | null;
  return area ? area.scrollTop : null;
}

function restoreMessageScroll(scrollMode: 'bottom' | 'preserve', previousScrollTop: number | null): void {
  const area = document.querySelector('.pixel-coach-log') as HTMLElement | null;
  if (!area) return;
  setTimeout(() => {
    if (!area.isConnected) return;
    if (scrollMode === 'bottom') {
      area.scrollTop = area.scrollHeight;
      return;
    }
    if (previousScrollTop !== null) {
      area.scrollTop = previousScrollTop;
    }
  }, 0);
}

function syncSpeechUi(): void {
  const chip = document.querySelector('.pixel-coach-speech-status-chip') as HTMLElement | null;
  if (chip) {
    chip.textContent = getSpeechStatusLabel();
    chip.className = speechState === 'error'
      ? 'pixel-chip pixel-chip--bad pixel-coach-speech-status-chip'
      : speechState === 'listening'
        ? 'pixel-chip pixel-chip--good pixel-coach-speech-status-chip'
        : 'pixel-chip pixel-coach-speech-status-chip';
  }

  const slot = document.querySelector('.pixel-coach-error-slot') as HTMLElement | null;
  if (slot) {
    slot.innerHTML = '';
    if (speechError) {
      const text = getAiText().coach;
      const errorBox = document.createElement('div');
      errorBox.className = 'pixel-note-box pixel-note-box--danger';
      errorBox.innerHTML = `
        <div class="pixel-page-section__title" style="font-size:11px;">${text.voiceTitle}</div>
        <div class="pixel-note" style="margin-top:8px;">${speechError}</div>
      `;
      slot.appendChild(errorBox);
    }
  }

  const mic = document.querySelector('.pixel-coach-mic') as HTMLButtonElement | null;
  if (mic) {
    mic.textContent = getSpeechButtonLabel();
    mic.dataset.state = speechState;
    mic.disabled = !hasConfiguredLlm() || speechState === 'processing';
  }
}

function syncInputControls(): void {
  const input = document.querySelector('.pixel-coach-input') as HTMLInputElement | null;
  if (input && input.value !== draftMessage) {
    input.value = draftMessage;
  }

  const send = document.querySelector('.pixel-coach-send') as HTMLButtonElement | null;
  if (send) {
    const text = getAiText().coach;
    send.textContent = isTyping ? text.sending : text.send;
    send.disabled = isTyping || !draftMessage.trim() || !hasConfiguredLlm();
  }

  syncSpeechUi();
}

function removeMountedSurface(): void {
  document.getElementById(CHAT_OVERLAY_ID_CONST)?.remove();
  document.getElementById(CHAT_PANEL_ID_CONST)?.remove();
}

function setLauncherOpen(open: boolean): void {
  const btn = document.querySelector('.pixel-chat-launcher') as HTMLElement | null;
  if (btn) btn.dataset.open = open ? 'true' : 'false';
}
