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
 * 渲染问答助手面板（左侧边栏）
 */
const CHAT_PANEL_ID_CONST = 'llm-chat-assistant-panel';

export function renderLLMChatAssistant(
  gameState?: GameState,
  onClose?: () => void
): HTMLElement {
  const panel = document.createElement('div');
  panel.id = CHAT_PANEL_ID_CONST;
  panel.className = 'llm-chat-assistant';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 380px;
    height: 100vh;
    background: white;
    box-shadow: 2px 0 12px rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1001;
    font-family: system-ui, -apple-system, sans-serif;
    transition: transform 0.3s ease-in-out;
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
  closeBtn.textContent = '◀';
  closeBtn.title = '收起侧边栏';
  closeBtn.onclick = () => {
    panel.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      onClose?.();
    }, 300);
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

  // 快捷问题（根据游戏阶段显示不同问题）
  const quickQuestions = document.createElement('div');
  quickQuestions.style.cssText = `
    padding: 8px 16px;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    gap: 8px;
    overflow-x: auto;
  `;

  // 根据游戏阶段选择不同的快捷问题
  const phase = gameState?.phase;
  let questions: string[];
  
  if (phase === 'EXCHANGE') {
    questions = [
      '换三张应该换哪3张？',
      '分析我的手牌',
      '换牌后如何定缺？',
      '追清一色值得吗？',
    ];
  } else if (phase === 'DING_QUE') {
    questions = [
      '应该定哪一门？',
      '分析三种花色',
      '定缺后怎么打？',
      '能追清一色吗？',
    ];
  } else {
    questions = [
      '什么是向听？',
      '何时该碰牌？',
      '如何防守？',
      '分析当前局面',
    ];
  }

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
 * 简单的Markdown解析器
 */
function parseMarkdown(text: string): string {
  let html = text
    // 转义HTML特殊字符
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 粗体 **text** 或 __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体 *text* 或 _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // 行内代码 `code`
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-family:monospace;">$1</code>')
    // 链接 [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#1976d2;">$1</a>')
    // 换行
    .replace(/\n/g, '<br>');
  
  // 处理无序列表
  html = html.replace(/(?:^|<br>)[-•]\s+(.+?)(?=<br>|$)/g, '<li style="margin-left:20px;">$1</li>');
  
  // 处理有序列表
  html = html.replace(/(?:^|<br>)(\d+)\.\s+(.+?)(?=<br>|$)/g, '<li style="margin-left:20px;">$2</li>');
  
  return html;
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
    line-height: 1.6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;
  
  // 用户消息直接显示，助手消息解析Markdown
  if (isUser) {
    bubble.textContent = msg.content;
  } else {
    bubble.innerHTML = parseMarkdown(msg.content);
  }

  container.appendChild(bubble);
  return container;
}

/**
 * 发送消息
 */
async function sendMessage(
  content: string,
  gameState: GameState | undefined,
  _panel: HTMLElement
): Promise<void> {
  // 添加用户消息
  const userMsg: QAMessage = {
    role: 'user',
    content,
    timestamp: new Date(),
    context: gameState ? { gameState } : undefined,
  };
  chatHistory.push(userMsg);
  
  // 更新面板显示"思考中"
  isTyping = true;
  updateChatPanel(gameState);
  
  try {
    // 获取历史对话作为上下文
    const historyContext = chatHistory.slice(-6).map(m => 
      `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`
    );
    
    console.log('[LLM Chat] Sending question to LLM...');
    
    // 调用LLM
    const response = await llmService.answerQuestion(content, {
      gameState,
      history: historyContext,
    });
    
    console.log('[LLM Chat] Got response:', response.substring(0, 100) + '...');
    
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
  
  // 更新面板显示响应
  isTyping = false;
  console.log('[LLM Chat] Updating panel with response...');
  updateChatPanel(gameState);
}

/**
 * 更新聊天面板 - 通过ID查找面板
 */
function updateChatPanel(gameState?: GameState): void {
  const existingPanel = document.getElementById(CHAT_PANEL_ID_CONST);
  if (existingPanel && existingPanel.parentElement) {
    const parent = existingPanel.parentElement;
    const newPanel = renderLLMChatAssistant(gameState, () => {});
    parent.replaceChild(newPanel, existingPanel);
    console.log('[LLM Chat] Panel updated');
  } else {
    console.warn('[LLM Chat] Could not find panel to update');
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
    transition: transform 0.2s, box-shadow 0.2s, left 0.3s ease-in-out;
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
  let isOpen = false;
  
  btn.onclick = () => {
    if (!chatPanel || !document.body.contains(chatPanel)) {
      // 创建侧边栏面板
      chatPanel = renderLLMChatAssistant(gameState, () => {
        // 关闭回调
        isOpen = false;
        btn.style.left = '20px';
        // 移除body左边距
        document.body.style.paddingLeft = '0';
        document.body.style.transition = 'padding-left 0.3s ease-in-out';
        if (chatPanel) {
          chatPanel.remove();
          chatPanel = null;
        }
      });
      // 初始隐藏在左侧
      chatPanel.style.transform = 'translateX(-100%)';
      document.body.appendChild(chatPanel);
      // 延迟显示以触发动画
      setTimeout(() => {
        if (chatPanel) {
          chatPanel.style.transform = 'translateX(0)';
          isOpen = true;
          btn.style.left = '400px'; // 380px 侧边栏宽度 + 20px 间距
          // 添加body左边距以避免内容被遮挡
          document.body.style.paddingLeft = '380px';
          document.body.style.transition = 'padding-left 0.3s ease-in-out';
        }
      }, 10);
    } else {
      // 切换显示/隐藏
      if (isOpen) {
        chatPanel.style.transform = 'translateX(-100%)';
        isOpen = false;
        btn.style.left = '20px';
        // 移除body左边距
        document.body.style.paddingLeft = '0';
      } else {
        chatPanel.style.transform = 'translateX(0)';
        isOpen = true;
        btn.style.left = '400px';
        // 添加body左边距
        document.body.style.paddingLeft = '380px';
      }
    }
  };
  
  return btn;
}

/**
 * 获取或创建侧边栏面板（用于持久化）
 */
export function ensureChatPanel(gameState?: GameState): void {
  let existingPanel = document.getElementById(CHAT_PANEL_ID_CONST);
  if (!existingPanel) {
    const panel = renderLLMChatAssistant(gameState, () => {
      // 面板被关闭时的回调
      const btn = document.querySelector('.llm-chat-btn') as HTMLElement;
      if (btn) {
        btn.style.left = '20px';
      }
    });
    panel.style.transform = 'translateX(-100%)'; // 初始隐藏
    document.body.appendChild(panel);
  }
}
