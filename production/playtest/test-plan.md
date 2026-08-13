# neo-mahjong Playtest 测试计划（Phase 6 打磨）

| 项目 | 值 |
|---|---|
| 被测产品 | neo-mahjong — 成都麻将 AI 教学平台 |
| 阶段 | Phase 6 打磨 |
| 评审强度 | **full**（每轮须有真实执行证据） |
| 代码基线 | `314547a`（Docs: rewrite Chinese README for GitHub） |
| 技术栈 | Vite + TypeScript，DOM/CSS 渲染（pixi 已移除），Vercel 部署 |
| 测试执行者 | quality-lead（严守真） |
| 编写日期 | Phase 6 打磨期 |

---

## 1. 测试目标与范围

### 1.1 目标

在「全量修复冲刺已结束、设计/架构评审门均 PASS」的前提下，用**可复现的自动化证据**回答三个问题：

1. **核心循环真的能跑通吗？** 发牌 → 换三张 → 定缺 → 碰/杠/胡 → 血战到底 → 结算，全链路是否在**规则层自身**闭环，而非依赖编排层兜底。
2. **计分与教学是否一致？** 作为**教学平台**，LLM 讲的番型/番值必须等于结算实际给的分。任何「文档 > 代码」漂移都是教学事故。
3. **难度梯度是玩家可感知的吗？** high / mid / low 三档是否产生**可测量**的强弱差异。

### 1.2 范围内（In Scope）

| 维度 | 说明 |
|---|---|
| D1 核心循环与规则一致性 | 阶段机、牌张守恒、手牌张数、定缺约束、血战到底终局、结算零和 |
| D2 UI 流可达性 | 首页 → 设置 → 对局 → 回放 的渲染契约 |
| D3 教学准确性 | `src/llm/RuleContext.ts` / `PromptBuilder.ts` 文案 vs `patterns.ts` 实际番值 |
| D4 难度梯度 | `high / mid / low` 强弱方向性、稳定性、可复现性 |
| D5 边界规则 | 流局、查花猪、查大叫、金钩钓、天胡/地胡、番型叠加 |

### 1.3 范围外（Out of Scope）

- **不修改任何现有玩法逻辑源码**（`src/**`）。本轮仅读取 + 新增 `tests/**`。发现的缺陷以工单形式列入报告。
- **`neuralTrainer`**：实验性、未接入生产路径，不测。
- **真实 LLM 联网调用**：LLM 仅"表达"不"决策"（ADR-004），本轮只校验**静态教学文案与番值真相源的一致性**，不做在线推理质量评估。
- **跨浏览器/移动端兼容性、性能压测**：不在 Phase 6 打磨的 QA 门内。
- **多局连打（match/连庄）**：本轮以单局（round）为测试单元。

### 1.4 真相源（Source of Truth）约定

> **番值以 `src/core/rules/packs/chengdu/patterns.ts` 为唯一真相源。**
> 任何文档、LLM 文案、UI 文本与之不一致，一律判为**文案缺陷**，而非改代码去迁就文档。
> 计分公式：`底分 5 × 2^(总番数 + 杠数 − 1)`。

---

## 2. 测试方法：Headless 对局驱动器

真实对局依赖 DOM + `GameOrchestrator`，无法在 vitest（node 环境）直接跑。为获得**真实执行证据**而非人工臆测，本轮自建驱动器：

**`tests/playtestHarness.ts`**（工具模块，非 `*.test.ts`，不被收集为用例）

- 复刻 `GameOrchestrator.loop()` 的推进语义：有 `lastDiscard` → `resolveReactions`；否则当前行动者取合法动作并 `applyAction`。
- 通过 `globalThis.__trainingGameSeed` 注入种子 → **同 seed 完全可复现**。
- 逐步执行**不变量守卫**，违规即记录（不中断），便于一次跑完收集全部问题：

| 不变量 | 判据 |
|---|---|
| `TILE_CONSERVATION` | `wall + 手牌 + 弃牌 + 副露中来自手牌的张数 ≡ 108`（碰=2 / 暗杠=4 / 明杠·加杠=3） |
| `TILE_KIND_OVERFLOW` | 每种牌全局 ≤ 4 张 |
| `HAND_SIZE` | 手牌数 ∈ {`13−3×副露数`, `+1`} |
| `DINGQUE_DISCARD` | 手上仍有定缺花色时，出牌必须是该花色 |
| `HU_WITHOUT_QUE` | 胡牌时手牌+副露均不得含定缺花色 |
| `SCORE_NOT_ZERO_SUM` | `Σ scores == 0` |
| `ACTION_NOOP` | `applyAction` 返回同一对象（`getLegalActions` 给了会被拒的动作） |
| `UNRECOVERABLE` / `NO_LEGAL_ACTION` | 无法推进且兜底失效 |

