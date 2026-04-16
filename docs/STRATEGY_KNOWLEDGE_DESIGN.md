# 策略知识库方案设计报告

## 1. 问题分析

### 1.1 现状

当前调研报告 `deep-research-report (1).md` 约 **6000 汉字 / 15,000–20,000 tokens**。该文档是面向人类的叙述体，包含：

| 内容类型 | 占比(估) | AI 决策价值 |
|---|---|---|
| 概率公式 & 决策模型 | ~20% | **核心** — 直接可执行 |
| 决策 SOP / 流程图 | ~15% | **核心** — 决策路由 |
| 速查表 / 对照表 | ~15% | **高** — 快速查阅 |
| 规则对照 & 差异分析 | ~15% | **中** — 规则校验用 |
| 叙述性解释 / 口诀解读 | ~20% | **低** — 面向人类理解 |
| 引用来源 / 图片链接 / 排版 | ~15% | **零** — 纯格式开销 |

**核心矛盾**：每次交互只需报告 10–20% 的内容，但不得不全量加载 100%。

### 1.2 三类 AI 消费者

| 消费者 | 入口 | 需求 |
|---|---|---|
| **A. LLM 教练系统**（游戏内实时辅导） | `PromptBuilder.ts` → LLM API | 当前决策阶段的策略指导，嵌入 prompt |
| **B. 开发者 AI 助手**（Copilot / Claude） | `.github/copilot-instructions.md` + 附件 | 改进 AI 代码时参考策略理论 |
| **C. 算法 AI 代理**（`policy_high.ts`） | 代码级启发式公式 | 需要翻译为代码，不是文档引用问题 |

**本方案聚焦 A 和 B**。C 是独立的代码优化工程，不在此设计范围内。

---

## 2. 方案对比

### 方案 ①：全文压缩（结构化重写）

将整篇报告重写为 AI 友好格式（去掉叙述、引用、冗余），压缩到约 5,000 tokens。

- ✅ 实现简单，一个文件
- ✅ 压缩率约 60–70%
- ❌ 仍然全量加载——单次交互只需 10–20% 内容，浪费 80%
- ❌ 无法按阶段/场景精准匹配

### 方案 ②：分层索引 + 模块化拆分（推荐）

将知识拆分为 **索引层 + 模块层 + 深度参考层**，按需加载。

- ✅ 单次加载 300–1,200 tokens（节省 90–95%）
- ✅ 阶段/场景精准匹配
- ✅ 与现有 `PromptBuilder` 和 `RuleContext` 架构天然兼容
- ⚠️ 需要拆分和索引维护

### 方案 ③：向量检索 RAG

用 embedding 索引 + 相似度搜索做检索增强生成。

- ✅ 理论上最精准
- ❌ 需要向量数据库基础设施（本项目是纯前端 + Vercel Serverless）
- ❌ 过度工程化——知识量不大（<20K tokens），不需要向量检索
- ❌ 浏览器端无法运行 embedding

### 对比总结

| 维度 | ① 全文压缩 | ② 分层索引（推荐） | ③ RAG |
|---|---|---|---|
| 实现复杂度 | 低 | **中** | 高 |
| Token 节省 | 60–70% | **90–95%** | 95%+ |
| 精准度 | 中（全量噪声） | **高（阶段匹配）** | 高 |
| 基础设施 | 无 | 无 | 需向量 DB |
| 维护成本 | 低 | 低 | 中 |
| 与现有架构兼容 | 好 | **最好** | 需改造 |

**结论：方案 ② 是最优选择。**

---

## 3. 详细设计：分层知识库

### 3.1 三层架构

```
Layer 0: 索引路由       (~300 tokens)   ← 始终可加载
Layer 1: 决策模块       (~500-800 tokens/模块) ← 按需加载 1-2 个
Layer 2: 深度参考       (~1000-2000 tokens) ← 仅教学/解释时加载
```

**典型调用链**：

```
用户/系统触发 → 确定游戏阶段/决策类型
                  → 加载 Layer 0 索引 (300 tokens)
                  → 路由到相关模块 (500-800 tokens)
                  → 总计: 800-1,100 tokens (vs 原 15,000-20,000)
```

### 3.2 模块拆分（最终版）

