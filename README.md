# mahjong-valdi

## 初始化方式

本项目使用 **Vite（vanilla + TypeScript）** 初始化。

- 你也可以用替代方案：
  - `npm init` + 手动配置 `vite` / `tsconfig` / `vitest`
  - 或 `ts-node` / `http-server` 做更轻的原型

## 安装与运行

- `npm install`
- `npm run dev`
- `npm run test`
- `npm run build`
- `npm run preview`

运行后浏览器打开：

- `http://localhost:5173/`

## UI 模式

本项目支持两种 UI 模式，可在 Settings 页面或 Match 页面顶部快速切换：

### Debug 模式
- **面向开发/调试**
- 显示详细的事件日志、手牌分析、推荐出牌
- 左右分栏布局：左侧手牌+分析，右侧事件日志
- 适合理解 AI 决策过程和调试规则

### Table 模式（默认）
- **面向玩家体验**
- 模拟真实麻将桌布局：四家位置、弃牌网格、中央状态
- 顶部 P2（对家）、左侧 P3（上家）、右侧 P1（下家）、底部 P0（自己）
- 每个玩家显示手牌数量和弃牌区
- 当前轮到的玩家高亮显示
- 底部显示 P0 手牌，可点击出牌
- 右下角显示最近 20 条事件日志

**切换方式**：
1. Settings 页面 → UI Mode 下拉框
2. Match 页面顶部 → "Switch to Debug/Table" 按钮

## LLM 配置（可选）

项目支持 LLM 提供战术解释和教学建议。配置步骤：

1. **复制环境变量模板**：
   ```bash
   cp .env.example .env.local
   ```

2. **编辑 `.env.local`**，填入你的 LLM 配置：
   ```bash
   VITE_LLM_PROVIDER=openai
   VITE_LLM_BASE_URL=https://api.openai.com/v1
   VITE_LLM_API_KEY=sk-your-api-key-here
   VITE_LLM_MODEL=gpt-4o-mini
   VITE_LLM_TIMEOUT_MS=12000
   ```

3. **启用 LLM**：
   - Settings 页面 → 勾选 "LLM Enabled"
   - Match 页面 → 展开 "AI 战术解释" 查看 LLM 生成的建议

**安全提醒**：
- `.env.local` 仅用于开发环境，不会被提交到版本控制
- **生产环境请使用后端代理**，避免在前端暴露 API Key
- 当前实现直接在浏览器调用 LLM API，仅适合本地开发测试

## 架构说明（Rule-First）

- **RulePack 是第一公民**：
  - Core Engine（对局推进）不写死麻将规则。
  - 牌墙/发牌/回合顺序/合法动作/动作应用全部由 `RulePack` 决定。
- `GameOrchestrator` 只做：
  - 读取当前行动者（`getCurrentActor`）
  - 获取合法动作（`getLegalActions`）
  - 让 Agent 选择动作
  - 调用 `applyAction` 得到新状态
  - 记录事件流 `GameEvent`

### EventLog / Replay

- 对局全过程会记录 `GameEvent[]`（INIT/DRAW/DISCARD/PENG/GANG/HU/TURN/END）。
- Match 页可导出 Replay 到内存存储（`src/persistence/storage.ts`）。
- Replay 页可按 300ms 间隔逐条播放事件（文本）。

## placeholder 规则包说明

位置：`src/core/rules/packs/placeholder`

特性：

- 不碰、不杠、不胡、不计分
- 仅做 4 人轮转：

位置：`src/core/rules/packs/chengdu`

### 核心功能

**1. 响应窗口机制**
- 出牌后，其他玩家可响应：PASS / PENG / GANG / HU
- 优先级：HU > GANG > PENG > PASS
- 支持多家同时胡牌

**2. 杠牌类型与补牌**
- **明杠（MING）**：响应他人出牌，手牌有 3 张，杠后从牌墙摸一张
- **暗杠（AN）**：自己摸到 4 张相同牌，杠后从牌墙摸一张
- **加杠（JIA）**：碰后再摸到第 4 张，升级为杠，杠后从牌墙摸一张
- **杠后摸牌**：所有杠牌后自动从牌墙补一张牌
- **抢杠胡响应窗口**：加杠时其他玩家可以抢杠胡

**3. 胡牌判定**
- **点炮胡**：响应他人出牌
- **自摸胡**：自己摸牌胡
- **杠上开花**：杠后摸牌立即胡牌（自动检测）
- **抢杠胡**：抢他人加杠的牌胡牌（自动检测）
- **和牌型判断**：
  - 4 组面子（顺子/刻子）+ 1 对将
  - 七对子（特殊牌型）

**4. 番型系统**（`patterns.ts`）

