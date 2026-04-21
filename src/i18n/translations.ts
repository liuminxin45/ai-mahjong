/**
 * 国际化翻译文件
 * 支持中文和英文切换
 */

export type Language = 'zh' | 'en';

export interface Translations {
  // 通用
  common: {
    back: string;
    confirm: string;
    cancel: string;
    close: string;
    save: string;
    loading: string;
    error: string;
    success: string;
  };
  
  // 主页
  home: {
    title: string;
    subtitle: string;
    copy: string;
    replay: string;
    footer: string;
    newGame: string;
    settings: string;
    about: string;
    version: string;
  };
  
  // 设置页面
  settings: {
    title: string;
    aiDifficulty: string;
    aiDifficultyValue: string;
    rule: string;
    ruleChengdu: string;
    rulePlaceholder: string;
    analysisEnabled: string;
    llmEnabled: string;
    uiMode: string;
    uiModeDebug: string;
    uiModeTable: string;
    timeoutEnabled: string;
    timeoutMs: string;
    p0AIMode: string;
    p0AIModeDesc: string;
    p0AIModeAlert: string;
    language: string;
    languageChinese: string;
    languageEnglish: string;
    
    // 训练相关
    trainingMode: string;
    trainingGames: string;
    trainingBlocking: string;
    trainingVerbose: string;
    startTraining: string;
    stopTraining: string;
    trainingStatus: string;
    trainingProgress: string;
    trainingBestFitness: string;
    trainingCurrentFitness: string;
    trainingAcceptRate: string;
    displayTitle: string;
    displaySubtitle: string;
    displaySubtitleShort: string;
    ruleSubtitle: string;
    uiScale: string;
    hudSafeZone: string;
    trainingSubtitle: string;
    trainingRangeError: string;
    trainingCompleted: string;
    trainingFailed: (error: string) => string;
    trainingStopped: string;
    toolsTitle: string;
    toolsSubtitle: string;
    toolsHistory: string;
    toolsProfile: string;
    toolsAIParams: string;
  };
  
  // 游戏界面
  game: {
    // 阶段
    phaseExchange: string;
    phaseDingQue: string;
    phasePlaying: string;
    phaseEnd: string;
    
    // 玩家
    player: string;
    you: string;
    
    // 动作
    draw: string;
    discard: string;
    peng: string;
    gang: string;
    hu: string;
    pass: string;
    exchangeSelect: string;
    exchangeConfirm: string;
    dingQue: string;
    exchangeTitle: string;
    exchangeInstruction: string;
    exchangeSelected: (count: number) => string;
    exchangeWaiting: string;
    dingTitle: string;
    dingInstruction: string;
    dingSelected: (suitName: string) => string;
    dingHandTitle: string;
    dingSuitCount: (wan: number, tiao: number, bing: number) => string;
    dingSuitOption: (name: string, count: number) => string;
    
    // 花色
    wan: string;
    tiao: string;
    bing: string;
    
    // 游戏状态
    turn: string;
    wallRemaining: string;
    waiting: string;
    thinking: string;
    
    // 结束界面
    gameOver: string;
    winner: string;
    drawResult: string;
    youWin: string;
    youLose: string;
    copyLog: string;
    newGame: string;
    backToHome: string;
    
    // 番型
    yakuPingHu: string;
    yakuDuiDuiHu: string;
    yakuQingYiSe: string;
    yakuQiDuiZi: string;
    yakuLongQiDui: string;
    yakuGangShangKaiHua: string;
    yakuQiangGangHu: string;
    yakuHaiDiLaoYue: string;
    yakuTianHu: string;
    yakuDiHu: string;
    yakuZiMo: string;
    yakuJinGouDiao: string;
    
    // 其他
    score: string;
    fan: string;
    finalScore: string;
    
    // 弃牌区
    discards: string;
    yourDiscards: string;
    hand: string;
    tiles: string;
    melds: string;
    yourMelds: string;
    selfDrawWin: string;
    copied: string;
    discardHint: string;
    noMatchRunning: string;
    pengShort: string;
    gangShort: string;
    gangAn: string;
    gangJia: string;
    gangMing: string;
    tableLabel: string;
  };

