import { languageStore } from '../store/languageStore';

type CoachTexts = {
  title: string;
  subtitle: string;
  voiceTitle: string;
  summaryTitle: string;
  summarySubtitleReady: string;
  summarySubtitleConfig: string;
  turn: string;
  wall: string;
  phase: string;
  llm: string;
  notAvailable: string;
  llmReady: string;
  llmKeyRequired: string;
  refreshAdvice: string;
  settings: string;
  configTitle: string;
  configHint: string;
  adviceTitle: string;
  adviceSubtitle: string;
  guidance: string;
  getAdvice: string;
  analyzing: string;
  waitingAdvice: string;
  adviceUnavailableTitle: string;
  adviceUnavailableHint: string;
  adviceReadyTitle: string;
  adviceReadyHint: string;
  recommended: string;
  confidence: string;
  askTitle: string;
  askSubtitle: string;
  readyCode: string;
  readyHint: string;
  inputPlaceholderReady: string;
  inputPlaceholderSetup: string;
  send: string;
  sending: string;
  mic: string;
  recording: string;
  processing: string;
  errorShort: string;
  voiceReady: string;
  voiceListening: string;
  voiceProcessing: string;
  voiceError: string;
  voiceOff: string;
  levelNames: Record<'beginner' | 'learning' | 'practicing' | 'advanced', string>;
  quickQuestions: {
    exchange: string[];
    dingQue: string[];
    playing: string[];
  };
  adviceUnavailableToast: string;
  adviceErrorToast: string;
  voiceErrorToast: string;
  openSettingsToast: string;
  phaseNames: Record<string, string>;
  actionNames: Record<string, string>;
};

type LlmSettingsTexts = {
  title: string;
  subtitle: string;
  provider: string;
  apiKey: string;
  model: string;
  entrypoint: string;
  maxOutputTokens: string;
  contextWindow: string;
  temperature: string;
  creativity: string;
  notesTitle: string;
  notesBody: string;
  cancel: string;
  save: string;
  savedToast: string;
  providerLabels: {
    openaiCompatible: string;
    openai: string;
    anthropic: string;
    deepseek: string;
    local: string;
  };
};

type AiSettingsTexts = {
  llmTutor: string;
  provider: string;
  model: string;
  llmSettings: string;
  providerOpenAICompatible: string;
  providerOff: string;
};

type SpeechTexts = {
  audioCapture: string;
  notAllowed: string;
  noSpeech: string;
  network: string;
  aborted: string;
  fallback: string;
};

type AiTexts = {
  coach: CoachTexts;
  llmSettings: LlmSettingsTexts;
  settings: AiSettingsTexts;
  speech: SpeechTexts;
};