支持的番型：
- **平胡**（1番）：基础胡牌
- **自摸**（1番）：自己摸牌胡
- **门清**（1番）：无副露
- **对对胡**（2番）：全刻子
- **全带幺**（2番）：每组都有幺九
- **杠上开花**（2番）：杠后摸牌胡
- **抢杠胡**（2番）：抢他人加杠
- **海底捞月**（2番）：最后一张牌胡
- **七对子**（4番）：7 对牌
- **清一色**（6番）：单一花色

**5. 计分系统**（`patterns.ts`）

基于番数计算得分：
- 1-2 番：500-1000 分
- 3-4 番：1500-2000 分
- 6-8 番：3000-4000 分
- 11+ 番：6000-8000 分

**6. 游戏结束判定**
- 所有玩家胡牌
- 牌墙为空（流局）

### 模块化设计

```bash
src/core/rules/packs/chengdu/
├── index.ts           # 主规则包实现
├── patterns.ts        # 番型判断与计分系统
├── utils.ts           # 工具函数（牌操作、状态判断）
└── rule.config.ts     # 配置文件
```

**设计原则**：
- **抽象隔离**：番型判断、工具函数独立模块
- **类型安全**：完整的 TypeScript 类型定义
- **可扩展性**：新增番型只需修改 `patterns.ts`
- **可测试性**：纯函数设计，易于单元测试

### 与 placeholder 的区别

| 功能 | placeholder | chengdu |
|------|-------------|---------|
| 碰牌 | ❌ | ✅ |
| 杠牌 | ❌ | ✅（明/暗/加） |
| 胡牌 | ❌ | ✅（点炮/自摸） |
| 番型判断 | ❌ | ✅（10+ 种） |
| 计分系统 | ❌ | ✅ |
| 多家胡牌 | ❌ | ✅ |

### 使用示例

```typescript
import { chengduRulePack } from './core/rules/packs/chengdu';

// 初始化游戏
const state = chengduRulePack.buildInitialState();

// 获取合法动作
const actions = chengduRulePack.getLegalActions(state, 'P0');
// 可能返回：[DRAW, DISCARD, PENG, GANG, HU, PASS]

// 应用动作
const nextState = chengduRulePack.applyAction(state, action);

// 解析响应
const result = chengduRulePack.resolveReactions(state, reactions);
// 返回新状态和事件列表（包含番型、得分信息）
```

### 扩展新规则包的建议

基于 chengdu 的模块化设计，新增规则包时：

1. **继承基础功能**：`...placeholderRulePack` 或 `...chengduRulePack`
2. **独立模块**：将番型、计分等逻辑放在独立文件
3. **类型扩展**：在 `Action`/`GameEvent` 中添加新字段
4. **工具复用**：共享 `utils.ts` 中的通用函数
5. **测试覆盖**：为新功能编写单元测试
  - `resolveReactions` 负责优先级裁决与状态更新

## 新增 RulePack 示例

1. 在 `src/core/rules/packs/<your_pack>/` 下创建：
   - `rule.config.ts`
   - `index.ts`（导出实现 `RulePack` 接口的对象）
2. 在 Orchestrator 的 RuleRegistry 中注册（当前在 `GameOrchestrator` 内部注册 placeholder/chengdu）：

示例模板：

```ts
import type { RulePack } from '../../RulePack';
import { ruleConfig } from './rule.config';

export const yourRulePack: RulePack = {
  id: ruleConfig.id,
  version: ruleConfig.version,
  getTileSet() { /* ... */ },
  buildInitialState() { /* ... */ },
  getCurrentActor(state) { /* ... */ },
  getLegalActions(state, playerId) { /* ... */ },
  applyAction(state, action) { /* pure */ },
  isRoundEnd(state) { /* ... */ },
  settleRound(state) { /* ... */ },
};
```

## 新增 AlgoBot 示例

- 在 `src/agents/algo/` 下增加一个策略文件（例如 `policy_super.ts`）
- 签名建议与现有策略一致：

```ts
import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { PlayerId } from '../../core/model/types';

export function decideSuper(state: GameState, playerId: PlayerId, legal: Action[]): Action {
  return legal[0];
}
```

- 在 `src/agents/algo/difficulty.ts` 中把 difficulty 映射到你的策略。

## 单元测试

- `npm run test`
- `npm run test:run`

测试覆盖 placeholder RulePack 的最小行为：

- 初始化每人 13 张
- `DRAW` 后 14 张
- `DISCARD` 后 13 张且轮转玩家
- `applyAction` 纯函数性（不修改输入）

## Shanten / Ukeire（第二阶段）

本项目新增了“普通型（4 面子 + 1 将）”的向听数与有效牌（进张）计算：

- **向听数（Normal Shanten）**：仅考虑顺子/刻子/对子/搭子，目标为 4 面子 + 1 将。
- **有效牌（Ukeire）**：对 13 张手牌，枚举摸入 27 种数牌后向听下降的牌型，并估算总进张数。