  replay: {
    title: string;
    subtitle: string;
    eventLogTitle: string;
    eventLogSubtitle: string;
    play: string;
    stop: string;
    noDataTitle: string;
    noDataDetail: string;
  };

  historyPanel: {
    title: string;
    subtitle: string;
    loading: string;
    emptyTitle: string;
    emptyDetail: string;
    export: string;
    clear: string;
    clearTitle: string;
    clearMessage: string;
    summary: string;
    aggregate: string;
    games: string;
    winRate: string;
    bestStreak: string;
    avgScore: string;
    split: string;
    splitSub: string;
    wins: string;
    losses: string;
    draws: string;
    recent: string;
    latest: string;
    win: string;
    lose: string;
    draw: string;
    melds: string;
    minutes: string;
    exported: string;
    historyCode: string;
    button: string;
  };

  profilePanel: {
    title: string;
    subtitle: string;
    loading: string;
    lowDataTitle: string;
    lowDataDetail: (count: number) => string;
    refresh: string;
    refreshing: string;
    refreshToast: string;
    errorTitle: string;
    errorDetail: string;
    profile: string;
    skills: string;
    style: string;
    recommendations: string;
    currentLevels: string;
    nextSteps: string;
    description: string;
    strengths: string;
    weaknesses: string;
    focus: string;
    improve: string;
    mistakes: string;
    overall: string;
    games: string;
    winRate: string;
    dealIn: string;
    unknown: string;
    player: string;
    button: string;
    rankBeginner: string;
    rankIntermediate: string;
    rankAdvanced: string;
    rankExpert: string;
    skillHandReading: string;
    skillEfficiency: string;
    skillDefense: string;
    skillRiskManagement: string;
    skillTiming: string;
    skillAdaptation: string;
  };

  aiParamsPanel: {
    panelTitle: string;
    panelSubtitle: string;
    reset: string;
    export: string;
    resetCode: string;
    resetMessage: string;
    copied: string;
    resetDone: string;
    capability: string;
    currentScore: string;
    aiScore: string;
    trainingStats: string;
    currentRun: string;
    trainingSteps: string;
    bestFitness: string;
    acceptRate: string;
    gamesPlayed: string;
    aiWinRate: string;
    paramList: string;
    readOnly: string;
    btnLabel: (cap: number) => string;
    na: string;
    catShantenStage: string;
    catRiskDefense: string;
    catValueScore: string;
    catMeldPenalties: string;
    catMultipliers: string;
  };

  reviewPanel: {
    title: string;
    subtitle: string;
    loading: string;
    errorTitle: string;
    errorDetail: string;
    keyMoments: string;
    items: string;
    improvements: string;
    nextGames: string;
    actions: string;
    summary: string;
    grade: string;
    score: string;
    dealIn: string;
    melds: string;
    assessment: string;
    goodBad: string;
    strengths: string;
    weaknesses: string;
    turn: string;
    yourAction: string;
    optimal: string;
    lesson: string;
    skills: string;
    efficiency: string;
    defense: string;
    timing: string;
    impactCritical: string;
    impactSignificant: string;
    impactMinor: string;
  };

  debug: {
    noMatchRunning: string;
    current: string;
    turn: string;
    wall: string;
    discards: string;
    style: string;
    handTitle: string;
    responseToDiscard: (from: string) => string;
    recommendTop3: string;
    recommendLine: (discard: string, before: number, after: number, ukeire: number, risk: string) => string;
    tacticalExplain: string;
    phaseEarly: string;
    phaseMid: string;
    phaseLate: string;
    stateSummary: (phase: string, wall: number, meldCount: number) => string;
    llmUnavailable: string;
    llmUnavailableShort: string;
    generating: string;
    eventLog: string;
  };

  gameLog: {
    title: string;
    copy: string;
    copyDone: string;
    copyFailed: string;
    clear: string;
    clearTitle: string;
    clearMessage: string;
    empty: string;
  };
  
  // 关于页面
  about: {
    title: string;
    description: string;
    features: string;
    featureList: string[];
    author: string;
    license: string;
  };
}

