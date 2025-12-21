# AI麻将 - LLM智能辅助系统设计文档

## 1. 系统概述

### 1.1 目标
为真人玩家(P0)提供基于大语言模型(LLM)的智能辅助功能，提升游戏体验、学习效率和娱乐性。

### 1.2 核心理念
- **非侵入式**: 辅助而非替代玩家决策
- **教育导向**: 帮助玩家理解麻将策略
- **个性化**: 根据玩家水平和风格定制建议
- **社交增强**: 增加游戏的趣味性和互动性

### 1.3 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端UI层                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │实时指导 │ │复盘面板 │ │用户画像 │ │聊天助手 │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼──────────┼──────────┼──────────┼───────────────────┘
        │          │          │          │
┌───────▼──────────▼──────────▼──────────▼───────────────────┐
│                    LLM服务层                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LLMService (核心服务)                   │   │
│  │  - promptBuilder: 构建结构化提示词                   │   │
│  │  - contextManager: 管理对话上下文                    │   │
│  │  - responseParser: 解析LLM响应                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    数据层                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │游戏状态  │ │历史记录  │ │用户画像  │ │学习进度  │       │
│  │GameState │ │GameHistory│ │UserProfile│ │Progress │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心功能模块

### 2.1 实时旁观指导 (Live Coaching)

#### 功能描述
在玩家回合时，LLM分析当前牌局并提供实时建议。

#### 实现细节

```typescript
interface CoachingAdvice {
  recommendedAction: Action;           // 推荐动作
  confidence: number;                  // 置信度 0-1
  reasoning: string;                   // 推理过程（自然语言）
  alternatives: Array<{               // 备选方案
    action: Action;
    pros: string[];
    cons: string[];
  }>;
  riskAssessment: {                   // 风险评估
    dealInRisk: 'low' | 'medium' | 'high';
    riskySuits: string[];
    safeDiscards: string[];
  };
  strategicHints: string[];           // 战略提示
}
```

#### Prompt设计

```
你是一位经验丰富的麻将教练，正在指导一位玩家。

【当前局面】
- 轮次: {turn}/68
- 玩家手牌: {hand}
- 已打出: {discards}
- 副露: {melds}
- 向听数: {shanten}
- 场上信息: {visibleTiles}

【对手情况】
- P1: 副露{melds1}, 打牌风格{style1}, 危险度{danger1}
- P2: 副露{melds2}, 打牌风格{style2}, 危险度{danger2}
- P3: 副露{melds3}, 打牌风格{style3}, 危险度{danger3}

【任务】
请分析当前局面，给出出牌建议。要求：
1. 推荐最佳出牌及理由
2. 分析放炮风险
3. 给出2-3个备选方案
4. 用通俗易懂的语言解释策略

请以JSON格式返回结果。
```

#### 显示模式
- **简洁模式**: 只显示推荐牌和一句话理由
- **详细模式**: 展开完整分析
- **教学模式**: 包含策略解释和学习要点

---

### 2.2 出牌记录复盘 (Game Review)

#### 功能描述
对完成的对局进行深度分析，找出关键转折点和改进建议。

#### 数据结构

```typescript
interface GameReview {
  gameId: string;
  timestamp: Date;
  result: 'win' | 'lose' | 'draw';
  
  // 关键时刻分析
  keyMoments: Array<{
    turn: number;
    situation: string;           // 局面描述
    playerAction: Action;        // 玩家实际操作
    optimalAction: Action;       // 最优操作
    impact: 'critical' | 'significant' | 'minor';
    analysis: string;            // LLM分析
    lesson: string;              // 学习要点
  }>;
  
  // 整体评价
  overallAssessment: {
    strengths: string[];         // 做得好的方面
    weaknesses: string[];        // 需要改进的方面
    score: number;               // 综合评分 0-100
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
  };
  
  // 数据统计
  statistics: {
    avgShanten: number;
    dealInCount: number;
    efficiency: number;          // 进攻效率
    defense: number;             // 防守评分
    timing: number;              // 时机把握
  };
  
  // 改进建议
  improvements: string[];
}
```

#### 复盘流程

```
1. 游戏结束 → 保存完整对局记录
2. 触发复盘 → 提取关键决策点
3. LLM分析 → 逐一评估每个决策
4. 生成报告 → 可视化展示 + 文字总结
5. 学习追踪 → 记录改进点到用户档案
```

