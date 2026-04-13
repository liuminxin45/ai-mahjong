import { llmService } from '../../llm';
import type { QAMessage } from '../../llm/types';
import type { GameState } from '../../core/model/state';
import {
  createPixelButton,
  createPixelDrawerSurface,
  createPixelLoadingState,
  mountPixelSurface,
} from './pixelFrame';

let chatHistory: QAMessage[] = [];
let isTyping = false;

const CHAT_PANEL_ID_CONST = 'llm-chat-assistant-panel';
const CHAT_OVERLAY_ID_CONST = 'llm-chat-assistant-overlay';

export function renderLLMChatAssistant(
  gameState?: GameState,
  onClose?: () => void,
): HTMLElement {
  const surface = createPixelDrawerSurface({
    title: 'Mahjong Assistant',
    subtitle: 'ASK / REVIEW / SUGGEST',
    width: 'min(94vw, 380px)',
    onClose,
  });

  surface.overlay.id = CHAT_OVERLAY_ID_CONST;
  surface.panel.id = CHAT_PANEL_ID_CONST;

  const welcome = document.createElement('div');
  welcome.className = 'pixel-note-box';
  welcome.innerHTML = `
    <div class="pixel-page-section__title" style="font-size:11px;">HELP</div>
    <div class="pixel-note" style="margin-top:8px;">
      Ask about rules, defense, discard ideas, or the current board state.
    </div>
  `;
  surface.body.appendChild(welcome);

  const messagesArea = document.createElement('div');
  messagesArea.className = 'pixel-log pixel-log--short pixel-message-list';

  if (chatHistory.length === 0) {
    messagesArea.appendChild(createPixelLoadingState('READY', '输入问题或点下方快捷问句'));
  } else {
    for (const message of chatHistory) {
      messagesArea.appendChild(renderMessage(message));
    }
  }

  if (isTyping) {
    messagesArea.appendChild(createTypingMessage());
  }

  surface.body.appendChild(messagesArea);

  const quickRow = document.createElement('div');
  quickRow.className = 'pixel-quick-row';
  for (const question of getQuickQuestions(gameState?.phase)) {
    const quick = document.createElement('button');
    quick.type = 'button';
    quick.className = 'pixel-quick-btn';
    quick.textContent = question;
    quick.onclick = () => void sendMessage(question, gameState);
    quickRow.appendChild(quick);
  }
  surface.body.appendChild(quickRow);

  const inputRow = document.createElement('div');
  inputRow.className = 'pixel-chat-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pixel-input';
  input.placeholder = 'ASK...';
  input.onkeypress = (event) => {
    if (event.key === 'Enter' && input.value.trim()) {
      void sendMessage(input.value.trim(), gameState);
      input.value = '';
    }
  };

  const send = createPixelButton('Send', 'success');
  send.onclick = () => {
    if (!input.value.trim()) return;
    void sendMessage(input.value.trim(), gameState);
    input.value = '';
  };

  inputRow.appendChild(input);
  inputRow.appendChild(send);
  surface.footer.appendChild(inputRow);

  mountPixelSurface(surface);
  setTimeout(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }, 0);

  return surface.panel;
}

function getQuickQuestions(phase: string | undefined): string[] {
  if (phase === 'EXCHANGE') {
    return ['换三张应该换哪3张？', '分析我的手牌', '换牌后如何定缺？'];
  }
  if (phase === 'DING_QUE') {
    return ['应该定哪一门？', '分析三种花色', '定缺后怎么打？'];
  }
  return ['什么是向听？', '何时该碰牌？', '如何防守？', '分析当前局面'];
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
  const wrap = document.createElement('div');
  wrap.className = 'pixel-message pixel-message--assistant';

  const bubble = document.createElement('div');
  bubble.className = 'pixel-message__bubble';
  bubble.textContent = 'THINKING...';
  wrap.appendChild(bubble);
  return wrap;
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

async function sendMessage(content: string, gameState: GameState | undefined): Promise<void> {
  chatHistory.push({
    role: 'user',
    content,
    timestamp: new Date(),
    context: gameState ? { gameState } : undefined,
  });

  isTyping = true;
  updateChatPanel(gameState);

  try {
    const historyContext = chatHistory.slice(-6).map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content}`);
    const response = await llmService.answerQuestion(content, {
      gameState,
      history: historyContext,
    });

    chatHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[LLM Chat] Error:', error);
    chatHistory.push({
      role: 'assistant',
      content: '抱歉，我暂时无法回答这个问题。请稍后再试。',
      timestamp: new Date(),
    });
  }

  isTyping = false;
  updateChatPanel(gameState);
}

function updateChatPanel(gameState?: GameState): void {
  const existingPanel = document.getElementById(CHAT_PANEL_ID_CONST);
  const existingOverlay = document.getElementById(CHAT_OVERLAY_ID_CONST);
  if (!existingPanel || !existingOverlay) return;
  existingOverlay.remove();
  existingPanel.remove();
  renderLLMChatAssistant(gameState, () => {
    const btn = document.querySelector('.pixel-chat-launcher') as HTMLElement | null;
    if (btn) btn.dataset.open = 'false';
  });
}

export function clearChatHistory(): void {
  chatHistory = [];
}

export function renderChatAssistantButton(gameState?: GameState): HTMLElement {
  const btn = createPixelButton('CHAT', 'accent');
  btn.classList.add('pixel-chat-launcher');
  btn.dataset.open = 'false';
  btn.onclick = () => {
    const existingPanel = document.getElementById(CHAT_PANEL_ID_CONST);
    const existingOverlay = document.getElementById(CHAT_OVERLAY_ID_CONST);
    if (existingPanel && existingOverlay) {
      existingOverlay.remove();
      existingPanel.remove();
      btn.dataset.open = 'false';
      return;
    }

    renderLLMChatAssistant(gameState, () => {
      btn.dataset.open = 'false';
    });
    btn.dataset.open = 'true';
  };
  return btn;
}

export function ensureChatPanel(gameState?: GameState): void {
  if (!document.getElementById(CHAT_PANEL_ID_CONST)) {
    renderLLMChatAssistant(gameState, () => {
      const btn = document.querySelector('.pixel-chat-launcher') as HTMLElement | null;
      if (btn) btn.dataset.open = 'false';
    });
  }
}
