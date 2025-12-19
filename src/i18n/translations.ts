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
    yakuGangShangKaiHua: string;
    yakuQiangGangHu: string;
    yakuHaiDiLaoYue: string;
    yakuTianHu: string;
    yakuZiMo: string;
    yakuMenQing: string;
    yakuJinGouDiao: string;
    
    // 其他
    score: string;
    fan: string;
    finalScore: string;
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
      yakuGangShangKaiHua: '杠上开花',
      yakuQiangGangHu: '抢杠胡',
      yakuHaiDiLaoYue: '海底捞月',
      yakuTianHu: '天胡',
      yakuZiMo: '自摸',
      yakuMenQing: '门清',
      yakuJinGouDiao: '金钩钓',
      
      score: '得分',
      fan: '番',
      finalScore: '最终得分',
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
      yakuGangShangKaiHua: 'Kong Draw',
      yakuQiangGangHu: 'Robbing Kong',
      yakuHaiDiLaoYue: 'Last Tile',
      yakuTianHu: 'Heavenly Hand',
      yakuZiMo: 'Self Draw',
      yakuMenQing: 'Fully Concealed',
      yakuJinGouDiao: 'Single Wait',
      
      score: 'Score',
      fan: 'Fan',
      finalScore: 'Final Score',
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