**关键开关（用于分离"规则层缺陷"与"编排层掩盖"）：**

| 选项 | 默认 | 用途 |
|---|---|---|
| `deadlockGuard` | `true` | 复刻 `GameOrchestrator` 的 `DeadlockGuard`（`buildRecoveryAction` 注入 DRAW/DISCARD）。设为 `false` 即暴露**纯规则层**是否能自行推进。 |
| `invariants` | `true` | 大样本难度对抗时设 `false` 提速（不变量已由轮次 1 覆盖）。 |
| `trace` | `true` | 是否收集事件轨迹。 |

**难度对抗的可复现性处理**：`decideLow` 使用裸 `Math.random()`。对抗测试中用 xorshift32 临时替换 `Math.random`，使结果可复现（同时这一事实本身被记录为缺陷，见 QA-P2-009）。

---

## 3. 轮次安排

| 轮次 | 主题 | 覆盖维度 | 测试文件 | 样本 |
|---|---|---|---|---|
| **轮次 1** | 核心循环与不变量 | D1（+ D2 引用既有契约） | `tests/playtest-round1-core-loop-invariants.test.ts` | 12 局全 high（seed 1001–1012）+ 4 局关闭兜底对照 |
| **轮次 2** | 边界场景与计分正确性 | D5 | `tests/playtest-round2-boundary-and-scoring.test.ts` | 构造态单元验证（听牌/番型/流局结算） |
| **轮次 3** | 难度梯度 + 教学准确性 | D3、D4 | `tests/playtest-round3-difficulty-and-teaching.test.ts` | 教学：源码解析全量对照；难度：2 组 × 8 局对抗 + 3 档 × 2 局稳定性 |

### 3.1 轮次 1 场景矩阵

| 用例 | 场景 |
|---|---|
| R1-1 | 12 局均在步数上限内自然终局 |
| R1-2 | 阶段顺序 `EXCHANGE → DING_QUE → PLAYING → END`，不得回退 |
| R1-3 | 牌张守恒 108 + 每种牌 ≤ 4 |
| R1-4 | 手牌张数 = `13 − 3×副露` 或 `+1` |
| R1-5 | 定缺约束（手上有缺门牌只能打缺门牌） |
| R1-6 | 胡牌必须已完成缺一门 |
| R1-7 | 四家定缺完成且取值 ∈ {W,B,T} |
| R1-8 | 血战到底终局：3 家胡牌 或 牌墙摸完；**绝不允许 4 家全胡** |
| R1-9 | 结算零和 |
| R1-10 | `applyAction` 空转特征化（缺陷绊线） |
| R1-11 | 对局画像 + 兜底统计 + 日志噪声计数（证据打印） |
| R1-12 | 副露路径被真实覆盖（碰/杠 ≥ 1） |
| R1-13 | 胡牌路径被真实覆盖 |
| R1-14 | **关闭兜底后纯规则层活锁**（缺陷绊线 + 反向对照） |

### 3.2 轮次 2 场景矩阵

| 分组 | 用例 | 场景 |
|---|---|---|
| A 听牌 / 查大叫前置 | R2-A1 | 门清 13 张听牌可识别 |
| | R2-A2 | 有副露玩家（10 张）听牌判定 |
| | R2-A3 | 流局查大叫：副露听牌玩家是否被误罚 |
| B 番型叠加 | R2-B1 | 基准番值：清一色 2 / 七对子 2 / 龙七对 3 |
| | R2-B2 | 清七对（七对子 + 清一色）叠加 |
| | R2-B3 | 清龙七对叠加 |
| | R2-B4 | 清一色判定是否计入副露花色 |
| | R2-B5 | 计分公式 `5 × 2^(番+杠−1)` |
| C 特殊胡牌 | R2-C1 | 天胡 4 番 / 地胡 4 番 |
| | R2-C2 | 金钩钓判定口径 |
| | R2-C3 | 天胡窗口（P0 + turn 0 + 起手 14 张） |
| D 流局 | R2-D1 | 查花猪赔付 + 零和 |
| | R2-D2 | 三家胡牌（非流局）不触发流局罚分 |
| | R2-D3 | `hasQueYiMen` 手牌 + 副露联合判定 |

### 3.3 轮次 3 场景矩阵