const zh: AiTexts = {
  coach: {
    title: '麻将导师',
    subtitle: '建议 / 问答 / 语音',
    voiceTitle: '语音',
    summaryTitle: '牌桌状态',
    summarySubtitleReady: '实时 / 可用',
    summarySubtitleConfig: '实时 / 待配置',
    turn: '当前',
    wall: '牌墙',
    phase: '阶段',
    llm: '导师',
    notAvailable: '暂无',
    llmReady: '导师已就绪',
    llmKeyRequired: '需要配置密钥',
    refreshAdvice: '刷新建议',
    settings: '设置',
    configTitle: '配置',
    configHint: '请先配置 API Key，再请求导师建议或进行问答。',
    adviceTitle: '局中建议',
    adviceSubtitle: '实时 / 当前局面',
    guidance: '指导等级',
    getAdvice: '获取建议',
    analyzing: '分析中...',
    waitingAdvice: '等待对局开始后再请求建议',
    adviceUnavailableTitle: '暂不可用',
    adviceUnavailableHint: '只有当 P0 当前存在可打牌或可响应动作时，导师才能给出建议。',
    adviceReadyTitle: '就绪',
    adviceReadyHint: '点击获取当前局面的最新建议。导师会结合可行动作和风险一起分析。',
    recommended: '推荐操作',
    confidence: '置信度',
    askTitle: '问导师',
    askSubtitle: '问答 / 快速提问',
    readyCode: '就绪',
    readyHint: '输入问题、点快捷问句，或使用语音先转成文字。',
    inputPlaceholderReady: '可以问防守、出牌、碰杠时机，或当前局面...',
    inputPlaceholderSetup: '请先打开设置，配置导师服务...',
    send: '发送',
    sending: '发送中...',
    mic: '语音',
    recording: '录音',
    processing: '处理中',
    errorShort: '异常',
    voiceReady: '语音就绪',
    voiceListening: '语音识别中',
    voiceProcessing: '语音处理中',
    voiceError: '语音异常',
    voiceOff: '语音不可用',
    levelNames: {
      beginner: '初学者',
      learning: '学习中',
      practicing: '练习中',
      advanced: '高级',
    },
    quickQuestions: {
      exchange: ['换三张应该换哪3张？', '分析我的手牌', '换牌后如何定缺？'],
      dingQue: ['应该定哪一门？', '分析三种花色', '定缺后怎么打？'],
      playing: ['分析当前局面', '我现在该打什么？', '如何防守？', '何时该碰牌？'],
    },
    adviceUnavailableToast: '当前局面无法给建议',
    adviceErrorToast: '建议生成失败',
    voiceErrorToast: '语音识别异常',
    openSettingsToast: '请先到对局页外层设置中配置导师',
    phaseNames: {
      EXCHANGE: '换三张',
      DING_QUE: '定缺',
      END: '结束',
    },
    actionNames: {
      DISCARD: '打',
      PASS: '过',
      PENG: '碰',
      GANG: '杠',
      HU: '胡',
      DRAW: '摸牌',
    },
  },
  llmSettings: {
    title: 'LLM 设置',
    subtitle: '提供商 / 模型 / 接口',
    provider: '提供商',
    apiKey: 'API 密钥',
    model: '模型',
    entrypoint: '入口地址',
    maxOutputTokens: '最大输出 Token',
    contextWindow: '上下文窗口',
    temperature: '温度',
    creativity: '创造性',
    notesTitle: '说明',
    notesBody: '浏览器端 API Key 对客户端可见。若此页面会被他人使用，请使用受限密钥并定期轮换。',
    cancel: '取消',
    save: '保存',
    savedToast: '已保存',
    providerLabels: {
      openaiCompatible: 'OpenAI 兼容',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      deepseek: 'DeepSeek',
      local: '本地模式',
    },
  },
  settings: {
    llmTutor: 'LLM 导师：',
    provider: '提供商：',
    model: '模型：',
    llmSettings: 'LLM 设置',
    providerOpenAICompatible: 'OpenAI 兼容',
    providerOff: '未配置',
  },
  speech: {
    audioCapture: '未检测到可用麦克风',
    notAllowed: '麦克风权限被拒绝',
    noSpeech: '没有识别到语音',
    network: '语音识别网络异常',
    aborted: '语音识别已取消',
    fallback: '语音识别失败',
  },
};

