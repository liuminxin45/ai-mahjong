import type { UiCtx } from '../context';
import { createBrowserLLMAnalyzerFromStorage } from '../../analysis/LLMAnalyzer';
import { languageStore } from '../../store/languageStore';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type QuickPrompt = {
  id: string;
  text: string;
};

function getText() {
  const lang = languageStore.getLanguage();
  const isZh = lang === 'zh';
  return {
    badge: isZh ? 'AI' : 'AI',
    title: isZh ? 'AI 问答' : 'AI Q&A',
    placeholder: isZh ? '输入你的问题…' : 'Ask a question…',
    send: isZh ? '发送' : 'Send',
    clear: isZh ? '清空' : 'Clear',
    close: isZh ? '关闭' : 'Close',
    notConfiguredTitle: isZh ? '未配置 LLM' : 'LLM not configured',
    endpoint: isZh ? 'Endpoint' : 'Endpoint',
    apiKey: isZh ? 'API Key' : 'API Key',
    model: isZh ? 'Model' : 'Model',
    deepseekPreset: isZh ? '一键 DeepSeek' : 'DeepSeek Preset',
    save: isZh ? '保存并启用' : 'Save & Enable',
    saving: isZh ? '保存中…' : 'Saving…',
    errorNotConfigured: isZh ? 'AI 不可用：请先配置 LLM。' : 'AI unavailable: configure LLM first.',
    errorRequestFailed: isZh ? '请求失败，请检查配置或网络。' : 'Request failed. Check config/network.',
    thinking: isZh ? '思考中…' : 'Thinking…',
    quickPrompts: isZh ? '快速提问' : 'Quick prompts',
  };
}