---

### 2.3 用户历史记录系统 (History System)

#### 功能描述
永久保存用户所有对局记录，支持查询、统计和导出。

#### 存储结构

```typescript
interface UserGameHistory {
  version: string;
  userId: string;
  
  // 对局记录
  games: Array<{
    gameId: string;
    timestamp: Date;
    duration: number;            // 秒
    result: GameResult;
    score: number;
    
    // 完整对局数据
    replay: {
      initialHands: Hand[];
      events: GameEvent[];
      finalState: GameState;
    };
    
    // 简要统计
    stats: {
      winTurn: number | null;
      dealInCount: number;
      richiCount: number;
      meldCount: number;
      finalShanten: number;
    };
    
    // LLM生成的摘要（可选）
    summary?: string;
    keyMoments?: KeyMoment[];
  }>;
  
  // 聚合统计
  aggregateStats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgScore: number;
    bestStreak: number;
    currentStreak: number;
    
    // 按时间段统计
    byPeriod: {
      daily: Record<string, PeriodStats>;
      weekly: Record<string, PeriodStats>;
      monthly: Record<string, PeriodStats>;
    };
  };
}
```

#### 存储方案
- **本地存储**: IndexedDB (主存储) + LocalStorage (配置)
- **云端同步**: 可选的云端备份 (需用户授权)
- **导出格式**: JSON / CSV / 标准麻将记录格式

---

### 2.4 用户画像分析 (Player Profiling)

#### 功能描述
通过分析历史对局，构建玩家技术特点和风格画像。

#### 画像维度

```typescript
interface UserProfile {
  // 基础信息
  userId: string;
  nickname: string;
  createdAt: Date;
  lastActive: Date;
  
  // 技术水平评估
  skillLevel: {
    overall: number;             // 综合评分 0-100
    rank: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    
    // 细分技能
    skills: {
      handReading: number;       // 读牌能力
      efficiency: number;        // 牌效率
      defense: number;           // 防守意识
      riskManagement: number;    // 风险控制
      timing: number;            // 时机把握
      adaptation: number;        // 应变能力
    };
  };
  
  // 游戏风格
  playStyle: {
    // 主要风格标签
    primaryStyle: 'aggressive' | 'defensive' | 'balanced' | 'opportunistic';
    
    // 风格指标 (0-1)
    metrics: {
      aggression: number;        // 进攻倾向
      caution: number;           // 谨慎程度
      flexibility: number;       // 灵活性
      consistency: number;       // 稳定性
    };
    
    // 特点描述（LLM生成）
    description: string;
    strengths: string[];
    weaknesses: string[];
  };
  
  // 行为模式
  patterns: {
    preferredMelds: string[];    // 偏好的副露类型
    riskyTurns: number[];        // 容易冒险的轮次
    commonMistakes: string[];    // 常见失误
    improvementAreas: string[];  // 改进方向
  };
  
  // 学习进度
  learningProgress: {
    completedLessons: string[];
    masteredConcepts: string[];
    currentFocus: string;
    recommendations: string[];
  };
}
```

#### LLM画像生成Prompt

```
基于以下玩家的最近50局对局数据，生成详细的玩家画像分析：

【数据摘要】
- 胜率: {winRate}%
- 平均放炮次数: {avgDealIn}
- 平均向听数: {avgShanten}
- 副露频率: {meldFrequency}%
- 典型失误模式: {mistakePatterns}

【任务】
请分析该玩家的：
1. 技术水平等级和各项技能评分
2. 主要游戏风格（进攻型/防守型/平衡型）
3. 突出优点和主要弱点
4. 针对性的提升建议

请用专业但易懂的语言描述。
```

---

### 2.5 智能出牌指导 (Smart Guidance)

#### 功能描述
根据玩家水平提供个性化的出牌指导，从"给答案"逐步过渡到"引导思考"。

#### 指导等级