export const translations: Record<Language, Translations> = {
  zh: {
    common: {
      back: '返回',
      confirm: '确认',
      cancel: '取消',
      close: '关闭',
      save: '保存',
      loading: '加载中...',
      error: '错误',
      success: '成功',
    },
    
    home: {
      title: '成都麻将',
      subtitle: 'CHENGDU MAHJONG / PIXEL TABLE',
      copy: '血战到底，像素化平面牌桌。开始新局、调整设置、查看回放。',
      replay: '回放',
      footer: 'V1.0 / OPEN SOURCE',
      newGame: '开始游戏',
      settings: '设置',
      about: '关于',
      version: '版本',
    },
    
    settings: {
      title: '设置',
      aiDifficulty: 'AI 难度：',
      aiDifficultyValue: '高 (最强智能)',
      rule: '规则：',
      ruleChengdu: '成都麻将',
      rulePlaceholder: '占位规则',
      analysisEnabled: '分析模式：',
      llmEnabled: 'LLM 模式：',
      uiMode: 'UI 模式：',
      uiModeDebug: '调试',
      uiModeTable: '牌桌',
      timeoutEnabled: '超时限制：',
      timeoutMs: '超时时间 (毫秒)：',
      p0AIMode: 'P0 AI 模式 (测试用)：',
      p0AIModeDesc: '启用后 P0 也由 AI 控制',
      p0AIModeAlert: 'P0 AI 模式已启用。请开始新游戏以查看完整的 AI 对战。',
      language: '语言：',
      languageChinese: '中文',
      languageEnglish: 'English',
      trainingMode: '训练模式：',
      trainingGames: '训练局数：',
      trainingBlocking: '阻塞模式：',
      trainingVerbose: '详细日志：',
      startTraining: '开始训练',
      stopTraining: '停止训练',
      trainingStatus: '训练状态',
      trainingProgress: '进度',
      trainingBestFitness: '最佳适应度',
      trainingCurrentFitness: '当前适应度',
      trainingAcceptRate: '接受率',
      displayTitle: '显示与可读性',
      displaySubtitle: '像素扁平设置台。所有控制统一到单层壳体内。',
      displaySubtitleShort: 'UI SCALE / SAFE ZONE',
      ruleSubtitle: 'RULE / UI / LANGUAGE / TIMEOUT',
      uiScale: 'UI 缩放',
      hudSafeZone: 'HUD 安全边距',
      trainingSubtitle: 'TRAINING / METRICS / CONTROL',
      trainingRangeError: '训练局数必须在 1 到 10000 之间',
      trainingCompleted: '训练完成',
      trainingFailed: (error: string) => `训练失败：${error}`,
      trainingStopped: '训练已停止',
      toolsTitle: '数据与分析工具',
      toolsSubtitle: 'HISTORY / PROFILE / AI PARAMS',
      toolsHistory: '历史',
      toolsProfile: '画像',
      toolsAIParams: '参数',
    },
    
    game: {
      phaseExchange: '换三张',
      phaseDingQue: '定缺',
      phasePlaying: '游戏中',
      phaseEnd: '游戏结束',
      
      player: '玩家',
      you: '你',
      
      draw: '摸牌',
      discard: '打牌',
      peng: '碰',
      gang: '杠',
      hu: '胡',
      pass: '过',
      exchangeSelect: '选择换牌',
      exchangeConfirm: '确认换牌',
      dingQue: '定缺',
      exchangeTitle: '换三张',
      exchangeInstruction: '选择同一花色的三张牌进行顺时针交换',
      exchangeSelected: (count: number) => `已选择：${count}/3`,
      exchangeWaiting: '已提交，等待其他玩家...',
      dingTitle: '选择缺门',
      dingInstruction: '请指定本局不要胡的花色（成都规则）',
      dingSelected: (suitName: string) => `已选择缺门：${suitName}，等待其他玩家...`,
      dingHandTitle: '当前手牌：',
      dingSuitCount: (wan: number, tiao: number, bing: number) => `万：${wan} | 条：${tiao} | 筒：${bing}`,
      dingSuitOption: (name: string, count: number) => `${name}（${count}）`,
      
      wan: '万',
      tiao: '条',
      bing: '饼',
      
      turn: '回合',
      wallRemaining: '剩余牌数',
      waiting: '等待中',
      thinking: '思考中',
      
      gameOver: '游戏结束',
      winner: '胜利者',
      drawResult: '流局',
      youWin: '你赢了！',
      youLose: '你输了',
      copyLog: '复制日志',
      newGame: '新游戏',
      backToHome: '返回主页',
      
      yakuPingHu: '平胡',
      yakuDuiDuiHu: '对对胡',
      yakuQingYiSe: '清一色',
      yakuQiDuiZi: '七对子',
      yakuLongQiDui: '龙七对',
      yakuGangShangKaiHua: '杠上开花',
      yakuQiangGangHu: '抢杠胡',
      yakuHaiDiLaoYue: '海底捞月',
      yakuTianHu: '天胡',
      yakuDiHu: '地胡',
      yakuZiMo: '自摸',
      yakuJinGouDiao: '金钩钓',
      
      score: '得分',
      fan: '番',
      finalScore: '最终得分',
      
      discards: '弃牌',
      yourDiscards: '你的弃牌',
      hand: '剩余',
      tiles: '张',
      melds: '碰杠',
      yourMelds: '你的碰杠',
      selfDrawWin: '自摸胡牌',
      copied: '✓ 已复制',
      discardHint: '选择要打出的牌',
      noMatchRunning: '暂无进行中的对局',
      pengShort: '碰',
      gangShort: '杠',
      gangAn: '暗杠',
      gangJia: '补杠',
      gangMing: '明杠',
      tableLabel: '麻将牌桌',
    },

    replay: {
      title: '回放',
      subtitle: '像素回放台。按时间顺序播放最近一局。',
      eventLogTitle: '事件日志',
      eventLogSubtitle: '最近回放',
      play: '播放',
      stop: '停止',
      noDataTitle: '没有可用回放',
      noDataDetail: '先在对局页导出一局。',
    },

    historyPanel: {
      title: '对局历史',
      subtitle: '统计 / 结果 / 复盘',
      loading: '正在读取对局记录...',
      emptyTitle: '暂无对局记录',
      emptyDetail: '完成一局游戏后，记录将自动保存。',
      export: '导出',
      clear: '清除',
      clearTitle: '清除历史',
      clearMessage: '确定要清除所有对局记录吗？此操作不可恢复。',
      summary: '汇总',
      aggregate: '总览',
      games: '对局',
      winRate: '胜率',
      bestStreak: '最长连胜',
      avgScore: '平均得分',
      split: '结果分布',
      splitSub: '胜 / 负 / 流局',
      wins: '胜',
      losses: '负',
      draws: '流局',
      recent: '最近对局',
      latest: '最近 20 局',
      win: '胜利',
      lose: '失败',
      draw: '流局',
      melds: '副露',
      minutes: '分钟',
      exported: '已导出',
      historyCode: 'HISTORY',
      button: '历史',
    },

    profilePanel: {
      title: '玩家画像',
      subtitle: '能力 / 风格 / 训练',
      loading: '正在分析你的游戏数据...',
      lowDataTitle: '数据不足',
      lowDataDetail: (count: number) => `当前仅有 ${count} 局记录，至少需要 3 局才能生成画像。`,
      refresh: '刷新',
      refreshing: '重新分析中...',
      refreshToast: '已刷新',
      errorTitle: '加载失败',
      errorDetail: '请稍后再试。',
      profile: '画像',
      skills: '能力',
      style: '风格',
      recommendations: '建议',
      currentLevels: '当前等级',
      nextSteps: '下一步',
      description: '描述',
      strengths: '优势',
      weaknesses: '短板',
      focus: '当前重点',
      improve: '提升方向',
      mistakes: '常见失误',
      overall: '综合',
      games: '对局',
      winRate: '胜率',
      dealIn: '放铳率',
      unknown: '未知',
      player: '玩家',
      button: '画像',
      rankBeginner: '初学者',
      rankIntermediate: '进阶玩家',
      rankAdvanced: '高级玩家',
      rankExpert: '专家',
      skillHandReading: '读牌能力',
      skillEfficiency: '牌效率',
      skillDefense: '防守意识',
      skillRiskManagement: '风险控制',
      skillTiming: '时机把握',
      skillAdaptation: '应变能力',
    },

    aiParamsPanel: {
      panelTitle: 'AI 参数',
      panelSubtitle: '训练 / 适应度 / 参数',
      reset: '重置',
      export: '导出',
      resetCode: 'RESET PARAMS',
      resetMessage: '将 AI 参数重置为默认值？',
      copied: '已复制',
      resetDone: '已重置',
      capability: '能力评分',
      currentScore: '当前得分',
      aiScore: 'AI 分数',
      trainingStats: '训练统计',
      currentRun: '当前运行',
      trainingSteps: '训练步数',
      bestFitness: '最佳适应度',
      acceptRate: '接受率',
      gamesPlayed: '对局数',
      aiWinRate: 'AI 胜率',
      paramList: '参数列表',
      readOnly: '只读',
      btnLabel: (cap: number) => `AI ${cap}/100`,
      na: 'N/A',
      catShantenStage: '向听与阶段',
      catRiskDefense: '风险与防守',
      catValueScore: '价值与得分',
      catMeldPenalties: '副露惩罚',
      catMultipliers: '倍率参数',
    },

    reviewPanel: {
      title: '对局复盘',
      subtitle: '评分 / 关键回合 / 改进建议',
      loading: '正在分析对局...',
      errorTitle: '分析生成失败',
      errorDetail: '请稍后重试。',
      keyMoments: '关键回合',
      items: '条目',
      improvements: '改进建议',
      nextGames: '下一局重点',
      actions: '行动项',
      summary: '总结',
      grade: '评级',
      score: '得分',
      dealIn: '放铳',
      melds: '副露',
      assessment: '评估',
      goodBad: '优势 / 短板',
      strengths: '优势',
      weaknesses: '短板',
      turn: '回合',
      yourAction: '你的操作',
      optimal: '最优操作',
      lesson: '教训',
      skills: '能力',
      efficiency: '效率',
      defense: '防守',
      timing: '时机',
      impactCritical: '致命',
      impactSignificant: '显著',
      impactMinor: '一般',
    },

    debug: {
      noMatchRunning: '暂无进行中的对局',
      current: '当前',
      turn: '回合',
      wall: '牌墙',
      discards: '弃牌',
      style: '风格',
      handTitle: 'P0 手牌（点击打牌）',
      responseToDiscard: (from: string) => `响应 ${from} 的弃牌`,
      recommendTop3: '推荐出牌 Top3',
      recommendLine: (discard: string, before: number, after: number, ukeire: number, risk: string) => `打 ${discard}：向听 ${before}->${after}，有效牌 ${ukeire}，风险 ${risk}`,
      tacticalExplain: 'AI 战术解释',
      phaseEarly: '早巡',
      phaseMid: '中巡',
      phaseLate: '后巡',
      stateSummary: (phase: string, wall: number, meldCount: number) => `${phase}，wall=${wall}，玩家碰杠=${meldCount} 组`,
      llmUnavailable: 'AI 解释暂不可用（未配置 LLM）。',
      llmUnavailableShort: 'AI 解释暂不可用',
      generating: '生成中…',
      eventLog: '事件日志',
    },

    gameLog: {
      title: '对局日志',
      copy: '复制',
      copyDone: '已复制',
      copyFailed: '复制失败',
      clear: '清空',
      clearTitle: '对局日志',
      clearMessage: '确认清空全部日志？',
      empty: '暂无日志，开始对局后会显示。',
    },
    
    about: {
      title: '关于',
      description: '成都麻将 - 血战到底',
      features: '特性',
      featureList: [
        '完整的成都麻将规则实现',
        '智能 AI 对手（基于期望值算法）',
        '阶段化决策系统（Stage A/B/C）',
        '详细的游戏日志和分析',
        '支持换三张和定缺',
        '血战到底模式',
      ],
      author: '作者',
      license: '许可证',
    },
  },
  
  en: {
    common: {
      back: 'Back',
      confirm: 'Confirm',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
    },
    
    home: {
      title: 'Chengdu Mahjong',
      subtitle: 'CHENGDU MAHJONG / PIXEL TABLE',
      copy: 'Blood battle mahjong on a flat pixel table. Start, configure, and replay.',
      replay: 'Replay',
      footer: 'V1.0 / OPEN SOURCE',
      newGame: 'New Game',
      settings: 'Settings',
      about: 'About',
      version: 'Version',
    },
    
    settings: {
      title: 'Settings',
      aiDifficulty: 'AI Difficulty: ',
      aiDifficultyValue: 'High (Maximum Intelligence)',
      rule: 'Rule: ',
      ruleChengdu: 'Chengdu Mahjong',
      rulePlaceholder: 'Placeholder',
      analysisEnabled: 'Analysis Mode: ',
      llmEnabled: 'LLM Mode: ',
      uiMode: 'UI Mode: ',
      uiModeDebug: 'Debug',
      uiModeTable: 'Table',
      timeoutEnabled: 'Timeout: ',
      timeoutMs: 'Timeout (ms): ',
      p0AIMode: 'P0 AI Mode (for testing): ',
      p0AIModeDesc: 'Enable AI control for P0',
      p0AIModeAlert: 'P0 AI mode enabled. Please start a new game to see full AI vs AI gameplay.',
      language: 'Language: ',
      languageChinese: '中文',
      languageEnglish: 'English',
      trainingMode: 'Training Mode: ',
      trainingGames: 'Training Games: ',
      trainingBlocking: 'Blocking Mode: ',
      trainingVerbose: 'Verbose Logging: ',
      startTraining: 'Start Training',
      stopTraining: 'Stop Training',
      trainingStatus: 'Training Status',
      trainingProgress: 'Progress',
      trainingBestFitness: 'Best Fitness',
      trainingCurrentFitness: 'Current Fitness',
      trainingAcceptRate: 'Accept Rate',
      displayTitle: 'Display & Readability',
      displaySubtitle: 'Pixel-flat control desk. All controls stay in one shell.',
      displaySubtitleShort: 'UI SCALE / SAFE ZONE',
      ruleSubtitle: 'RULE / UI / LANGUAGE / TIMEOUT',
      uiScale: 'UI Scale',
      hudSafeZone: 'HUD Safe Zone',
      trainingSubtitle: 'TRAINING / METRICS / CONTROL',
      trainingRangeError: 'Training games must be between 1 and 10000',
      trainingCompleted: 'Training completed',
      trainingFailed: (error: string) => `Training failed: ${error}`,
      trainingStopped: 'Training stopped',
      toolsTitle: 'Data & Analysis Tools',
      toolsSubtitle: 'HISTORY / PROFILE / AI PARAMS',
      toolsHistory: 'History',
      toolsProfile: 'Profile',
      toolsAIParams: 'AI Params',
    },
    
    game: {
      phaseExchange: 'Exchange',
      phaseDingQue: 'Choose Missing Suit',
      phasePlaying: 'Playing',
      phaseEnd: 'Game Over',
      
      player: 'Player',
      you: 'You',
      
      draw: 'Draw',
      discard: 'Discard',
      peng: 'Pong',
      gang: 'Kong',
      hu: 'Win',
      pass: 'Pass',
      exchangeSelect: 'Select Tiles',
      exchangeConfirm: 'Confirm Exchange',
      dingQue: 'Choose Missing',
      exchangeTitle: 'Exchange 3 Tiles',
      exchangeInstruction: 'Select 3 tiles of the same suit to exchange (clockwise)',
      exchangeSelected: (count: number) => `Selected: ${count}/3`,
      exchangeWaiting: 'Selection submitted. Waiting for other players...',
      dingTitle: 'Choose Missing Suit',
      dingInstruction: 'Select which suit you will not use to win (Chengdu rules)',
      dingSelected: (suitName: string) => `Selected missing suit: ${suitName}. Waiting for other players...`,
      dingHandTitle: 'Your Current Hand:',
      dingSuitCount: (wan: number, tiao: number, bing: number) => `Wan: ${wan} | Bamboo: ${tiao} | Dot: ${bing}`,
      dingSuitOption: (name: string, count: number) => `${name} (${count})`,
      
      wan: 'Wan',
      tiao: 'Tiao',
      bing: 'Bing',
      
      turn: 'Turn',
      wallRemaining: 'Wall Remaining',
      waiting: 'Waiting',
      thinking: 'Thinking',
      
      gameOver: 'Game Over',
      winner: 'Winner',
      drawResult: 'Draw',
      youWin: 'You Win!',
      youLose: 'You Lose',
      copyLog: 'Copy Log',
      newGame: 'New Game',
      backToHome: 'Back to Home',
      
      yakuPingHu: 'All Sequences',
      yakuDuiDuiHu: 'All Triplets',
      yakuQingYiSe: 'Pure One Suit',
      yakuQiDuiZi: 'Seven Pairs',
      yakuLongQiDui: 'Dragon Seven Pairs',
      yakuGangShangKaiHua: 'Kong Draw',
      yakuQiangGangHu: 'Robbing Kong',
      yakuHaiDiLaoYue: 'Last Tile',
      yakuTianHu: 'Heavenly Hand',
      yakuDiHu: 'Earthly Hand',
      yakuZiMo: 'Self Draw',
      yakuJinGouDiao: 'Single Wait',
      
      score: 'Score',
      fan: 'Fan',
      finalScore: 'Final Score',
      
      discards: 'Discards',
      yourDiscards: 'Your Discards',
      hand: 'Hand',
      tiles: 'tiles',
      melds: 'Melds',
      yourMelds: 'Your Melds',
      selfDrawWin: 'Self-Draw Win',
      copied: '✓ Copied',
      discardHint: 'Choose a tile to discard',
      noMatchRunning: 'No match running.',
      pengShort: 'P',
      gangShort: 'G',
      gangAn: 'Hidden Kong',
      gangJia: 'Added Kong',
      gangMing: 'Open Kong',
      tableLabel: 'Mahjong table',
    },

    replay: {
      title: 'Replay',
      subtitle: 'Pixel replay desk. Play the latest match in order.',
      eventLogTitle: 'Event Log',
      eventLogSubtitle: 'Latest Replay',
      play: 'Play',
      stop: 'Stop',
      noDataTitle: 'No replay available',
      noDataDetail: 'Export one from the match page first.',
    },

    historyPanel: {
      title: 'Game History',
      subtitle: 'STATS / RESULTS / REVIEW',
      loading: 'Loading game history...',
      emptyTitle: 'No game history',
      emptyDetail: 'Finish one match to save records.',
      export: 'Export',
      clear: 'Clear',
      clearTitle: 'Clear History',
      clearMessage: 'Clear all game history? This cannot be undone.',
      summary: 'Summary',
      aggregate: 'Aggregate',
      games: 'Games',
      winRate: 'Win Rate',
      bestStreak: 'Best Streak',
      avgScore: 'Avg Score',
      split: 'Result Split',
      splitSub: 'WIN / LOSE / DRAW',
      wins: 'Wins',
      losses: 'Losses',
      draws: 'Draws',
      recent: 'Recent Games',
      latest: 'Latest 20',
      win: 'Win',
      lose: 'Lose',
      draw: 'Draw',
      melds: 'Melds',
      minutes: 'min',
      exported: 'EXPORTED',
      historyCode: 'HISTORY',
      button: 'History',
    },

    profilePanel: {
      title: 'Player Profile',
      subtitle: 'SKILL / STYLE / LEARNING',
      loading: 'Analyzing your game data...',
      lowDataTitle: 'Not enough data',
      lowDataDetail: (count: number) => `Only ${count} games found. At least 3 are required.`,
      refresh: 'Refresh',
      refreshing: 'Refreshing analysis...',
      refreshToast: 'REFRESHED',
      errorTitle: 'Load failed',
      errorDetail: 'Please try again later.',
      profile: 'PROFILE',
      skills: 'SKILLS',
      style: 'STYLE',
      recommendations: 'RECOMMENDATIONS',
      currentLevels: 'CURRENT LEVELS',
      nextSteps: 'NEXT STEPS',
      description: 'DESCRIPTION',
      strengths: 'STRENGTHS',
      weaknesses: 'WEAKNESSES',
      focus: 'FOCUS',
      improve: 'IMPROVE',
      mistakes: 'MISTAKES',
      overall: 'Overall',
      games: 'Games',
      winRate: 'Win Rate',
      dealIn: 'Deal In',
      unknown: 'Unknown',
      player: 'Player',
      button: 'Profile',
      rankBeginner: 'Beginner',
      rankIntermediate: 'Intermediate',
      rankAdvanced: 'Advanced',
      rankExpert: 'Expert',
      skillHandReading: 'Hand Reading',
      skillEfficiency: 'Efficiency',
      skillDefense: 'Defense',
      skillRiskManagement: 'Risk Control',
      skillTiming: 'Timing',
      skillAdaptation: 'Adaptation',
    },

    aiParamsPanel: {
      panelTitle: 'AI Parameters',
      panelSubtitle: 'TRAINING / FITNESS / PARAMS',
      reset: 'Reset',
      export: 'Export',
      resetCode: 'RESET PARAMS',
      resetMessage: 'Reset all AI parameters to default values?',
      copied: 'COPIED',
      resetDone: 'RESET',
      capability: 'CAPABILITY',
      currentScore: 'CURRENT SCORE',
      aiScore: 'AI SCORE',
      trainingStats: 'TRAINING STATS',
      currentRun: 'CURRENT RUN',
      trainingSteps: 'Training Steps',
      bestFitness: 'Best Fitness',
      acceptRate: 'Accept Rate',
      gamesPlayed: 'Games Played',
      aiWinRate: 'AI Win Rate',
      paramList: 'PARAM LIST',
      readOnly: 'READ ONLY',
      btnLabel: (cap: number) => `AI ${cap}/100`,
      na: 'N/A',
      catShantenStage: 'Shanten & Stage',
      catRiskDefense: 'Risk & Defense',
      catValueScore: 'Value & Score',
      catMeldPenalties: 'Meld Penalties',
      catMultipliers: 'Multipliers',
    },

    reviewPanel: {
      title: 'Game Review',
      subtitle: 'SCORE / MOMENTS / IMPROVEMENT',
      loading: 'Analyzing match...',
      errorTitle: 'Review generation failed',
      errorDetail: 'Please try again later.',
      keyMoments: 'KEY MOMENTS',
      items: 'ITEMS',
      improvements: 'IMPROVEMENTS',
      nextGames: 'NEXT GAMES',
      actions: 'ACTIONS',
      summary: 'SUMMARY',
      grade: 'GRADE',
      score: 'SCORE',
      dealIn: 'DEAL IN',
      melds: 'MELDS',
      assessment: 'ASSESSMENT',
      goodBad: 'GOOD / BAD',
      strengths: 'STRENGTHS',
      weaknesses: 'WEAKNESSES',
      turn: 'TURN',
      yourAction: 'YOUR ACTION',
      optimal: 'OPTIMAL',
      lesson: 'LESSON',
      skills: 'SKILLS',
      efficiency: 'Efficiency',
      defense: 'Defense',
      timing: 'Timing',
      impactCritical: 'CRITICAL',
      impactSignificant: 'SIGNIFICANT',
      impactMinor: 'MINOR',
    },

    debug: {
      noMatchRunning: 'No match running.',
      current: 'Current',
      turn: 'Turn',
      wall: 'Wall',
      discards: 'Discards',
      style: 'Style',
      handTitle: 'P0 Hand (click to discard)',
      responseToDiscard: (from: string) => `Response to ${from} discard`,
      recommendTop3: 'Top 3 Discard Recommendations',
      recommendLine: (discard: string, before: number, after: number, ukeire: number, risk: string) => `Discard ${discard}: shanten ${before}->${after}, ukeire ${ukeire}, risk ${risk}`,
      tacticalExplain: 'AI Tactical Explanation',
      phaseEarly: 'Early',
      phaseMid: 'Mid',
      phaseLate: 'Late',
      stateSummary: (phase: string, wall: number, meldCount: number) => `${phase}, wall=${wall}, melds=${meldCount}`,
      llmUnavailable: 'AI explanation unavailable (LLM not configured).',
      llmUnavailableShort: 'AI explanation unavailable',
      generating: 'Generating…',
      eventLog: 'Event Log',
    },

    gameLog: {
      title: 'Game Log',
      copy: 'Copy',
      copyDone: 'Copied',
      copyFailed: 'Failed to copy logs',
      clear: 'Clear',
      clearTitle: 'Game Log',
      clearMessage: 'Clear all logs?',
      empty: 'No logs yet. Start a game to see logs.',
    },
    
    about: {
      title: 'About',
      description: 'Chengdu Mahjong - Blood Battle',
      features: 'Features',
      featureList: [
        'Complete Chengdu Mahjong rules',
        'Intelligent AI opponents (EV-based)',
        'Stage-aware decision system (A/B/C)',
        'Detailed game logs and analysis',
        'Exchange and missing suit selection',
        'Blood Battle mode',
      ],
      author: 'Author',
      license: 'License',
    },
  },
};