| 分组 | 用例 | 场景 |
|---|---|---|
| T 教学准确性 | R3-T1 | 从 `patterns.ts` 解析番值真相源 |
| | R3-T2 | LLM 番值表 vs 真相源逐项对照 |
| | R3-T3 | `getYakuExplanation` 覆盖全部 `YakuType` |
| | R3-T4 | 混一色声明/计分/讲解三态一致性 |
| | R3-T5 | `PromptBuilder` 番值文案回归确认 |
| | R3-T6 | 文案计分示例 vs `calculateScore` |
| | R3-T7 | 叠加规则文案 vs 七对分支实际行为 |
| D 难度梯度 | R3-D1 | mid/low 权重参数削弱巡检 + 三档策略非同一引用 |
| | R3-D2 | 同 seed 可复现性（low vs high 对照） |
| | R3-D3 | 强弱对抗：胡牌率 + 得分方差双度量 |
| | R3-D4 | 三档均能稳定终局 |
| | R3-D5 | 难度差异体现在决策上 |

---

## 4. 入口与复现方式

### 4.1 环境准备

```bash
cd <repo-root>
pnpm install
```

### 4.2 全量回归（质量门基线）

```bash
pnpm test:run          # 全部测试必须绿
pnpm build             # 构建必须绿
npx tsc --noEmit       # 类型必须 0 错误
```

### 4.3 逐轮复现

```bash
# 轮次 1：核心循环与不变量（含纯规则层活锁复现）
pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts

# 轮次 2：边界场景与计分
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts

# 轮次 3：难度梯度 + 教学准确性
pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts

# UI 流可达性（既有契约测试）
pnpm vitest run tests/uiPages.contract.test.ts
```

> 所有 `console.info` 打印的**对局画像 / 结算明细 / 番值对照表**即为报告中的原始证据，可直接比对。

### 4.4 单缺陷最小复现

| 缺陷 | 复现命令 |
|---|---|
| 纯规则层活锁（加杠后无人推进） | `pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts -t R1-14` |
| 碰后打碰牌空转 | `pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts -t R1-10` |
| 副露玩家被误判大叫 | `pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-A3` |
| 清七对番值不叠加 | `pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-B2` |
| 假清一色 | `pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-B4` |
| 刮风下雨讲解失效（西里尔字母） | `pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts -t R3-T3` |
| low 档不可复现 | `pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts -t R3-D2` |

---

## 5. Bug 分级标准

| 级别 | 定义 | 处置 |
|---|---|---|
| **P0 致命** | 对局无法进行/卡死；数据损坏（牌张不守恒、分数不零和）；核心规则失效 | **阻塞发布**，必须修 |
| **P1 严重** | 计分错误、教学内容错误（教学平台的核心价值受损）、错误罚分 | **阻塞发布**（教学产品尤其），必须修 |
| **P2 一般** | 体验/可维护性问题；规则口径与线下不一致但内部自洽；方差过大 | 建 Backlog，可不阻塞 |
| **P3 轻微** | 日志噪声、命名瑕疵、冗余代码 | Backlog |

---

## 6. 特征化测试（Characterization Test）约定

> 本轮任务约束为「**不修改现有玩法逻辑源码**」，同时要求「**全程保持 `pnpm test:run` 绿**」。
> 二者叠加意味着：**不能写一个红着的测试去表达缺陷**。

采用的做法是**特征化测试 + 回归绊线**：

- 用测试**断言当前（有缺陷的）实际行为**，并在用例名标注 `【已知缺陷 QA-xxx】`。
- 断言消息统一写成 `"QA-xxx 疑似已修复：请更新本测试与 PLAYTEST_REPORT"`。
- 效果：套件保持绿；一旦有人修复了缺陷，该断言**立即失败**，强制修复者同步更新测试与报告 —— 缺陷不会被"静默修掉"而报告失去时效。

**这不是掩盖缺陷。** 每条特征化测试都在 `console.info` 中打印完整证据（番型明细 / 结算分数 / 字符码点），且在报告中有对应工单与修复建议。

---

## 7. 质量门判定规则

| 判定 | 条件 |
|---|---|
| **PASS** | 无 P0、无 P1 |
| **CONCERNS** | 无 P0，存在 P1/P2，但均有明确工单与修复路径 |
| **FAIL** | 存在 P0，或存在影响核心教学正确性且无绕行方案的 P1 |

> 质量门为 **advisory（建议性）**：QA 给判定与依据，**是否放行由用户（产品负责人）决定**。