```typescript
enum GuidanceLevel {
  BEGINNER = 'beginner',       // 直接告诉最优解
  LEARNING = 'learning',       // 给出选项让玩家选择
  PRACTICING = 'practicing',   // 提示思考方向
  ADVANCED = 'advanced',       // 只在请求时给建议
}

interface SmartGuidance {
  level: GuidanceLevel;
  
  // 针对不同等级的输出
  content: {
    // 初学者：直接建议
    beginner?: {
      action: Action;
      simpleReason: string;      // 一句话解释
    };
    
    // 学习中：选项分析
    learning?: {
      options: Array<{
        action: Action;
        score: number;
        hint: string;
      }>;
      question: string;          // 引导问题
    };
    
    // 练习中：思考提示
    practicing?: {
      hints: string[];           // 思考方向提示
      keyFactors: string[];      // 关键考虑因素
    };
    
    // 进阶：仅在请求时
    advanced?: {
      available: boolean;
      requestPrompt: string;
    };
  };
}
```

---

## 3. 创新功能扩展

### 3.1 AI解说模式 (Commentary Mode)

#### 功能描述
像电竞解说一样，实时解说整场对局，增加观赏性。

```typescript
interface Commentary {
  type: 'excitement' | 'analysis' | 'prediction' | 'humor';
  text: string;
  emotion: 'excited' | 'tense' | 'surprised' | 'calm';
  timestamp: number;
}

// 解说风格可选
type CommentaryStyle = 
  | 'professional'    // 专业解说风格
  | 'casual'          // 轻松聊天风格
  | 'humorous'        // 幽默搞笑风格
  | 'educational';    // 教学解说风格
```

#### 示例输出
```
[专业风格] "P0选择切掉三万，保留了更好的进攻形态。
目前向听数为1，如果下一轮摸到二万或五万就能听牌了。"

[幽默风格] "哎呀，P3这是要搞事情啊！连续碰了两家的牌，
这阵仗，怕不是要来个大的？P0可得小心点了~"
```

---

### 3.2 对手行为预测 (Opponent Prediction)

#### 功能描述
分析对手出牌模式，预测其可能的手牌和意图。

```typescript
interface OpponentPrediction {
  playerId: PlayerId;
  
  // 手牌预测
  handPrediction: {
    likelyTiles: Tile[];         // 可能持有的牌
    confidence: number;
    reasoning: string;
  };
  
  // 意图预测
  intentPrediction: {
    isAiming: boolean;           // 是否在进攻
    likelyYaku: string[];        // 可能的役种
    dangerLevel: number;         // 危险度 0-10
    warningTiles: Tile[];        // 需要警惕的牌
  };
  
  // 行为分析
  behaviorAnalysis: {
    pattern: string;             // 打牌模式描述
    tendencies: string[];        // 行为倾向
    exploitableWeakness: string; // 可利用的弱点
  };
}
```

---

### 3.3 情景问答助手 (Q&A Assistant)

#### 功能描述
玩家可以随时向LLM提问麻将相关问题。

```typescript
interface QASession {
  // 支持的问题类型
  questionTypes: [
    'rule',           // 规则问题
    'strategy',       // 策略问题
    'terminology',    // 术语解释
    'situation',      // 情景分析
    'history',        // 历史对局问题
    'general',        // 一般问题
  ];
  
  // 问答记录
  history: Array<{
    question: string;
    answer: string;
    context?: GameState;    // 当时的游戏状态
    timestamp: Date;
  }>;
}
```

#### 示例对话
```
用户: "为什么这里不应该碰？"

助手: "好问题！让我解释一下：

当前你的手牌是 [1m2m3m 4p5p 7s8s9s 东东]，向听数为1。

如果碰了对方打出的东风：
❌ 副露后手牌变少，牌效率下降
❌ 暴露了做混一色的可能性
❌ 失去了自摸的机会

保持门清的好处：
✅ 保持更多进张选择
✅ 可能自摸多一番
✅ 不暴露手牌信息

所以这里建议忍住不碰，等待更好的机会！"
```

---

### 3.4 学习路径系统 (Learning Path)

#### 功能描述
根据用户水平定制学习计划，追踪进度。

```typescript
interface LearningPath {
  userId: string;
  currentLevel: SkillLevel;
  
  // 学习模块
  modules: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    
    // 学习内容
    lessons: Array<{
      id: string;
      title: string;
      type: 'theory' | 'quiz' | 'practice';
      content: string;          // LLM生成的教学内容
      completed: boolean;
      score?: number;
    }>;
    
    // 实战任务
    challenges: Array<{
      id: string;
      description: string;
      criteria: string;         // 完成条件
      progress: number;
      completed: boolean;
    }>;
  }>;
  
  // 成就系统
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt?: Date;
  }>;
}
```