const en: AiTexts = {
  coach: {
    title: 'Mahjong Coach',
    subtitle: 'Advice / Ask / Voice',
    voiceTitle: 'Voice',
    summaryTitle: 'Table Status',
    summarySubtitleReady: 'Live / Ready',
    summarySubtitleConfig: 'Live / Setup',
    turn: 'Turn',
    wall: 'Wall',
    phase: 'Phase',
    llm: 'Coach',
    notAvailable: 'N/A',
    llmReady: 'LLM Ready',
    llmKeyRequired: 'Key Required',
    refreshAdvice: 'Refresh Advice',
    settings: 'Settings',
    configTitle: 'Config',
    configHint: 'Configure an API key before requesting coach advice or chat responses.',
    adviceTitle: 'Coach Advice',
    adviceSubtitle: 'Live / Contextual',
    guidance: 'Guidance',
    getAdvice: 'Get Advice',
    analyzing: 'Analyzing...',
    waitingAdvice: 'Wait until the match starts before requesting advice.',
    adviceUnavailableTitle: 'Unavailable',
    adviceUnavailableHint: 'Advice is only available when the current board state exposes playable or response actions for P0.',
    adviceReadyTitle: 'Ready',
    adviceReadyHint: 'Request a fresh recommendation for the current board. The coach will consider your legal actions and risk level.',
    recommended: 'Recommended',
    confidence: 'Confidence',
    askTitle: 'Ask Coach',
    askSubtitle: 'Chat / Quick Ask',
    readyCode: 'Ready',
    readyHint: 'Type a question, tap a quick prompt, or use voice to fill the input first.',
    inputPlaceholderReady: 'Ask about defense, discards, reactions, or the current board...',
    inputPlaceholderSetup: 'Open settings to configure the coach...',
    send: 'Send',
    sending: 'Sending...',
    mic: 'Mic',
    recording: 'Rec',
    processing: 'Wait',
    errorShort: 'Err',
    voiceReady: 'Voice Ready',
    voiceListening: 'Voice Listening',
    voiceProcessing: 'Voice Processing',
    voiceError: 'Voice Error',
    voiceOff: 'Voice Off',
    levelNames: {
      beginner: 'Beginner',
      learning: 'Learning',
      practicing: 'Practice',
      advanced: 'Advanced',
    },
    quickQuestions: {
      exchange: ['Which 3 tiles should I exchange?', 'Analyze my hand', 'How should I choose the missing suit after exchange?'],
      dingQue: ['Which suit should I choose as missing?', 'Analyze the three suits', 'How should I play after choosing missing suit?'],
      playing: ['Analyze the current board', 'What should I discard now?', 'How should I defend?', 'When should I call PENG?'],
    },
    adviceUnavailableToast: 'Advice unavailable',
    adviceErrorToast: 'Advice failed',
    voiceErrorToast: 'Voice error',
    openSettingsToast: 'Open match settings first',
    phaseNames: {
      EXCHANGE: 'Exchange',
      DING_QUE: 'Ding Que',
      END: 'End',
    },
    actionNames: {
      DISCARD: 'Discard',
      PASS: 'Pass',
      PENG: 'Peng',
      GANG: 'Gang',
      HU: 'Hu',
      DRAW: 'Draw',
    },
  },
  llmSettings: {
    title: 'LLM Settings',
    subtitle: 'Provider / Model / API',
    provider: 'Provider',
    apiKey: 'API Key',
    model: 'Model',
    entrypoint: 'Entrypoint',
    maxOutputTokens: 'Max Output Tokens',
    contextWindow: 'Context Window Size',
    temperature: 'Temperature',
    creativity: 'Creativity',
    notesTitle: 'Notes',
    notesBody: 'Browser-side API keys are visible to the client. Use a scoped key and rotate it if this page is shared outside your local machine.',
    cancel: 'Cancel',
    save: 'Save',
    savedToast: 'Saved',
    providerLabels: {
      openaiCompatible: 'OpenAI Compatible',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      deepseek: 'DeepSeek',
      local: 'Local Mode',
    },
  },
  settings: {
    llmTutor: 'LLM Tutor:',
    provider: 'Provider:',
    model: 'Model:',
    llmSettings: 'LLM Settings',
    providerOpenAICompatible: 'OpenAI Compatible',
    providerOff: 'Off',
  },
  speech: {
    audioCapture: 'No microphone detected',
    notAllowed: 'Microphone permission denied',
    noSpeech: 'No speech detected',
    network: 'Speech recognition network error',
    aborted: 'Speech recognition was cancelled',
    fallback: 'Speech recognition failed',
  },
};

export function getAiText(): AiTexts {
  return languageStore.getLanguage() === 'zh' ? zh : en;
}