### 当前限制

- 仅数牌：花色 W/B/T，点数 1..9
- 不做七对、国士无双
- 仍仅实现普通型（4 面子 + 1 将）

## 第三阶段：副露（碰/杠）与响应窗口

### 副露如何影响向听

- `melds[playerId].length` 视为“已完成面子数（副露面子数）”。
- 向听计算使用 `shantenWithMelds(hand, meldCount)`：
  - `shanten = 8 - 2*(m + meldCount) - t - p`
  - `meldCount >= 4` 时：
    - 若手牌存在任意对子（将）则视为和牌 `shanten = -1`
    - 否则 `shanten = 0`

### 成都麻将响应窗口与裁决

- 出牌后进入 `lastDiscard` 响应窗口。
- `GameOrchestrator` 只做：
  - 让所有可响应玩家（含 P0 人类、AI）各自基于 legal actions 决定一个动作
  - 把 reactions 数组交给 `RulePack.resolveReactions`
- 裁决/状态变更在 RulePack 内：
  - 多人 HU：全部记录 `declaredHu[playerId]=true`
  - PENG/GANG：移除手牌对应张数并写入 `melds`，并将 `currentPlayer` 切到该玩家

### Mid / High 在“碰不碰”上的差异

- Mid：仅当碰/杠后向听下降才会执行，否则倾向 PASS。
- High：向听下降必碰/杠；向听相等时也允许碰/杠（更激进，更快定型）。

## 第四阶段：风险模型（Danger Model）与风险-效率权衡

本项目新增了一个“近似放铳风险”评估模型：它不是精确概率，但**可比较、可解释、稳定、确定性**。

### 风险模型设计思想（非精确概率）

位置：`src/agents/algo/danger.ts`

- 输出 `score`（连续值，越大越危险）与 `level`（LOW/MEDIUM/HIGH）以及 `reasons`（解释原因）。
- 最小因素（累计）：
  - 生熟张：该牌在全局弃牌中出现越少越危险
  - 临近张危险：同花色 ±1/±2 未见越多越危险
  - 对手副露：对手碰/杠过该花色则上调
  - 局况阶段：`wall.length` 越少，整体风险系数越高
  - 自身副露：自身副露越多视为更进攻，风险容忍度更高（小幅降分）

### Mid / High 在风险权衡上的差异

- Mid：综合评分 `total = efficiency - dangerWeight * dangerScore`，`dangerWeight` 固定为中等。
- High：`dangerWeight` 随局况动态变化：越后巡越重视风险。
  - 且当最优效率牌风险为 HIGH、而更安全牌效率差距不大时，会主动选择更安全的牌。

### LLM 在系统中的角色（解释而非决策）

- LLM **只用于“讲人话的战术解释/总结”**，不参与出牌决策。
- LLM 输入为结构化特征（向听变化/进张/风险等级与原因/局况），不直接传入原始牌数组。
- 任意 LLM 超时/报错：UI 显示“AI 解释暂不可用”，**不会影响对局推进与 AI 出牌**。

## 第五阶段：局面风格识别（Style）与复盘数据（Statistics）

在“风险-效率”之上，本项目引入了**打法风格**概念，让 AI 能根据局面切换取舍。

### 局面风格（Game Style）

位置：`src/agents/algo/style.ts`

风格：

- `AGGRESSIVE`：进攻
- `BALANCED`：均衡
- `DEFENSIVE`：防守
- `STALLING`：拖局

风格识别使用**确定性规则**（不使用 LLM、不训练、不搜索），主要信号：

- 进攻信号：向听较低 / 有效牌较多 / 自身副露
- 防守信号：对手已胡 / 后巡 / 手牌高风险张占比偏高
- 拖局信号：向听较高 + 对手威胁较大 + 自身可弃的低风险张较多

### 风格驱动的策略权重

Mid/High 统一使用：

`totalScore = efficiencyWeight * efficiencyScore - dangerWeight * dangerScore`

不同风格对应不同权重（越防守越重视风险），并且在 `DEFENSIVE/STALLING` 下会强力避免选择 `HIGH` 风险弃牌（只要有替代）。

### 风格驱动的教学解释

教学面板会显示：

- 当前处于哪种风格
- 触发该风格的原因
- 因为风格原因而做出的取舍（例如：防守态不建议追效率）

### 长期统计与自我评估（不做学习）

位置：`src/analysis/statistics.ts`

- 每次 AI 出牌会记录：巡目、当时风格、弃牌、向听变化、风险等级
- 对局结束会生成 `MatchStat`

这些数据用于后续：

- 回放分析
- 比较不同权重策略的效果
- 为未来的“自动调参/学习”提供数据基础（本阶段不做学习）