```
docs/strategy/
├── _index.yaml          # Layer 0: 索引路由 (~300 tokens)
├── exchange.md          # Layer 1: 换三张决策
├── dingque.md           # Layer 1: 定缺决策
├── discard_quemen.md    # Layer 1: 缺门清理出牌
├── discard_offense.md   # Layer 1: 中盘进攻出牌
├── discard_baoting.md   # Layer 1: 保听策略
├── listen.md            # Layer 1: 听牌选择 & EV 比较
├── gang.md              # Layer 1: 杠决策
├── defense.md           # Layer 1: 防守切换 & 安全牌
├── endgame.md           # Layer 1: 尾局 & 查叫/花猪
└── probability.md       # Layer 1: 核心概率公式（共享，按需联合加载）
```

**已确认变更**:
- `discard.md` 拆分为 3 个独立模块（缺门清理 / 中盘进攻 / 保听策略）
- `rules_delta.md` 已移除（决策时不需要）
- `probability.md` 仅在 advanced 级别或教学场景时联合加载
- 原始报告保留为人类阅读版本（`deep-research-report (1).md`）

### 3.3 索引设计（`_index.yaml`）

```yaml
# 四川麻将血战策略知识库 - 路由索引
# 用法: 根据当前游戏阶段和决策类型，加载对应模块

modules:
  exchange:
    phase: EXCHANGE
    trigger: 选择换出的 3 张牌
    summary: 选花色(最弱门)→选牌(低牌效孤张优先)→目标(制造两门不均衡)
    file: exchange.md

  dingque:
    phase: DING_QUE
    trigger: 选择缺门花色
    summary: 评分公式=2×连张+3×两面搭+2×对子+1×中张-2×孤张幺九；选最低分门
    file: dingque.md

  discard:
    phase: PLAYING
    trigger: 出牌决策(进攻态)
    summary: 优先降向听→同向听选高进张→保复合形→查叫压力下先听
    file: discard.md

  listen:
    phase: PLAYING
    trigger: 听牌选择/换听
    summary: EV=P(胡)×Score-Risk-P(流局)×Penalty；两面>双碰>嵌张>边张>单钓
    file: listen.md

  gang:
    phase: PLAYING
    trigger: 碰/杠决策
    summary: 杠EV=即时杠钱-抢杠风险-退税风险-信息暴露；不稳听时先听再杠
    file: gang.md

  defense:
    phase: PLAYING
    trigger: 防守切换判断
    summary: 触发条件(对手快听/明副露多/牌墙见底)；安全序=缺门牌>熟张>幺九>中张
    file: defense.md

  endgame:
    phase: PLAYING
    trigger: 尾局(牌墙<20)或流局临近
    summary: 查叫/花猪惩罚是巨大负EV；保听优先于追番；最后四张有胡必胡
    file: endgame.md

  probability:
    phase: "*"
    trigger: 需要概率计算时引用
    summary: 向听/进张/成胡概率(超几何)/EV公式
    file: probability.md

  rules_delta:
    phase: "*"
    trigger: 规则澄清/差异确认
    summary: 主流血战规则与本项目实现的差异对照表
    file: rules_delta.md
```

### 3.4 模块格式规范

每个 Layer 1 模块遵循统一格式：

```markdown
# [模块名] - [一句话目标]

## 决策规则（按优先级排序）

1. IF [条件] THEN [动作] — [原因]
2. IF [条件] THEN [动作] — [原因]
...

## 评估公式

$公式$

## 速查表

| 场景 | 动作 | 原因 |
|---|---|---|

## 常见误区

- ❌ [误区] → ✅ [正确做法]
```

**格式原则**：
- **无叙述段落** — 每行都是可执行的规则或数据
- **无引用/来源** — AI 不需要知道"谁说的"
- **无重复** — 共享知识（概率公式）集中在 `probability.md`
- **决策树用编号规则** — 比 Mermaid 流程图更省 token
- **公式用 LaTeX** — 精确无歧义

### 3.5 Token 预算

| 层级 | 模块 | 估算 Tokens | 加载时机 |
|---|---|---|---|
| L0 | `_index.yaml` | ~300 | 始终 |
| L1 | `exchange.md` | ~500 | EXCHANGE 阶段 |
| L1 | `dingque.md` | ~500 | DING_QUE 阶段 |
| L1 | `discard.md` | ~800 | PLAYING 出牌 |
| L1 | `listen.md` | ~600 | PLAYING 听牌选择 |
| L1 | `gang.md` | ~500 | PLAYING 杠决策 |
| L1 | `defense.md` | ~600 | PLAYING 防守态 |
| L1 | `endgame.md` | ~500 | 尾局 |
| L1 | `probability.md` | ~600 | 按需（与其他模块联合） |
| L2 | `rules_delta.md` | ~1500 | 规则校验时 |
| **总计** | | **~6,400** | — |
| **单次典型加载** | L0 + 1-2 个 L1 | **800–1,700** | — |

