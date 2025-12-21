/**
 * LLM问答助手组件
 * 允许用户随时提问麻将相关问题
 */

import { llmService } from '../../llm';
import type { QAMessage } from '../../llm/types';
import type { GameState } from '../../core/model/state';

// 对话历史
let chatHistory: QAMessage[] = [];
let isTyping = false;

/**
 * 渲染问答助手面板
 */
export function renderLLMChatAssistant(
  gameState?: GameState,
  onClose?: () => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'llm-chat-assistant';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 380px;
    height: 500px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1001;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // 头部
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
  `;

  const titleArea = document.createElement('div');
  titleArea.innerHTML = `
    <div style="font-size: 16px; font-weight: 600;">💬 麻将助手</div>
    <div style="font-size: 11px; opacity: 0.9;">随时提问，即时解答</div>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => {
    panel.remove();
    onClose?.();
  };

  header.appendChild(titleArea);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // 消息区域
  const messagesArea = document.createElement('div');
  messagesArea.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f5f5f5;
  `;

  // 欢迎消息
  if (chatHistory.length === 0) {
    const welcome = document.createElement('div');
    welcome.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;
    welcome.innerHTML = `
      <div style="font-size: 14px; margin-bottom: 12px;">
        👋 你好！我是你的麻将助手，可以帮你：
      </div>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666; line-height: 1.8;">
        <li>解答麻将规则问题</li>
        <li>分析当前牌局策略</li>
        <li>解释专业术语</li>
        <li>给出出牌建议</li>
      </ul>
      <div style="margin-top: 12px; font-size: 12px; color: #999;">
        试试问我："什么时候应该碰牌？"
      </div>
    `;
    messagesArea.appendChild(welcome);
  }

  // 渲染历史消息
  for (const msg of chatHistory) {
    messagesArea.appendChild(renderMessage(msg));
  }

  // 正在输入指示器
  if (isTyping) {
    const typing = document.createElement('div');
    typing.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      color: #666;
      font-size: 13px;
    `;
    typing.innerHTML = `
      <div style="display: flex; gap: 4px;">
        <span style="animation: bounce 1s infinite;">•</span>
        <span style="animation: bounce 1s infinite 0.2s;">•</span>
        <span style="animation: bounce 1s infinite 0.4s;">•</span>
      </div>
      <span>正在思考...</span>
    `;
    messagesArea.appendChild(typing);
  }

  panel.appendChild(messagesArea);

  // 快捷问题
  const quickQuestions = document.createElement('div');
  quickQuestions.style.cssText = `
    padding: 8px 16px;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    gap: 8px;
    overflow-x: auto;
  `;

  const questions = [
    '什么是向听？',
    '何时该碰牌？',
    '如何防守？',
    '分析当前局面',
  ];

  for (const q of questions) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 6px 12px;
      background: #f0f0f0;
      border: none;
      border-radius: 16px;
      font-size: 12px;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.2s;
    `;
    btn.textContent = q;
    btn.onmouseover = () => btn.style.background = '#e0e0e0';
    btn.onmouseout = () => btn.style.background = '#f0f0f0';
    btn.onclick = () => sendMessage(q, gameState, panel);
    quickQuestions.appendChild(btn);
  }

  panel.appendChild(quickQuestions);

  // 输入区域
  const inputArea = document.createElement('div');
  inputArea.style.cssText = `
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #eee;
  `;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '输入你的问题...';
  input.style.cssText = `
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #ddd;
    border-radius: 24px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  `;
  input.onfocus = () => input.style.borderColor = '#11998e';
  input.onblur = () => input.style.borderColor = '#ddd';
  input.onkeypress = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      sendMessage(input.value.trim(), gameState, panel);
      input.value = '';
    }
  };

  const sendBtn = document.createElement('button');
  sendBtn.style.cssText = `
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  `;
  sendBtn.textContent = '➤';
  sendBtn.onmouseover = () => sendBtn.style.transform = 'scale(1.1)';
  sendBtn.onmouseout = () => sendBtn.style.transform = 'scale(1)';
  sendBtn.onclick = () => {
    if (input.value.trim()) {
      sendMessage(input.value.trim(), gameState, panel);
      input.value = '';
    }
  };

  inputArea.appendChild(input);
  inputArea.appendChild(sendBtn);
  panel.appendChild(inputArea);

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }
  `;
  panel.appendChild(style);

  // 滚动到底部
  setTimeout(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }, 0);

  return panel;
}

/**
 * 渲染单条消息
 */
function renderMessage(msg: QAMessage): HTMLElement {
  const isUser = msg.role === 'user';
  
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    justify-content: ${isUser ? 'flex-end' : 'flex-start'};
    margin-bottom: 12px;
  `;

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    max-width: 80%;
    padding: 12px 16px;
    border-radius: ${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
    background: ${isUser ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' : 'white'};
    color: ${isUser ? 'white' : '#333'};
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    white-space: pre-wrap;
  `;
  bubble.textContent = msg.content;

  container.appendChild(bubble);
  return container;
}

/**
 * 发送消息
 */
async function sendMessage(
  content: string,
  gameState: GameState | undefined,
  panel: HTMLElement
): Promise<void> {
  // 添加用户消息
  const userMsg: QAMessage = {
    role: 'user',
    content,
    timestamp: new Date(),
    context: gameState ? { gameState } : undefined,
  };
  chatHistory.push(userMsg);
  
  // 更新面板
  isTyping = true;
  updateChatPanel(panel, gameState);
  
  try {
    // 获取历史对话作为上下文
    const historyContext = chatHistory.slice(-6).map(m => 
      `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`
    );
    
    // 调用LLM
    const response = await llmService.answerQuestion(content, {
      gameState,
      history: historyContext,
    });
    
    // 添加助手消息
    const assistantMsg: QAMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    chatHistory.push(assistantMsg);
  } catch (e) {
    console.error('[LLM Chat] Error:', e);
    chatHistory.push({
      role: 'assistant',
      content: '抱歉，我暂时无法回答这个问题。请稍后再试。',
      timestamp: new Date(),
    });
  }
  
  isTyping = false;
  updateChatPanel(panel, gameState);
}

/**
 * 更新聊天面板
 */
function updateChatPanel(panel: HTMLElement, gameState?: GameState): void {
  const parent = panel.parentElement;
  if (parent) {
    const newPanel = renderLLMChatAssistant(gameState, () => {});
    parent.replaceChild(newPanel, panel);
  }
}

/**
 * 清除聊天历史
 */
export function clearChatHistory(): void {
  chatHistory = [];
}

/**
 * 渲染聊天助手按钮（悬浮按钮）
 */
export function renderChatAssistantButton(
  gameState?: GameState
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'llm-chat-btn';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
    z-index: 1000;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  btn.textContent = '💬';
  
  btn.onmouseover = () => {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 6px 16px rgba(17, 153, 142, 0.5)';
  };
  btn.onmouseout = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 12px rgba(17, 153, 142, 0.4)';
  };
  
  let chatPanel: HTMLElement | null = null;
  
  btn.onclick = () => {
    if (chatPanel && document.body.contains(chatPanel)) {
      chatPanel.remove();
      chatPanel = null;
    } else {
      chatPanel = renderLLMChatAssistant(gameState, () => {
        chatPanel = null;
      });
      document.body.appendChild(chatPanel);
    }
  };
  
  return btn;
}