### LLM：风格级复盘总结（仍不参与决策）

`LLMAnalyzer` 扩展了 `summarizeMatch(stat)`：

- 输入：本局 `MatchStat`
- 输出：风格级总结（不逐步解释每一步）
- 失败不影响对局

相比更精确的概率，本项目强调“风格切换”因为：

- 可解释：玩家能理解为什么要从进攻转防守
- 可控：规则可调、可测、可复现
- 可复盘：统计数据能支撑策略比较

### AlgoBot 如何利用它

- **Mid**：14 张出牌时优先
  - 打后向听更小
  - 若相同，则有效牌总数更大
- **High**：在 Mid 基础上加入 tie-break
  - 更倾向保留对子/重复牌（对子种类更多）

---

## 🎯 Stage 6：对手画像与针对性策略

### 为什么需要对手画像

真实麻将中，同样的手牌面对不同对手应采取不同策略：

- 对手是激进型副露玩家 → 更早进入防守
- 对手已多次副露且后巡 → 疑似听牌，避免打危险张
- 对手保守打熟张 → 可能已听牌，需要更谨慎

### 对手画像模型（OpponentPersona）

为每个对手维护实时画像，包含：

- **aggression**（激进程度 0..1）：副露多、打生张 → 更激进
- **defense**（防守程度 0..1）：后巡打熟张、边张 → 更防守
- **meldRate**（副露倾向 0..1）：副露次数占总回合比例
- **efficiencyBias**（效率倾向 0..1）：弃牌偏向孤张/边张 → 追效率
- **riskTolerance**（风险承受度 0..1）：打高危险张频率

画像更新采用 **指数滑动平均（EMA）**：

```
x = x * 0.9 + newSignal * 0.1
```

确保画像平滑演化且对近期行为更敏感。

### 对手威胁估计（OpponentThreat）

威胁评分综合考虑：

- **副露数量**：越多威胁越高
- **游戏阶段**：后巡威胁更高
- **向听估计**：听牌或一向听威胁最高
- **最近弃牌**：频繁打熟张 → 疑似听牌
- **画像激进度**：激进型玩家威胁更高

输出：

- **threatScore**（0..1 连续值）
- **threatLevel**（LOW/MEDIUM/HIGH 分段）
- **reasons**（威胁原因列表）

### High 策略：针对最危险对手

评分公式扩展为：

```
totalScore = efficiencyWeight * efficiencyScore
           - dangerWeight * dangerScore
           - threatPenalty
```

其中：

```
threatPenalty = dangerScore * topThreat.threatScore * threatWeight
```

- `threatWeight`：HIGH=1.5, MEDIUM=0.8, LOW=0.3
- 对最危险对手的危险张施加额外惩罚
- 确保 threat=LOW vs HIGH 下决策明显不同

### 设计取舍：为什么用规则 + EMA

**不用学习/训练**：

- 保持确定性、可解释、可测试
- 避免过拟合和训练数据需求

**用 EMA 而非固定值**：

- 画像随对局演化，反映对手当前状态
- 平滑更新避免噪声干扰
- 简单高效，无需复杂模型

**用规则而非 LLM**：

- LLM 只解释，不参与画像判断
- 规则可调参、可回放、可验证
- 保证实时性能

---

## 🎓 Stage 7：多局管理与元策略（教练层）

### 为什么需要多局管理

真实麻将中，优秀选手会从多盘对局中总结经验：

- 发现自己是否过于激进导致频繁失败
- 发现自己是否过于保守导致频繁流局
- 识别特定对手的针对性打法
- 动态调整策略权重以适应对局环境

### 概念层次

**Round**（单局）：
- 一盘麻将，从发牌到胡牌/流局
- 已有的 `MatchStat` 记录单局决策

**Match/Set**（多局）：
- 连续 N 盘 Round（如 4/8/16 盘）
- 新增 `MatchManager` 管理多局统计

**Meta Strategy**（元策略）：
- 基于多局结果动态调整策略参数
- 不改变决策逻辑，只调整权重

### 元策略参数（StrategyParams）

三个核心参数（乘数，默认 1.0）：

- **efficiencyWeight**：效率权重乘数
- **dangerWeight**：危险权重乘数
- **threatWeight**：威胁权重乘数

**参数如何使用**：

```typescript
// 策略层最终权重 = 基础权重 × Meta 乘数
const efficiencyWeight = baseWeights.efficiencyWeight * metaParams.efficiencyWeight;
const dangerWeight = baseWeights.dangerWeight * metaParams.dangerWeight;
const threatWeight = baseThreatWeight * metaParams.threatWeight;
```

### 元策略调整规则（确定性）

#### 1️⃣ 过度进攻惩罚