function setStorageValue(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

function getStorageValue(key: string): string {
  return window.localStorage.getItem(key)?.trim() ?? '';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdownInto(el: HTMLElement, src: string): void {
  // Minimal, safe markdown renderer:
  // - escapes all HTML
  // - supports ```code blocks```, inline `code`, **bold**, and newlines
  const safe = escapeHtml(src);
  const parts = safe.split(/```/g);

  let html = '';
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    const isCode = i % 2 === 1;
    if (isCode) {
      html += `<pre style="white-space:pre-wrap;word-break:break-word;margin:6px 0;padding:8px;border-radius:8px;background:#0b1020;color:#e6edf3;">${chunk}</pre>`;
    } else {
      let txt = chunk;
      txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      txt = txt.replace(/`([^`]+?)`/g, '<code style="background:#eef2ff;border:1px solid #e5e7eb;border-radius:4px;padding:1px 4px;">$1</code>');
      txt = txt.replace(/\n/g, '<br/>');
      html += `<div>${txt}</div>`;
    }
  }

  el.innerHTML = html;
}

function renderMessageBubble(msg: ChatMessage): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = msg.role === 'user' ? 'flex-end' : 'flex-start';
  row.style.margin = '6px 0';

  const bubble = document.createElement('div');
  bubble.style.maxWidth = '75%';
  bubble.style.whiteSpace = 'pre-wrap';
  bubble.style.padding = '8px 10px';
  bubble.style.borderRadius = '10px';
  bubble.style.fontSize = '12px';
  bubble.style.lineHeight = '1.4';
  bubble.style.border = '1px solid #ddd';

  if (msg.role === 'user') {
    bubble.style.backgroundColor = '#e7f1ff';
  } else if (msg.role === 'assistant') {
    bubble.style.backgroundColor = '#f8f9fa';
  } else {
    bubble.style.backgroundColor = '#fff3cd';
  }

  if (msg.role === 'assistant') {
    renderMarkdownInto(bubble, msg.content);
  } else {
    bubble.textContent = msg.content;
  }
  row.appendChild(bubble);
  return row;
}

function getMatchContextText(ctx: UiCtx): string {
  const s = ctx.gameStore.state;
  if (!s) return 'No match running.';

  const phase = s.phase;
  const wallN = s.wall.length;
  const cur = s.currentPlayer;
  const p0Hand = s.hands.P0;
  const meldCountP0 = s.melds.P0.length;
  const baseP0 = 13 - meldCountP0 * 3;
  const canAnalyze = !s.lastDiscard && cur === 'P0' && p0Hand.length === baseP0 + 1;

  const lines: string[] = [];
  lines.push(`phase=${phase}, current=${cur}, turn=${s.turn}, wall=${wallN}`);

  if (phase === 'EXCHANGE') {
    lines.push('stage=exchange_3_tiles');
  } else if (phase === 'DING_QUE') {
    lines.push('stage=choose_missing_suit');
  } else if (phase === 'END') {
    lines.push('stage=end');
  } else {
    lines.push('stage=playing');
  }

  lines.push(`P0.hand=${p0Hand.map((t) => `${t.suit}${t.rank}`).join(' ')}`);
  lines.push(`P0.melds=${meldCountP0}`);

  if (canAnalyze && ctx.settingsStore.analysisEnabled) {
    const recs = ctx.analyzer.recommendDiscards(p0Hand, meldCountP0, {
      state: s,
      playerId: 'P0',
      style: { style: 'BALANCED', reasons: [] },
    });
    lines.push('recommendations_top3=' + recs.slice(0, 3).map((r) => {
      return `${r.discard} shanten ${r.shantenBefore}->${r.shantenAfter} ukeire ${r.ukeireTotal} risk ${r.dangerLevel}`;
    }).join(' | '));
  }

  return lines.join('\n');
}

function defaultQuickPrompts(ctx: UiCtx): QuickPrompt[] {
  const s = ctx.gameStore.state;
  const phase = s?.phase;
  const lang = languageStore.getLanguage();
  const isZh = lang === 'zh';

  if (phase === 'EXCHANGE') {
    return [
      { id: 'exchange-1', text: isZh ? '换三张怎么选？' : 'How should I choose 3 tiles to exchange?' },
      { id: 'exchange-2', text: isZh ? '我这手牌更适合做清一色吗？' : 'Is this hand suited for pure one suit?' },
      { id: 'exchange-3', text: isZh ? '换牌后优先思路是什么？' : 'What should be my priority after exchange?' },
    ];
  }

  if (phase === 'DING_QUE') {
    return [
      { id: 'dingque-1', text: isZh ? '定缺选哪门？' : 'Which suit should I choose as missing?' },
      { id: 'dingque-2', text: isZh ? '为什么不能定缺最多的那门？' : 'Why not choose the suit I have most of?' },
      { id: 'dingque-3', text: isZh ? '定缺后这手牌路线是什么？' : 'What is the plan after choosing missing suit?' },
    ];
  }

  return [
    { id: 'play-1', text: isZh ? '现在最推荐打哪张？' : 'What should I discard now?' },
    { id: 'play-2', text: isZh ? '这巡要进攻还是防守？' : 'Attack or defend this turn?' },
    { id: 'play-3', text: isZh ? '最危险的点是什么？' : 'What is the biggest risk right now?' },
  ];
}

async function generateQuickPrompts(ctx: UiCtx): Promise<QuickPrompt[]> {
  const analyzer = ctx.llmAnalyzer;
  if (!analyzer) return defaultQuickPrompts(ctx);

  const lang = languageStore.getLanguage();
  const isZh = lang === 'zh';
  const context = getMatchContextText(ctx);

  const system = isZh
    ? '你是成都麻将教练。请根据给定局面，生成 3 个“玩家可以直接点击发问”的短问题。只输出严格 JSON：{"prompts":["...","...","..."]}。'
    : 'You are a Chengdu Mahjong coach. Given the context, generate 3 short clickable questions. Output strict JSON only: {"prompts":["...","...","..."]}.';

  try {
    const reply = await analyzer.chat({
      system,
      messages: [{ role: 'user', content: `context:\n${context}` }],
    });
    const parsed = safeJsonParse(reply);
    const arr = parsed?.prompts;
    if (Array.isArray(arr) && arr.every((x: any) => typeof x === 'string' && x.trim().length > 0)) {
      return arr.slice(0, 3).map((text: string, i: number) => ({ id: `llm-${i}`, text: text.trim() }));
    }
  } catch {
    return defaultQuickPrompts(ctx);
  }

  return defaultQuickPrompts(ctx);
}

export function mountAIChatBadge(root: HTMLElement, ctx: UiCtx): () => void {
  const t = getText();

  const badge = document.createElement('button');
  badge.textContent = t.badge;
  badge.style.position = 'fixed';
  badge.style.top = '10px';
  badge.style.left = '10px';
  badge.style.zIndex = '2000';
  badge.style.width = '34px';
  badge.style.height = '34px';
  badge.style.borderRadius = '999px';
  badge.style.border = 'none';
  badge.style.cursor = 'pointer';
  badge.style.backgroundColor = '#6f42c1';
  badge.style.color = '#fff';
  badge.style.fontWeight = '700';
  badge.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';

  const win = document.createElement('div');
  win.style.position = 'fixed';
  win.style.zIndex = '2100';
  win.style.width = '420px';
  win.style.maxWidth = '92vw';
  win.style.height = '520px';
  win.style.maxHeight = '85vh';
  win.style.backgroundColor = '#fff';
  win.style.border = '1px solid #ddd';
  win.style.borderRadius = '10px';
  win.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
  win.style.display = 'none';
  win.style.overflow = 'hidden';

  const saved = safeJsonParse(getStorageValue('AI_CHAT_WINDOW_POS')) as any;
  const initialLeft = typeof saved?.left === 'number' ? saved.left : Math.max(10, window.innerWidth - 460);
  const initialTop = typeof saved?.top === 'number' ? saved.top : 60;
  win.style.left = `${clamp(initialLeft, 0, Math.max(0, window.innerWidth - 120))}px`;
  win.style.top = `${clamp(initialTop, 0, Math.max(0, window.innerHeight - 80))}px`;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '10px 10px';
  header.style.backgroundColor = '#f6f7f9';
  header.style.borderBottom = '1px solid #eee';
  header.style.cursor = 'move';

  const title = document.createElement('div');
  title.textContent = t.title;
  title.style.fontWeight = '700';
  title.style.fontSize = '13px';

  const headerBtns = document.createElement('div');
  headerBtns.style.display = 'flex';
  headerBtns.style.gap = '8px';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = t.clear;
  clearBtn.style.padding = '6px 10px';
  clearBtn.style.fontSize = '12px';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = t.close;
  closeBtn.style.padding = '6px 10px';
  closeBtn.style.fontSize = '12px';

  headerBtns.appendChild(clearBtn);
  headerBtns.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(headerBtns);

  const body = document.createElement('div');
  body.style.height = 'calc(100% - 46px)';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.padding = '10px';
  body.style.boxSizing = 'border-box';

  const quickTitle = document.createElement('div');
  quickTitle.textContent = t.quickPrompts;
  quickTitle.style.fontWeight = '700';
  quickTitle.style.fontSize = '12px';

  const quickWrap = document.createElement('div');
  quickWrap.style.display = 'flex';
  quickWrap.style.flexWrap = 'wrap';
  quickWrap.style.gap = '6px';
  quickWrap.style.marginTop = '6px';
  quickWrap.style.marginBottom = '10px';

  const transcript = document.createElement('div');
  transcript.style.flex = '1';
  transcript.style.overflowY = 'auto';
  transcript.style.border = '1px solid #eee';
  transcript.style.borderRadius = '8px';
  transcript.style.padding = '8px';
  transcript.style.backgroundColor = '#fafafa';

  const status = document.createElement('div');
  status.style.marginTop = '8px';
  status.style.fontSize = '12px';
  status.style.color = '#666';

  const inputRow = document.createElement('div');
  inputRow.style.display = 'flex';
  inputRow.style.gap = '8px';
  inputRow.style.marginTop = '8px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t.placeholder;
  input.style.flex = '1';
  input.style.padding = '10px 10px';
  input.style.border = '1px solid #ccc';
  input.style.borderRadius = '8px';
  input.style.fontSize = '12px';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = t.send;
  sendBtn.style.padding = '10px 14px';
  sendBtn.style.border = 'none';
  sendBtn.style.borderRadius = '8px';
  sendBtn.style.cursor = 'pointer';
  sendBtn.style.backgroundColor = '#4a90e2';
  sendBtn.style.color = '#fff';
  sendBtn.style.fontWeight = '700';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  const configWrap = document.createElement('div');
  configWrap.style.display = 'none';
  configWrap.style.marginTop = '10px';
  configWrap.style.paddingTop = '10px';
  configWrap.style.borderTop = '1px solid #eee';

  const cfgTitle = document.createElement('div');
  cfgTitle.textContent = t.notConfiguredTitle;
  cfgTitle.style.fontWeight = '700';
  cfgTitle.style.marginBottom = '8px';

  const endpointInput = document.createElement('input');
  endpointInput.type = 'text';
  endpointInput.placeholder = t.endpoint;
  endpointInput.value = getStorageValue('LLM_ENDPOINT');
  endpointInput.style.width = '100%';
  endpointInput.style.padding = '8px 10px';
  endpointInput.style.border = '1px solid #ccc';
  endpointInput.style.borderRadius = '8px';
  endpointInput.style.fontSize = '12px';
  endpointInput.style.boxSizing = 'border-box';

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.placeholder = t.apiKey;
  apiKeyInput.value = getStorageValue('LLM_API_KEY');

  const apiKeyRow = document.createElement('div');
  apiKeyRow.style.display = 'flex';
  apiKeyRow.style.gap = '8px';
  apiKeyRow.style.alignItems = 'center';
  apiKeyRow.style.marginTop = '8px';

  apiKeyInput.style.flex = '1';
  apiKeyInput.style.padding = '8px 10px';
  apiKeyInput.style.border = '1px solid #ccc';
  apiKeyInput.style.borderRadius = '8px';
  apiKeyInput.style.fontSize = '12px';
  apiKeyInput.style.boxSizing = 'border-box';

  const apiKeyToggle = document.createElement('button');
  apiKeyToggle.textContent = languageStore.getLanguage() === 'zh' ? '显示' : 'Show';
  apiKeyToggle.style.padding = '8px 10px';
  apiKeyToggle.style.borderRadius = '8px';
  apiKeyToggle.style.border = '1px solid #ddd';
  apiKeyToggle.style.backgroundColor = '#fff';
  apiKeyToggle.style.cursor = 'pointer';
  apiKeyToggle.style.fontSize = '12px';
  apiKeyToggle.onclick = () => {
    const next = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = next;
    apiKeyToggle.textContent = next === 'password'
      ? (languageStore.getLanguage() === 'zh' ? '显示' : 'Show')
      : (languageStore.getLanguage() === 'zh' ? '隐藏' : 'Hide');
  };

  apiKeyRow.appendChild(apiKeyInput);
  apiKeyRow.appendChild(apiKeyToggle);

  const modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.placeholder = t.model;
  modelInput.value = getStorageValue('LLM_MODEL');
  modelInput.style.width = '100%';
  modelInput.style.padding = '8px 10px';
  modelInput.style.border = '1px solid #ccc';
  modelInput.style.borderRadius = '8px';
  modelInput.style.fontSize = '12px';
  modelInput.style.boxSizing = 'border-box';
  modelInput.style.marginTop = '8px';

  const presetBtn = document.createElement('button');
  presetBtn.textContent = t.deepseekPreset;
  presetBtn.style.marginTop = '8px';
  presetBtn.style.padding = '8px 10px';
  presetBtn.style.borderRadius = '8px';
  presetBtn.style.cursor = 'pointer';
  presetBtn.style.border = '1px solid #ddd';
  presetBtn.style.backgroundColor = '#fff';
  presetBtn.style.fontSize = '12px';

  const testBtn = document.createElement('button');
  testBtn.textContent = languageStore.getLanguage() === 'zh' ? '测试连通性' : 'Test Connectivity';
  testBtn.style.marginTop = '8px';
  testBtn.style.padding = '8px 10px';
  testBtn.style.borderRadius = '8px';
  testBtn.style.cursor = 'pointer';
  testBtn.style.border = '1px solid #ddd';
  testBtn.style.backgroundColor = '#fff';
  testBtn.style.fontSize = '12px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = t.save;
  saveBtn.style.marginTop = '8px';
  saveBtn.style.padding = '8px 12px';
  saveBtn.style.border = 'none';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.backgroundColor = '#28a745';
  saveBtn.style.color = '#fff';
  saveBtn.style.fontWeight = '700';

  configWrap.appendChild(cfgTitle);
  configWrap.appendChild(endpointInput);
  configWrap.appendChild(apiKeyRow);
  configWrap.appendChild(modelInput);
  configWrap.appendChild(presetBtn);
  configWrap.appendChild(testBtn);
  configWrap.appendChild(saveBtn);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a rigorous Chengdu Mahjong coach. Answer concisely and give actionable suggestions.',
    },
  ];

  let open = false;
  let inFlight = false;
  let lastPhaseKey: string | null = null;
  let quickPrompts: QuickPrompt[] = defaultQuickPrompts(ctx);

  function scrollToBottom(): void {
    transcript.scrollTop = transcript.scrollHeight;
  }

  function renderTranscript(): void {
    transcript.innerHTML = '';
    for (const m of messages.filter((m) => m.role !== 'system')) {
      transcript.appendChild(renderMessageBubble(m));
    }
    scrollToBottom();
  }

  function refreshConfigVisibility(): void {
    const showConfig = !ctx.llmAnalyzer;
    configWrap.style.display = showConfig ? 'block' : 'none';
  }

  function getSystemPrompt(): string {
    const lang = languageStore.getLanguage();
    const isZh = lang === 'zh';
    const ctxText = getMatchContextText(ctx);
    return isZh
      ? `你是一个严谨的成都麻将战术教练。\n\n当前局面信息：\n${ctxText}\n\n回答要求：简洁、可执行、指出风险与优先级。`
      : `You are a rigorous Chengdu Mahjong coach.\n\nMatch context:\n${ctxText}\n\nAnswer concisely with actionable suggestions and risks.`;
  }

  async function send(text: string): Promise<void> {
    const question = text.trim();
    if (!question) return;
    if (inFlight) return;

    if (!ctx.llmAnalyzer) {
      status.textContent = t.errorNotConfigured;
      refreshConfigVisibility();
      return;
    }

    messages.push({ role: 'user', content: question });
    input.value = '';
    status.textContent = t.thinking;
    renderTranscript();

    // Prepare a placeholder assistant bubble for streaming.
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    messages.push(assistantMsg);
    renderTranscript();

    inFlight = true;
    sendBtn.disabled = true;

    try {
      const convo = messages.filter(
        (m): m is { role: 'user' | 'assistant'; content: string } => m.role !== 'system',
      );

      const system = getSystemPrompt();

      if (typeof ctx.llmAnalyzer.chatStream === 'function') {
        await ctx.llmAnalyzer.chatStream({
          system,
          messages: convo.map((m) => ({ role: m.role, content: m.content })),
          onDelta: (delta) => {
            assistantMsg.content += delta;
            renderTranscript();
          },
        });
      } else {
        const reply = await ctx.llmAnalyzer.chat({
          system,
          messages: convo.map((m) => ({ role: m.role, content: m.content })),
        });
        assistantMsg.content = reply;
        renderTranscript();
      }

      status.textContent = '';
    } catch (e: any) {
      // Remove placeholder assistant bubble if empty, then show error.
      if (assistantMsg.content.trim().length === 0) {
        const idx = messages.indexOf(assistantMsg);
        if (idx >= 0) messages.splice(idx, 1);
        renderTranscript();
      }
      const name = typeof e?.name === 'string' ? e.name : 'Error';
      const msg = typeof e?.message === 'string' ? e.message : '';
      status.textContent = msg ? `${t.errorRequestFailed} (${name}: ${msg})` : `${t.errorRequestFailed} (${name})`;
    } finally {
      inFlight = false;
      sendBtn.disabled = false;
      renderTranscript();
    }
  }

  function renderQuickPrompts(): void {
    quickWrap.innerHTML = '';
    for (const p of quickPrompts) {
      const b = document.createElement('button');
      b.textContent = p.text;
      b.style.padding = '6px 10px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid #ddd';
      b.style.backgroundColor = '#fff';
      b.style.cursor = 'pointer';
      b.style.fontSize = '12px';
      b.onclick = () => void send(p.text);
      quickWrap.appendChild(b);
    }
  }

  async function refreshQuickPrompts(): Promise<void> {
    const s = ctx.gameStore.state;
    const key = s ? `${s.phase}|${s.currentPlayer}|${s.turn}|${s.wall.length}` : 'no_state';
    if (key === lastPhaseKey) return;
    lastPhaseKey = key;

    quickPrompts = defaultQuickPrompts(ctx);
    renderQuickPrompts();

    if (!ctx.settingsStore.llmEnabled || !ctx.llmAnalyzer) return;
    const next = await generateQuickPrompts(ctx);
    quickPrompts = next;
    renderQuickPrompts();
  }

  sendBtn.onclick = () => {
    void send(input.value);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      void send(input.value);
    }
  });

  clearBtn.onclick = () => {
    while (messages.length > 1) messages.pop();
    status.textContent = '';
    renderTranscript();
  };

  closeBtn.onclick = () => {
    open = false;
    win.style.display = 'none';
  };

  presetBtn.onclick = () => {
    endpointInput.value = 'https://api.deepseek.com/chat/completions';
    modelInput.value = 'deepseek-chat';
  };

  testBtn.onclick = async () => {
    const endpoint = endpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim();
    if (!endpoint || !apiKey || !model) {
      status.textContent = languageStore.getLanguage() === 'zh'
        ? '请先填写 endpoint/apiKey/model'
        : 'Please fill endpoint/apiKey/model first';
      return;
    }

    testBtn.disabled = true;
    const old = testBtn.textContent;
    testBtn.textContent = languageStore.getLanguage() === 'zh' ? '测试中…' : 'Testing…';
    try {
      const ctrl = new AbortController();
      const timeoutMs = 8000;
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are a ping endpoint.' },
              { role: 'user', content: 'ping' },
            ],
            temperature: 0,
            stream: false,
            max_tokens: 16,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          status.textContent = `${languageStore.getLanguage() === 'zh' ? '失败' : 'Failed'}: HTTP ${res.status}`;
          return;
        }

        const data = (await res.json()) as any;
        const text = data?.choices?.[0]?.message?.content;
        status.textContent = typeof text === 'string'
          ? (languageStore.getLanguage() === 'zh' ? '成功' : 'OK')
          : (languageStore.getLanguage() === 'zh' ? '响应格式异常' : 'Unexpected response shape');
      } finally {
        clearTimeout(timer);
      }
    } catch (e: any) {
      status.textContent = `${languageStore.getLanguage() === 'zh' ? '失败' : 'Failed'}: ${e?.name || 'Error'}`;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = old;
    }
  };

  saveBtn.onclick = () => {
    if (inFlight) return;
    saveBtn.textContent = t.saving;
    saveBtn.disabled = true;
    try {
      setStorageValue('LLM_ENDPOINT', endpointInput.value.trim());
      setStorageValue('LLM_API_KEY', apiKeyInput.value.trim());
      setStorageValue('LLM_MODEL', modelInput.value.trim());
      ctx.llmAnalyzer = createBrowserLLMAnalyzerFromStorage();
      refreshConfigVisibility();
      status.textContent = ctx.llmAnalyzer ? '' : t.errorNotConfigured;
      void refreshQuickPrompts();
    } finally {
      saveBtn.textContent = t.save;
      saveBtn.disabled = false;
    }
  };

  body.appendChild(quickTitle);
  body.appendChild(quickWrap);
  body.appendChild(transcript);
  body.appendChild(status);
  body.appendChild(inputRow);
  body.appendChild(configWrap);

  win.appendChild(header);
  win.appendChild(body);

  function setOpen(next: boolean): void {
    open = next;
    win.style.display = open ? 'block' : 'none';
    if (open) {
      refreshConfigVisibility();
      renderTranscript();
      renderQuickPrompts();
      void refreshQuickPrompts();
      setTimeout(() => input.focus(), 0);
    }
  }

  badge.onclick = () => {
    setOpen(!open);
  };

  const stateUnsub = ctx.gameStore.subscribe(() => {
    if (!open) return;
    void refreshQuickPrompts();
  });

  const langUnsub = languageStore.subscribe(() => {
    if (!open) return;
    renderQuickPrompts();
  });

  let dragActive = false;
  let dragDx = 0;
  let dragDy = 0;

  const onMouseMove = (e: MouseEvent) => {
    if (!dragActive) return;
    const left = clamp(e.clientX - dragDx, 0, Math.max(0, window.innerWidth - win.offsetWidth));
    const top = clamp(e.clientY - dragDy, 0, Math.max(0, window.innerHeight - win.offsetHeight));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    setStorageValue('AI_CHAT_WINDOW_POS', JSON.stringify({ left, top }));
  };

  const onMouseUp = () => {
    dragActive = false;
  };

  header.addEventListener('mousedown', (e) => {
    dragActive = true;
    const rect = win.getBoundingClientRect();
    dragDx = e.clientX - rect.left;
    dragDy = e.clientY - rect.top;
  });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  root.appendChild(badge);
  root.appendChild(win);

  return () => {
    stateUnsub();
    langUnsub();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    badge.remove();
    win.remove();
  };
}