**对比原文档 15,000–20,000 tokens → 单次加载降至 800–1,700 tokens → 节省 90–94%**

---

## 4. 集成方案

### 4.1 LLM 教练系统集成（消费者 A）

在 `src/llm/` 中新增 `StrategyContext.ts`：

```typescript
// src/llm/StrategyContext.ts

/** 根据游戏阶段和局面状态，返回相关策略模块的文本内容 */
export function getStrategyContext(
  phase: Phase,
  situation?: 'offense' | 'defense' | 'endgame' | 'gang' | 'listen'
): string {
  // 1. 根据 phase 确定主模块
  // 2. 根据 situation 加载辅助模块（如 defense、endgame）
  // 3. 如果涉及概率计算，附加 probability.md 的相关公式
  // 4. 拼接返回
}
```

在 `PromptBuilder.ts` 各方法中注入：

```typescript
// 现有: getRuleSummary() 提供规则
// 新增: getStrategyContext(phase, situation) 提供策略
const strategy = getStrategyContext('PLAYING', 'offense');
prompt += `\n\n## 策略参考\n${strategy}`;
```

### 4.2 开发者 AI 助手集成（消费者 B）

在 `.github/copilot-instructions.md` 中添加索引引用：

```markdown
## Strategy Knowledge Base

策略知识库位于 `docs/strategy/`，按决策阶段拆分为独立模块。
需要参考策略理论时，先读 `docs/strategy/_index.yaml` 确定相关模块，
再按需读取具体模块文件。不要一次性读取所有模块。
```

Copilot 在处理 AI 策略相关问题时，会：
1. 读 `_index.yaml`（~300 tokens）
2. 根据问题上下文选择 1–2 个模块
3. 仅加载相关内容

### 4.3 文件读取方式

模块文件使用**静态 Markdown 文件 + 构建时内联**或**运行时 fetch**：

- **开发环境**：Vite 的 `?raw` import 直接内联
- **生产环境**：`fetch('/docs/strategy/xxx.md')` 按需加载
- **Copilot/AI 助手**：直接 `read_file`

```typescript
// 构建时内联示例
import exchangeStrategy from '../../docs/strategy/exchange.md?raw';
import dingqueStrategy from '../../docs/strategy/dingque.md?raw';
// ...按需 import
```

---

## 5. 实施步骤

| 步骤 | 工作内容 | 产出 |
|---|---|---|
| **S1** | 从报告中提取知识，按模块格式写入 9 个文件 | `docs/strategy/*.md` + `_index.yaml` |
| **S2** | 实现 `StrategyContext.ts`（阶段路由 + 文件加载） | `src/llm/StrategyContext.ts` |
| **S3** | 在 `PromptBuilder.ts` 中注入策略上下文 | 修改 7 个 prompt 构建方法 |
| **S4** | 更新 `copilot-instructions.md` 添加知识库引用 | 修改 `.github/copilot-instructions.md` |
| **S5** | 写测试验证模块加载和路由正确性 | `tests/strategyContext.test.ts` |

**S1 是核心工作量**（知识提取和结构化），S2–S5 是标准工程实现。

---

## 6. 效果预期

| 指标 | 现状 | 方案实施后 |
|---|---|---|
| 单次 Token 消耗 | 15,000–20,000 | **800–1,700**（降 90%+） |
| 知识精准度 | 全量噪声，LLM 自行筛选 | 阶段匹配，无关内容不加载 |
| 维护方式 | 修改一个大文件 | 独立模块，改一个不影响其他 |
| 与现有架构兼容 | 需全文附加到 prompt | 与 `RuleContext` 同层对等集成 |
| 开发者引用 | 每次附加全文 | Copilot 按需读取模块 |

---

## 7. 已确认项（已实施）

1. **模块粒度**：`discard.md` 已拆分为 `discard_quemen.md` + `discard_offense.md` + `discard_baoting.md`，共 10 个模块
2. **深度参考层**：`rules_delta.md` 不需要，已移除
3. **概率模块加载策略**：`probability.md` 仅在 `withProbability=true` 时联合加载（advanced 级别或教学场景）
4. **原报告保留**：`deep-research-report (1).md` 作为人类阅读版本保留