**触发条件**：
- 最近 5 盘中高风险弃牌占比 > 30%
- 且失败率 > 50%

**调整动作**：
- `dangerWeight += 0.3`
- 原因：过度进攻导致失败，增加危险惩罚

#### 2️⃣ 过度保守惩罚

**触发条件**：
- 最近 5 盘中流局率 > 60%
- 且向听进展缓慢（平均 < 0.05）

**调整动作**：
- `efficiencyWeight += 0.25`
- 原因：过度保守导致流局，增加效率追求

#### 3️⃣ 对手针对修正

**触发条件**：
- 最近 5 盘中同一对手成为最大威胁占比 > 60%

**调整动作**：
- `threatWeight += 0.2`
- 原因：特定对手频繁威胁，增加针对性防守

**参数边界**：
- 所有参数限制在 [0.1, 3.0] 范围内
- 避免极端值导致策略失衡

### Match Report（自动复盘报告）

每场 Match 结束后自动生成：

**统计摘要**：
- 总盘数、胜率、失败率、流局率
- 平均风险值、主要风格分布
- 最危险对手识别

**关键发现**：
- 胜率过低/过高提示
- 风险倾向分析
- 流局率异常警告
- 对手威胁频率

**参数调整历史**：
- 每次调整的参数名、变化量、原因
- 时间戳记录调整时机

### LLM 教练级总结

基于 `MatchReport` 结构化数据，LLM 输出自然语言总结：

**输入**（只读）：
- 多盘统计数据（胜率、风格、风险）
- 关键发现列表
- 参数调整记录

**输出示例**：

> 本场 8 盘对局整体偏向进攻，胜率 37.5%，失败率 50%。
> 主要问题是高风险弃牌过多（平均风险 0.58），导致频繁点炮。
> 系统已在第 4 盘后提高危险权重（dangerWeight +0.3），后续决策明显更保守。
> 建议：面对 P2 时应更早进入防守态，该对手在 6 盘中 5 次成为最大威胁。
> 整体策略调整及时有效，后 4 盘失败率降至 25%。

**关键约束**：
- LLM 不参与任何决策或参数计算
- 只基于结构化数据生成解释
- 失败不影响系统运行

### 设计哲学：为什么是"教练层"而非"学习"

**不是强化学习**：
- 无神经网络训练
- 无梯度下降/策略梯度
- 无探索/利用权衡

**是确定性规则调参**：
- 规则明确：IF 条件 THEN 调整
- 可解释：每次调整都有原因
- 可回滚：参数变化可追溯
- 可复现：同样输入 → 同样输出

**类比人类教练**：
- 观察多盘表现 → `MatchSummary`
- 识别问题模式 → 触发条件
- 给出调整建议 → `MetaAdjustment`
- 验证调整效果 → 后续盘统计

这是 **元认知层**，不是黑箱 AI。

---

## 🎓 Stage 8：人类玩家画像与个性化教学

### 为什么需要人类玩家画像

教 AI 和教人是完全不同的问题：

- **AI 优化目标明确**：最大化胜率、最小化风险
- **人类学习有个体差异**：新手需要鼓励、高手需要挑战
- **错误模式因人而异**：激进型玩家 vs 保守型玩家的问题不同
- **教学语言需要适配**：同样的建议，表达方式影响接受度

### 人类玩家画像（HumanPersona）

为 P0（人类玩家）建立长期画像，基于真实决策更新：

**五个维度**（0..1，EMA 更新）：

- **riskTolerance**（风险承受度）：多次选择高危险张 → 上升
- **efficiencyBias**（效率倾向）：追求向听进展 → 上升
- **defenseAwareness**（防守意识）：后巡打熟张、避险 → 上升
- **playStyle**（打法风格）：AGGRESSIVE / DEFENSIVE / BALANCED / ERRATIC
- **learningStage**（学习阶段）：BEGINNER / INTERMEDIATE / ADVANCED

**画像更新规则**（确定性）：

```typescript
// 高风险决策 → riskTolerance ↑
if (dangerLevel === 'HIGH') {
  riskTolerance = riskTolerance * 0.85 + 1.0 * 0.15;
}

// 防守型低风险 → defenseAwareness ↑
if (style === 'DEFENSIVE' && dangerLevel === 'LOW') {
  defenseAwareness = defenseAwareness * 0.85 + 1.0 * 0.15;
}

// 向听进展 → efficiencyBias ↑
if (shantenBefore - shantenAfter > 0) {
  efficiencyBias = efficiencyBias * 0.85 + 1.0 * 0.15;
}
```

**风格判定**：
- AGGRESSIVE：riskTolerance > 0.65 && efficiencyBias > 0.6
- DEFENSIVE：riskTolerance < 0.35 && defenseAwareness > 0.6
- ERRATIC：风格切换频率 > 40%
- BALANCED：其他情况