#### 学习模块示例
```
📚 初级课程
├── 1. 基础规则入门
├── 2. 牌效率基础
├── 3. 防守入门
└── 4. 简单役种

📚 中级课程
├── 5. 进阶牌效
├── 6. 读牌技巧
├── 7. 副露判断
└── 8. 局势分析

📚 高级课程
├── 9. 复杂局面处理
├── 10. 心理博弈
├── 11. 高级防守
└── 12. 竞技策略
```

---

### 3.5 社交互动功能 (Social Features)

#### 3.5.1 战绩分享生成

```typescript
interface ShareableCard {
  type: 'game_result' | 'achievement' | 'milestone';
  
  // 生成分享卡片
  card: {
    title: string;
    subtitle: string;
    stats: Record<string, string>;
    highlight: string;          // LLM生成的亮点描述
    imageUrl: string;           // 生成的分享图
  };
  
  // 分享文案（LLM生成）
  shareText: string;
}
```

#### 3.5.2 好友对战分析

```typescript
interface FriendMatchAnalysis {
  matchHistory: Array<{
    date: Date;
    result: 'win' | 'lose';
    score: number;
  }>;
  
  // LLM生成的对战分析
  analysis: {
    overallRecord: string;      // "你与好友A的战绩为 15胜10负"
    yourAdvantages: string[];   // 你的优势
    friendAdvantages: string[]; // 对方优势
    suggestion: string;         // 下次对战建议
  };
}
```

---

### 3.6 语音交互 (Voice Interaction)

#### 功能描述
支持语音输入问题，语音播报建议。

```typescript
interface VoiceFeatures {
  // 语音输入
  speechToText: {
    enabled: boolean;
    language: 'zh-CN' | 'en-US' | 'ja-JP';
  };
  
  // 语音输出
  textToSpeech: {
    enabled: boolean;
    voice: string;              // 音色选择
    speed: number;              // 语速
    
    // 播报内容选择
    announcements: {
      turnStart: boolean;       // 轮次开始
      recommendation: boolean;  // 出牌建议
      warning: boolean;         // 危险警告
      gameEnd: boolean;         // 对局结束
    };
  };
}
```

---

### 3.7 心理辅导模式 (Mental Coaching)

#### 功能描述
在连败或情绪波动时提供心理支持。

```typescript
interface MentalCoaching {
  // 情绪检测
  emotionDetection: {
    currentMood: 'frustrated' | 'tilted' | 'confident' | 'calm' | 'anxious';
    indicators: string[];       // 检测依据
  };
  
  // 干预建议
  intervention: {
    message: string;            // 鼓励/提醒消息
    suggestion: string;         // 建议行动
    breakReminder?: boolean;    // 是否建议休息
  };
}
```

#### 示例输出
```
[检测到连续3局失利]

"嘿，看起来运气不太站在你这边。但我注意到你最近几局的
防守做得不错，只是进攻时机把握得不够好。

建议：
🎯 放慢节奏，不要急于求成
🛡️ 保持你擅长的防守
☕ 考虑休息5分钟再继续

记住：麻将是长期博弈，一时的输赢不代表什么！"
```

---

## 4. 技术实现

### 4.1 LLM服务接口

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  
  // 性能配置
  maxTokens: number;
  temperature: number;
  timeout: number;
  
  // 缓存配置
  cacheEnabled: boolean;
  cacheTTL: number;
}

class LLMService {
  // 核心方法
  async query(prompt: string, context?: any): Promise<string>;
  async streamQuery(prompt: string, onChunk: (chunk: string) => void): Promise<void>;
  
  // 专用方法
  async getCoachingAdvice(state: GameState): Promise<CoachingAdvice>;
  async generateReview(game: GameRecord): Promise<GameReview>;
  async analyzeProfile(history: GameHistory): Promise<UserProfile>;
  async answerQuestion(question: string, context?: any): Promise<string>;
  async generateCommentary(event: GameEvent): Promise<Commentary>;
}
```

### 4.2 数据存储方案

```typescript
// IndexedDB Schema
const DB_SCHEMA = {
  games: {
    keyPath: 'gameId',
    indexes: ['timestamp', 'result', 'score'],
  },
  profiles: {
    keyPath: 'userId',
    indexes: ['lastActive'],
  },
  reviews: {
    keyPath: 'reviewId',
    indexes: ['gameId', 'timestamp'],
  },
  qaHistory: {
    keyPath: 'id',
    indexes: ['timestamp'],
  },
};
```

### 4.3 性能优化

1. **提示词缓存**: 相似局面复用响应
2. **流式输出**: 长文本分段显示
3. **本地预处理**: 简单分析本地完成
4. **批量处理**: 复盘时批量分析

---

## 5. 用户界面设计

### 5.1 主界面集成

```
┌─────────────────────────────────────────────┐
│  [游戏区域]                                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           牌桌主界面                 │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🤖 AI助手建议                        │   │
│  │ 推荐: 打 3万 ⭐⭐⭐                  │   │
│  │ "保持进攻形态，避开危险牌"          │   │
│  │ [详细分析] [忽略] [设置]             │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.2 侧边面板