**学习阶段判定**：
- BEGINNER：高风险比例 > 70% && 防守意识 < 40%
- ADVANCED：防守意识 > 60% && 风险适中（30%-70%）
- INTERMEDIATE：其他情况

### 错误模式自动发现（Mistake Patterns）

基于决策序列检测重复出现的错误模式：

#### 1️⃣ 贪效率型错误（greedy-efficiency）

**特征**：在高风险情况下仍追求效率最优

```typescript
if (dangerLevel === 'HIGH' && shantenBefore - shantenAfter > 0) {
  // 计入贪效率错误
}
```

**触发阈值**：频率 > 25%

#### 2️⃣ 后巡不防守（late-game-no-defense）

**特征**：后巡阶段（turn > 10）仍频繁打危险张

**触发阈值**：后巡危险张比例 > 40%

#### 3️⃣ 过早副露（early-meld）

**特征**：向听数 ≥ 3 时频繁副露

**触发阈值**：频率 > 20%

#### 4️⃣ 风格摇摆（style-swing）

**特征**：同局中 AGGRESSIVE ↔ DEFENSIVE 频繁切换

**触发阈值**：显著切换频率 > 30%

### 个性化教学策略（Pedagogy）

根据玩家画像和错误模式生成教学计划：

**教学语气（TeachingTone）**：

| 学习阶段 | 语气 | 特点 |
|---------|------|------|
| BEGINNER | ENCOURAGING | 鼓励但明确，避免打击信心 |
| INTERMEDIATE | CAUTIOUS | 谨慎且详细，强调细节 |
| ADVANCED | CHALLENGING | 挑战性且深入，探讨高阶取舍 |

**教学重点（FocusPoints）**：

- BEGINNER：≤ 2 个重点，避免信息过载
- INTERMEDIATE：3 个重点，聚焦高频错误
- ADVANCED：≤ 4 个重点，包含高阶策略

**针对性建议示例**：

| 错误模式 | BEGINNER | INTERMEDIATE | ADVANCED |
|---------|----------|--------------|----------|
| 贪效率型 | "高效率不等于好决策，安全第一" | "在高风险情况下，应权衡效率与安全性" | "效率与风险的平衡是高阶技巧，需要根据局势动态调整" |
| 后巡不防守 | "后巡（10 巡后）应优先选择熟张" | "后巡阶段防守意识需要加强，避免打生张" | "后巡防守需要结合对手听牌推断，不仅仅是打熟张" |

### LLM 个性化教学语言

基于画像和教学计划生成自然语言建议：

**输入**（只读结构化数据）：
- 玩家画像标签（风格、学习阶段、各维度数值）
- 错误模式描述（ID、频率、示例回合）
- 教学策略（语气、重点、是否避免过载）

**输出示例**（BEGINNER + ENCOURAGING）：

> 你的打法偏向激进，这很好，说明你有进攻意识！
> 不过目前有两个小问题需要注意：
> 
> 1. **后巡防守**：10 巡之后，尽量打熟张（别人已经打过的牌），这样更安全。
> 2. **风险控制**：高效率的牌不一定是好牌，如果很危险，宁可慢一点也要保证安全。
> 
> 先从这两点开始改进，慢慢来，你会越来越强的！

**输出示例**（ADVANCED + CHALLENGING）：

> 你的整体水平已经很高，防守意识也不错。
> 但在效率与风险的权衡上还有提升空间：
> 
> 后巡防守不应仅仅是"打熟张"，而是要结合：
> - 对手的副露情况（推断听牌范围）
> - 自己的手牌价值（是否值得冒险）
> - 当前局势（领先/落后/平局）
> 
> 建议：在后巡阶段，先快速评估对手威胁等级，再决定是保守打熟张还是适度冒险追效率。
> 这是高阶玩家的必备技能。

**关键约束**：
- LLM 不参与任何决策或画像判断
- 只负责"表达方式"，不负责"对错判断"
- 失败不影响系统运行

### 设计哲学：为什么"教人"和"教 AI"不同

**教 AI（Meta Strategy）**：
- 目标：优化参数，提高胜率
- 方法：确定性规则调参
- 反馈：统计数据（胜率、风险）

**教人（Human Persona）**：
- 目标：帮助玩家理解和改进
- 方法：个性化建议 + 适配语气
- 反馈：学习曲线、错误模式变化

**核心差异**：
- AI 不需要"鼓励"，人需要
- AI 可以处理复杂公式，人需要简化
- AI 追求最优解，人需要渐进式改进

这是 **教学层**，不是训练层。

---

## 🌐 Stage 9：群体分析与教学优化

### 为什么需要群体分析

单个玩家画像只能解决"因材施教"问题，但无法回答：

- **哪些错误是普遍性的**？（不是个别玩家的问题）
- **哪种教学方式更有效**？（需要对比实验）
- **应该优先教什么**？（资源有限，需要优先级）
- **产品如何改进**？（从群体数据中提取洞察）

这是从"教学"到"教学研究"的升级。

### 群体玩家画像（Population Persona）

基于多个玩家的画像数据，构建群体特征：

**输入**：多个 `HumanPersona`

**输出**：

```typescript
{
  sampleSize: 10,
  avgRiskTolerance: 0.62,        // 群体平均风险承受度
  avgEfficiencyBias: 0.58,       // 群体平均效率倾向
  avgDefenseAwareness: 0.45,     // 群体平均防守意识
  styleDistribution: {
    AGGRESSIVE: 0.4,             // 40% 激进型
    BALANCED: 0.3,               // 30% 平衡型
    DEFENSIVE: 0.2,              // 20% 防守型
    ERRATIC: 0.1                 // 10% 不稳定
  },
  learningStageDistribution: {
    BEGINNER: 0.5,               // 50% 新手
    INTERMEDIATE: 0.3,           // 30% 中级
    ADVANCED: 0.2                // 20% 高级
  },
  isStableSample: true           // 样本量 >= 5 为稳定样本
}
```

**关键约束**：
- 样本量 < 5 时标记为"不稳定样本"，结论仅供参考
- 所有计算都是简单的均值和比例，无统计推断

### 共性错误模式挖掘（Population Mistakes）

从多个玩家的错误模式中，识别"系统性错误"：

**输入**：多个玩家的 `MistakePattern[]`

**分析规则**：

```typescript
// 计算每种错误的出现率
prevalence = 出现该错误的玩家数 / 总玩家数

// 严重度分级（启发式）
if (prevalence > 0.5)  → HIGH    // 高频共性错误
if (prevalence > 0.2)  → MEDIUM  // 常见错误
else                   → LOW     // 个别错误
```

**输出示例**：

```typescript
[
  {
    id: 'late-game-no-defense',
    description: '后巡阶段仍打危险张',
    prevalence: 0.65,              // 65% 的玩家有此问题
    severity: 'HIGH'
  },
  {
    id: 'greedy-efficiency',
    description: '高风险情况下仍追求效率',
    prevalence: 0.42,              // 42% 的玩家有此问题
    severity: 'MEDIUM'
  }
]
```

**设计哲学**：
- 不做统计显著性检验（需要大量样本和假设检验）
- 用简单的频率阈值判断（0.5 / 0.2）
- prevalence 本身就是有价值的信息

### 教学策略 A/B 测试

对比不同教学方式的效果：

#### 教学变体定义

```typescript
const TEACHING_VARIANTS = [
  {
    id: 'variant-a-direct',
    description: '简洁直接型：快速指出问题，给出明确建议',
    tone: 'DIRECT',
    maxFocusPoints: 2
  },
  {
    id: 'variant-b-encouraging',
    description: '鼓励型：肯定优点，温和指出改进方向，配合示例',
    tone: 'ENCOURAGING',
    maxFocusPoints: 3
  },
  {
    id: 'variant-c-challenging',
    description: '挑战型：提出深度问题，引导思考，适合高手',
    tone: 'CHALLENGING',
    maxFocusPoints: 4
  }
];
```

#### 效果评估（启发式）

**输入**：多个教学会话（教学前/后的决策数据）

**评估指标**：

```typescript
{
  variantId: 'variant-b-encouraging',
  beforeRiskRate: 0.45,          // 教学前高风险率
  afterRiskRate: 0.32,           // 教学后高风险率
  improvement: 0.29,             // 改进率 = (before - after) / before
  beforeMistakeRate: 0.38,
  afterMistakeRate: 0.25
}
```

**关键约束**：
- 不做统计显著性检验（样本量不够）
- 用简单的前后对比（before/after）
- improvement 作为参考指标，不做因果推断

**为什么不用机器学习**：
- 样本量小（几十个玩家）
- 特征简单（风格、错误类型）
- 可解释性优先（教练需要理解为什么）
- 启发式规则已经足够有效

### 学习路径规划（Learning Roadmap）

基于群体错误数据，生成"先学什么、后学什么"的推荐顺序：

**优先级计算**（启发式）：

```typescript
priority = prevalence * 0.6 + severityWeight * 0.4
```

**严重度权重**（领域知识）：

| 错误类型 | 严重度权重 | 原因 |
|---------|-----------|------|
| 后巡不防守 | 0.9 | 直接导致放铳 |
| 贪效率 | 0.8 | 高风险决策 |
| 过早副露 | 0.6 | 影响手牌灵活性 |
| 风格摇摆 | 0.5 | 决策不稳定 |

**输出示例**：