```
┌───────────────┐
│ 🎓 学习助手   │
├───────────────┤
│ 📊 我的数据   │
│  - 胜率 45%   │
│  - 段位 中级  │
├───────────────┤
│ 💬 问答       │
│ [输入问题...] │
├───────────────┤
│ 📝 历史记录   │
│ [查看全部]    │
├───────────────┤
│ ⚙️ 设置       │
└───────────────┘
```

---

## 6. 隐私与安全

### 6.1 数据隐私

- 本地优先存储，云端可选
- 敏感数据加密存储
- 用户可随时删除数据
- 不收集非必要信息

### 6.2 API安全

- API Key本地加密存储
- 支持用户自带Key
- 请求频率限制
- 敏感内容过滤

---

## 7. 开发计划

### Phase 1 - 基础功能 (2周)
- [ ] LLM服务核心接口
- [ ] 实时出牌建议
- [ ] 基础历史记录

### Phase 2 - 分析功能 (2周)
- [ ] 对局复盘系统
- [ ] 用户画像分析
- [ ] 智能指导等级

### Phase 3 - 高级功能 (2周)
- [ ] AI解说模式
- [ ] 对手预测
- [ ] 学习路径系统

### Phase 4 - 社交与优化 (1周)
- [ ] 分享功能
- [ ] 语音交互
- [ ] 性能优化

---

## 8. 文件结构

```
src/
├── llm/
│   ├── LLMService.ts           # LLM服务核心
│   ├── PromptBuilder.ts        # 提示词构建器
│   ├── ResponseParser.ts       # 响应解析器
│   └── providers/
│       ├── OpenAIProvider.ts
│       ├── AnthropicProvider.ts
│       └── LocalProvider.ts
├── features/
│   ├── coaching/
│   │   ├── LiveCoaching.ts     # 实时指导
│   │   └── SmartGuidance.ts    # 智能指导
│   ├── review/
│   │   ├── GameReview.ts       # 对局复盘
│   │   └── KeyMomentAnalysis.ts
│   ├── profile/
│   │   ├── UserProfile.ts      # 用户画像
│   │   └── ProfileAnalyzer.ts
│   ├── history/
│   │   ├── GameHistory.ts      # 历史记录
│   │   └── HistoryStorage.ts
│   ├── social/
│   │   ├── ShareCard.ts        # 分享卡片
│   │   └── FriendMatch.ts
│   └── learning/
│       ├── LearningPath.ts     # 学习路径
│       └── Achievement.ts      # 成就系统
├── ui/
│   ├── components/
│   │   ├── CoachingPanel.tsx
│   │   ├── ReviewPanel.tsx
│   │   ├── ProfilePanel.tsx
│   │   └── ChatAssistant.tsx
│   └── hooks/
│       ├── useLLM.ts
│       └── useCoaching.ts
└── storage/
    ├── IndexedDBStorage.ts
    └── CloudSync.ts
```

---

## 9. 总结

本设计文档规划了一套完整的LLM智能辅助系统，涵盖：

| 功能类别 | 具体功能 |
|---------|---------|
| **实时辅助** | 出牌建议、风险评估、对手预测 |
| **学习成长** | 对局复盘、用户画像、学习路径 |
| **数据管理** | 历史记录、统计分析、进度追踪 |
| **社交娱乐** | AI解说、战绩分享、问答助手 |
| **心理支持** | 情绪检测、心理辅导、休息提醒 |

通过这套系统，玩家将获得：
- 🎯 个性化的游戏指导
- 📈 持续的技术提升
- 🎮 更丰富的游戏体验
- 🤝 更好的社交互动