```typescript
[
  {
    topic: '后巡防守意识',
    reason: '65% 的玩家在后巡阶段仍打危险张',
    priority: 0.75
  },
  {
    topic: '效率与风险的平衡',
    reason: '42% 的玩家过度追求效率而忽视风险',
    priority: 0.57
  },
  {
    topic: '副露时机判断',
    reason: '28% 的玩家在向听数较大时过早副露',
    priority: 0.41
  }
]
```

### LLM：教学洞察报告（产品级）

基于群体数据生成面向产品/教练的洞察报告：

**输入**（只读结构化数据）：
- 群体画像统计
- 高频错误列表（prevalence + severity）
- A/B 测试结果（improvement）
- 推荐学习路径（priority 排序）

**输出示例**：

> **群体特征分析**
> 
> 当前样本包含 10 位玩家（稳定样本）。整体特征：
> - 群体偏向激进型（40% AGGRESSIVE），平均风险承受度 62%
> - 防守意识普遍不足（平均 45%），这是主要短板
> - 新手占比 50%，需要基础教学内容
> 
> **主要问题**
> 
> 1. **后巡防守意识缺失**（65% 出现率，高频共性错误）
>    - 这是最严重的问题，直接导致放铳率上升
>    - 建议：优先开发"后巡防守"专项教学模块
> 
> 2. **效率与风险失衡**（42% 出现率，常见错误）
>    - 玩家过度追求向听进展，忽视危险度
>    - 建议：在教学中强化"安全第一"的理念
> 
> **教学策略建议**
> 
> A/B 测试显示：
> - **鼓励型教学**（variant-b）效果最好，高风险率降低 29%
> - 直接型教学对新手效果一般，可能打击信心
> - 挑战型教学适合高手，但样本量不足，需要更多数据
> 
> **下一阶段重点**
> 
> 1. 开发"后巡防守"互动教学模块（优先级最高）
> 2. 优化鼓励型教学语言，增加具体示例
> 3. 针对激进型玩家，设计"风险控制"专题
> 
> **产品优化方向**
> 
> - 在后巡阶段增加实时提示："当前危险度较高，建议打熟张"
> - 增加"学习路径"功能，引导玩家按优先级学习
> - 收集更多 A/B 测试数据，优化教学策略

**关键约束**：
- LLM 不参与任何数据分析或判断
- 只负责将结构化数据转换为自然语言报告
- 失败不影响系统运行（可降级为纯文本输出）

### 设计哲学：为什么不用机器学习

**常见质疑**：
- "为什么不用聚类算法找玩家群体？"
- "为什么不用统计检验验证 A/B 效果？"
- "为什么不用推荐系统生成学习路径？"

**回答**：

#### 1️⃣ 样本量不足

- 典型教学产品：几十到几百用户
- 机器学习需要：数千到数万样本
- 启发式规则：10 个样本就能用

#### 2️⃣ 特征简单

- 只有 5-6 个维度（风险、效率、防守等）
- 简单的均值/比例已经足够有信息量
- 复杂模型容易过拟合

#### 3️⃣ 可解释性优先

- 教练需要理解"为什么这样建议"
- 黑箱模型无法解释
- 规则清晰：prevalence > 0.5 → 高频错误

#### 4️⃣ 动态调整

- 规则可以随时修改（如调整阈值）
- 模型需要重新训练
- 产品迭代速度更快

#### 5️⃣ 冷启动问题

- 新产品没有历史数据
- 规则可以基于领域知识预设
- 模型需要大量数据才能训练

**类比**：
- 机器学习 = 大数据 + 黑箱优化
- 启发式规则 = 小数据 + 领域知识

在教学场景下，后者更合适。

### 完整能力边界

完成 Stage 9 后，系统已经演进为：

✅ **单步理性**（Stage 1-3）：向听、有效牌、危险评估  
✅ **局内意识**（Stage 4-5）：风格切换、攻防判断  
✅ **对手判断**（Stage 6）：实时画像、威胁估计  
✅ **局外反思**（Stage 7）：多盘总结、动态调参  
✅ **个性化教学**（Stage 8）：玩家画像、错误发现  
✅ **群体优化**（Stage 9）：共性错误、教学实验、路径规划  

这已经是一个 **完整的智能教学平台**，具备：
- 实时决策能力
- 自我调整能力
- 教练级解释能力
- 因材施教能力
- **教学研究能力**（新增）

**示例场景**：
- 产品经理查看教学洞察报告 → 发现 65% 玩家后巡不防守 → 决定开发专项教学模块
- 教练查看 A/B 测试结果 → 发现鼓励型教学效果最好 → 调整教学策略
- 玩家查看学习路径 → 按优先级学习 → 先掌握后巡防守，再学习效率优化

这不是"麻将 AI"，而是 **麻将教学研究与优化平台**。
