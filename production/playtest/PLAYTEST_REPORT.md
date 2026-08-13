# neo-mahjong Playtest 报告（Phase 6 打磨）

| 项目 | 值 |
|---|---|
| 被测产品 | neo-mahjong — 成都麻将 AI 教学平台 |
| 阶段 | Phase 6 打磨 |
| 评审强度 | **full**（每轮均附真实命令行执行证据） |
| 代码基线 | `314547a` |
| 执行轮次 | **3 轮**（核心循环 / 边界计分 / 难度与教学） |
| 测试计划 | [`production/playtest/test-plan.md`](./test-plan.md) |
| 执行者 | quality-lead（严守真） |

## 执行摘要

| 门禁项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ **0 错误** |
| `pnpm test:run` | ✅ **32 文件 / 215 用例 全绿**（基线 29 文件 / 174 用例，本轮新增 3 文件 / 41 用例） |
| `npx vite build` | ✅ 成功（`117 modules transformed`，`index-*.js` 294.72 kB / gzip 94.77 kB）<br>⚠️ `pnpm build` 在本地沙箱因删除 `dist/` 的权限限制失败，改用 `--outDir dist-qa-verify` 验证通过 —— **非项目缺陷** |

| Bug 分级 | 数量 | 编号 |
|---|---|---|
| **P0 致命** | **2** | QA-P0-001、QA-P0-002 |
| **P1 严重** | **4** | QA-P1-003、QA-P1-004、QA-P1-005、QA-P1-006 |
| **P2 一般** | **5** | QA-P2-007 ~ QA-P2-011 |
| **P3 轻微** | **2** | QA-P3-012、QA-P3-013 |
| 合计 | **13** | |

> ## 🔴 整体质量门判定：**FAIL**
>
> **阻塞理由（二者独立成立）：**
> 1. **存在 2 个 P0**：成都规则包在「加杠后」与「碰后打碰牌」两条路径上**无法自行推进对局**。当前可玩性完全建立在 `GameOrchestrator.DeadlockGuard` 的兜底注入之上 —— **12 局采样中 4 局（33%）触发了兜底**。关闭兜底后这些局直接活锁。这不是"偶发卡顿"，而是规则层状态机的契约破损被编排层掩盖。
> 2. **存在 4 个 P1 且全部落在"计分/教学正确性"上**。对一个**教学平台**而言，教错番值＝产品核心价值失效：清七对少算一半分、副露听牌玩家被倒扣分、副露异色仍判清一色多送 2 番、"刮风下雨"的番型讲解直接输出「未知番型」。
>
> 详见文末[质量门判定与阻塞项](#质量门判定与阻塞项)。质量门为 **advisory**，**是否放行由用户决定**。

---

## 测试方法说明（为何证据可信）

真实对局依赖 DOM + `GameOrchestrator`，无法在 vitest（node 环境）直跑。为满足 full 强度「真实执行证据」要求，本轮新建 headless 对局驱动器 **`tests/playtestHarness.ts`**：

- 复刻 `GameOrchestrator.loop()` 推进语义，经 `globalThis.__trainingGameSeed` 注入种子 → **同 seed 完全可复现**。
- 逐步校验 7 类硬不变量（牌张守恒 108 / 每种牌 ≤4 / 手牌张数 / 定缺约束 / 胡牌缺一门 / 分数零和 / applyAction 空转）。
- **关键设计**：`deadlockGuard` 开关。默认 `true`（复刻生产兜底并统计触发次数）；设为 `false` 即剥离编排层保护，**暴露纯规则层能否自行闭环** —— 这是本轮定位 2 个 P0 的核心手段。

> 本报告所有数字均来自下方命令的 `console.info` 原样输出，可直接复跑比对。

---

# 轮次 1：核心循环与不变量

### 目标

验证发牌 → 换三张 → 定缺 → 碰/杠/胡 → 血战到底 → 结算全链路是否在**规则层自身**闭环，且全程不违反硬不变量。

### 执行场景

`tests/playtest-round1-core-loop-invariants.test.ts` — 14 用例，12 局全 high 对局（seed 1001–1012）+ 4 局关闭兜底的对照组。

```bash
pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts
# → Test Files 1 passed (1) / Tests 14 passed (14)
```

### 证据 1：12 局对局画像

```
seed=1001 steps=178 turn=58 end=WALL_EMPTY hu=2 wallLeft=0 melds=1/1/1/1 gang=0/0/0/0 guard=0 scores=-10/-5/10/5
seed=1002 steps=179 turn=59 end=WALL_EMPTY hu=1 wallLeft=0 melds=0/2/1/1 gang=0/0/0/0 guard=0 scores=5/5/-15/5
seed=1003 steps=172 turn=56 end=THREE_HU  hu=3 wallLeft=3 melds=2/1/1/1 gang=0/0/0/0 guard=0 scores=5/-30/10/15
seed=1004 steps=180 turn=60 end=WALL_EMPTY hu=1 wallLeft=0 melds=1/2/1/2 gang=0/1/0/0 guard=0 scores=5/-5/5/-5
seed=1005 steps=185 turn=62 end=WALL_EMPTY hu=2 wallLeft=0 melds=1/4/0/2 gang=0/0/0/0 guard=0 scores=-10/-10/10/10
seed=1006 steps=176 turn=57 end=WALL_EMPTY hu=2 wallLeft=0 melds=0/2/0/1 gang=0/0/0/0 guard=0 scores=5/5/-5/-5
seed=1007 steps=153 turn=50 end=THREE_HU  hu=3 wallLeft=9 melds=0/2/0/2 gang=0/0/0/0 guard=0 scores=5/35/-45/5
seed=1008 steps=181 turn=59 end=WALL_EMPTY hu=2 wallLeft=0 melds=0/4/2/0 gang=0/1/0/0 guard=2 scores=-5/320/15/-330
seed=1009 steps=174 turn=58 end=THREE_HU  hu=3 wallLeft=4 melds=2/2/2/3 gang=0/1/0/0 guard=0 scores=-20/10/10/0
seed=1010 steps=185 turn=61 end=WALL_EMPTY hu=2 wallLeft=0 melds=1/2/2/3 gang=0/0/0/1 guard=2 scores=-20/15/-20/25
seed=1011 steps=185 turn=61 end=WALL_EMPTY hu=2 wallLeft=0 melds=2/2/4/2 gang=0/0/2/0 guard=3 scores=-100/125/-85/60
seed=1012 steps=177 turn=58 end=WALL_EMPTY hu=2 wallLeft=0 melds=0/2/0/1 gang=0/0/0/0 guard=1 scores=0/-10/5/5

[R1 DeadlockGuard 兜底统计] 4/12 局依赖兜底才能推进，共触发 8 次
[R1 热路径日志噪声] 12 局共触发 console.log 4465 次 (平均 372 次/局)
```

**通过项（8/12 局零兜底，全部不变量零违规）：**

| 不变量 | 结果 |
|---|---|
| 牌张守恒 108 + 每种牌 ≤ 4 | ✅ 12 局 × 全步骤 零违规 |
| 手牌张数 `13−3×副露 (+1)` | ✅ 零违规 |
| 定缺约束（有缺门牌只能打缺门牌） | ✅ 零违规 |
| 胡牌必须已完成缺一门 | ✅ 零违规 |
| 阶段顺序 `EXCHANGE→DING_QUE→PLAYING`，不回退 | ✅ 12 局一致 |
| 血战到底终局（3 家胡 / 牌墙摸完），**绝无 4 家全胡** | ✅ 零违规 |
| 结算零和 `Σ=0` | ✅ 12 局全部为 0 |
| 副露路径 / 胡牌路径被真实覆盖 | ✅ 碰杠共 33 次，胡牌共 25 次 |

### 证据 2：兜底触发上下文 —— 全部指向「加杠」

```
seed=1008 step46 P1 仅剩PASS → 兜底DRAW     | lastAddedGangTile=T9<P1 | lastPengTile=- | hand=10 melds=1
seed=1008 step47 P1 仅剩PASS → 兜底DISCARD  | lastAddedGangTile=T9<P1 | lastPengTile=- | hand=11 melds=1
seed=1010 step75 P3 仅剩PASS → 兜底DRAW     | lastAddedGangTile=T3<P3 | lastPengTile=- | hand=7  melds=2
seed=1010 step76 P3 仅剩PASS → 兜底DISCARD  | lastAddedGangTile=T3<P3 | lastPengTile=- | hand=8  melds=2
seed=1011 step57 P2 仅剩PASS → 兜底DRAW     | lastAddedGangTile=W8<P2 | lastPengTile=- | hand=7  melds=2
seed=1011 step58 P2 仅剩PASS → 兜底DISCARD  | lastAddedGangTile=W8<P2 | lastPengTile=- | hand=8  melds=2
```

**8 次兜底触发，`lastAddedGangTile` 无一为空** —— 根因锁定为加杠后状态机停摆。

### 证据 3：关闭兜底 → 纯规则层活锁

```
[R1-14 纯规则层活锁证据（deadlockGuard=false, maxSteps=600）]
seed=1008 end=STEP_LIMIT steps=600 hu=0 wallLeft=44 firstViolation=-
seed=1010 end=STEP_LIMIT steps=600 hu=0 wallLeft=35 firstViolation=-
seed=1011 end=STEP_LIMIT steps=600 hu=0 wallLeft=40 firstViolation=-
seed=1012 end=STEP_LIMIT steps=43  hu=0 wallLeft=44 firstViolation=[ACTION_NOOP] step43: P3 DISCARD W1 未改变状态
```

对照：同样 4 个 seed 在**开启兜底**后全部自然终局。→ 两种失效模式：`STEP_LIMIT`（状态签名循环，`wallLeft` 停在 35–44、`hu=0`）与 `ACTION_NOOP`（step 43 即停摆）。

### 证据 4：applyAction 空转

```
[R1-10 空转证据]
seed=1011 [ACTION_NOOP] step89: P3 DISCARD W5 未改变状态（getLegalActions 提供了 applyAction 拒绝的动作）
seed=1012 [ACTION_NOOP] step43: P3 DISCARD W1 未改变状态（getLegalActions 提供了 applyAction 拒绝的动作）
```

### 发现的问题

---

#### 🔴 QA-P0-001 加杠后规则层无人可推进，对局活锁

| 字段 | 内容 |
|---|---|
| **级别** | **P0 致命** |
| **位置** | `src/core/rules/packs/chengdu/index.ts` — `getLegalActions`（加杠后分支） |
| **影响** | 12 局采样中 3 局（25%）命中。关闭编排层兜底后 100% 活锁，对局永久卡死、玩家无法继续 |

**复现步骤**

```bash
pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts -t R1-14
```

1. 以 seed=1008 驱动全 high 对局，`deadlockGuard: false`。
2. 推进至 step46：P1 完成加杠 `GANG:T9/JIA`，`lastAddedGangTile = {tile: T9, from: P1}`。
3. 查询 `getLegalActions(state, 'P1')` → **仅返回 `[{type:'PASS'}]`**。

**预期**：加杠后应（a）开启其他玩家的抢杠胡窗口，(b) 窗口关闭后由加杠者补摸一张（杠上开花机会）。
**实际**：加杠者只能 PASS（无法 DRAW），其余玩家也只能 PASS。四家全 PASS → `turn`/`wall`/`hand` 全部不变 → 状态签名循环，跑满 600 步仍 `hu=0`、`wallLeft=44`。

**修复建议**
1. 在 `getLegalActions` 的加杠后分支，为**加杠者本人**补上 `DRAW`（补杠牌），并置 `isAfterGang=true` 以便触发杠上开花判定。
2. 加杠落地时应生成"待抢杠"状态，令其他未胡玩家在 `resolveReactions` 中获得 `HU`（抢杠胡，2 番）选项；窗口关闭后再回到步骤 1。
3. **建立回归测试**：加杠后 `getLegalActions(加杠者)` 必须包含非 PASS 动作。可直接复用 `tests/playtestHarness.ts` 的 `deadlockGuard:false` 模式作为门禁。

---

#### 🔴 QA-P0-002 `getLegalActions` 提供 `applyAction` 会拒绝的动作（碰后打碰牌）→ 空转卡死

| 字段 | 内容 |
|---|---|
| **级别** | **P0 致命** |
| **位置** | `getLegalActions`（DISCARD 候选生成）与 `applyAction`（`"Cannot discard the tile just ponged"` 守卫）契约不一致 |
| **影响** | 12 局采样中 2 局命中；关闭兜底后 seed=1012 在 step43 直接停摆 |

**复现步骤**

```bash
pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts -t R1-10
```

1. seed=1012 驱动至 step43：P3 刚碰下 `W1`（`lastPengTile = W1`），手牌中仍有一张 `W1`。
2. `getLegalActions(state,'P3')` **把 `DISCARD:W1` 列为合法**。
3. AI 选中该动作 → `applyAction` 命中 `lastPengTile` 守卫 → **直接 `return state`（同一对象引用）**。
4. 状态未变 → 下一轮同一玩家、同一合法动作集 → 无限循环。

**预期**：`getLegalActions` 与 `applyAction` 必须满足契约 —— 前者产出的任何动作，后者都必须能推进状态。
**实际**：静默拒绝，无异常、无日志，仅返回原 state。

**修复建议**
1. **根治**：在 `getLegalActions` 生成 DISCARD 候选时过滤掉 `lastPengTile`（与 `buildRecoveryAction` 已有的过滤逻辑完全一致，逻辑可直接复用）。
2. **防御**：`applyAction` 遇到非法动作时应 `throw` 或返回带 `rejected` 标记的新对象，**绝不返回同一引用** —— 静默返回原 state 是所有活锁的温床。
3. **门禁**：把"`applyAction` 返回同一引用"提升为 CI 断言（harness 的 `ACTION_NOOP` 检查已实现，可直接接入）。

---

#### 🟡 QA-P2-011 `DeadlockGuard` 掩盖规则层缺陷，使 33% 的对局处于"伪正常"状态

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般**（架构/可维护性；其致命后果已由 P0-001/002 承载） |
| **位置** | `src/orchestration/GameOrchestrator.ts` — `buildRecoveryAction` / `loop()` 的 DeadlockGuard |
| **证据** | `4/12 局依赖兜底才能推进，共触发 8 次` |

**问题**：兜底把规则层的契约破损转成"看起来能玩"。但兜底注入的是**任意合法牌**（`candidates[0]`），并非策略决策 —— 意味着这 4 局中 AI 有 8 次是"被迫乱打"，且玩家与开发者都无感知（仅 `console.error` 刷屏）。

**修复建议**
1. 修完 P0-001/002 后，把 DeadlockGuard 降级为**仅告警不注入**（或加 `import.meta.env.DEV` 开关），让活锁在测试环境暴露而非被吞掉。
2. 兜底触发时上报可观测指标（次数 + `lastAddedGangTile`/`lastPengTile` 上下文），避免再次静默劣化。

---

#### 🔵 QA-P3-012 热路径裸 `console.log`，平均 372 次/局

| 字段 | 内容 |
|---|---|
| **级别** | **P3 轻微** |
| **证据** | `12 局共触发 console.log 4465 次 (平均 372 次/局)` |
| **分布** | `chengdu/index.ts` 17 处、`GameOrchestrator.ts` 19 处、全 `src/`（除测试）共 **171 处**裸 console 调用 |

**影响**：生产环境 DevTools 被刷屏；`log/warn/error` 仅由 `testConfig.trainingMode` 单一开关控制，无日志级别概念。与 `design/gdd/REVIEW.md` 遗留 CONCERN「日志级别开关」同源。

**修复建议**：引入 `logger`（`level: silent|error|warn|info|debug`），生产默认 `error`；禁止在 `getLegalActions`/`applyAction` 等每步调用的热路径打 `info` 及以下级别。

### 轮次 1 小结

核心循环的**数据完整性极为可靠**（牌张守恒、手牌张数、定缺、零和 —— 12 局全步骤零违规），但**状态机推进能力存在 2 处 P0 破损**，靠编排层兜底维持表面可玩。

---

# 轮次 2：边界场景与计分正确性

### 目标

验证成都血战特有边界规则的触发与计分：流局（查花猪/查大叫）、番型叠加、金钩钓、天胡/地胡。**番值以 `patterns.ts` 为唯一真相源。**

### 执行场景

`tests/playtest-round2-boundary-and-scoring.test.ts` — 15 用例，4 组（A 听牌/查大叫、B 番型叠加、C 特殊胡牌、D 流局）。

```bash
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts
# → Test Files 1 passed (1) / Tests 15 passed (15)
```

### 通过项

| 用例 | 验证内容 | 结果 |
|---|---|---|
| R2-A1 | 门清 13 张听牌可识别 | ✅ |
| R2-B1 | 基准番值：清一色 2 / 七对子 2 / 龙七对 3（与 GDD 一致；龙七对正确替代七对子不叠加） | ✅ |
| R2-B5 | 计分公式 `5×2^(番+杠−1)`：平胡 1 番=5、+1 杠=10、+2 杠=20；清一色=10；龙七对=20；龙七对+双杠=80 | ✅ |
| R2-C1 | 天胡 4 番 / 地胡 4 番按参数正确注入 | ✅ |
| R2-C3 | 天胡窗口成立：P0 起手 14 张、P1–P3 各 13 张、`turn=0` | ✅ |
| R2-C4 | **地胡窗口可达**（见下） | ✅ |
| R2-D2 | 三家胡牌（非流局）**不触发**查花猪/查大叫，四家均 0 分 | ✅ |
| R2-D3 | `hasQueYiMen` 正确联合判定手牌 + 副露 | ✅ |

**R2-C4 地胡可达性验证**（曾疑为死代码，实测排除）：

```
[R2-C4 地胡窗口可达性] 事件标签（applyAction 前）=「turn0 P0 DISCARD T7」；反应结算时点 state.turn=1
  地胡条件要求 turn===1 → 窗口可达 ✓
```

> 排查笔记：`地胡` 条件为 `state.turn === 1 && discard.from === 'P0'`（`index.ts:1131`）。事件轨迹标签显示 `turn0`，初判"窗口不可达"；但 `resolveReactions` 读取的是 `applyAction` **之后**的 turn（已自增为 1）。经 `scripts/qa-probe-dihu-window.ts` 三 seed 交叉验证，**窗口确实可达，非缺陷**。

### 发现的问题

---

#### 🔴 QA-P1-003 `isTenpai` 硬编码 13 张 → 有副露的玩家流局时被误判"大叫"并倒扣分

| 字段 | 内容 |
|---|---|
| **级别** | **P1 严重**（错误罚分，直接影响结算公正性与教学正确性） |
| **位置** | `src/core/rules/packs/chengdu/tenpai.ts:11` — `if (hand.length !== 13) return []` |
| **影响面** | `isTenpai` / `getTenpaiTiles` / `countUkeire`，以及 `index.ts:1401-1402` 的查大叫分类与 `calcMaxTenpaiScore` |

**根因**

```ts
// tenpai.ts:10-13
export function getTenpaiTiles(hand: Tile[]): Tile[] {
  if (hand.length !== 13) {
    return [];          // ← 有副露的玩家手牌为 10/7/4 张，一律被判「未听牌」
  }
```

对比 `findWinPatterns` 已正确支持 `3n+2`（2/5/8/11/14 张），说明**支持副露的能力本就存在**，仅 `getTenpaiTiles` 的入口校验过严。且 `calcMaxTenpaiScore`（`index.ts:1338-1346`）已正确算出 `expectedHandSize = 13 − meldCount*3`，随后却调用只认 13 张的 `getTenpaiTiles` —— 同一函数内两套口径自相矛盾。

**复现步骤**

```bash
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-A3
```

构造流局态（全员定缺 `T` 且无人持 `T`，排除花猪干扰）：

| 玩家 | 手牌 | 副露 | 实际状态 |
|---|---|---|---|
| P0 | `W123456789 B1122`（13 张） | — | 听牌（听 B1/B2） |
| P1 | `W123456789 B1`（10 张） | 碰 `B999` | **实质听牌（听 B1）** |
| P2 | `W1379 B24689 B1357` | — | 未听牌 |
| P3 | `W2468 B13579 B2468` | — | 未听牌 |

前置已在测试中断言：`isTenpai(P0)===true`、`isTenpai(P2)===false`、`isTenpai(P3)===false`，且 `findWinPatterns([...P1手牌, B1])` 有效 → P1 确为听牌。

**实际结算**

```
[R2-A3 流局查大叫结算] scores=P0:15 P1:-5 P2:-5 P3:-5 Σ=0
  P0 门清听牌 → 受偿；P1 副露实质听牌却被当作「大叫」赔付；P2/P3 真未听牌赔付
```

**预期**：P1 已听牌，应与 P0 同属受偿方。
**实际**：`isTenpai(10 张)` 返回 `false` → P1 被归入"未听牌"阵营，**倒扣 5 分**。

**副作用**：`calcMaxTenpaiScore` 对副露玩家恒返回 0 → 有副露的听牌玩家在查叫中**既拿不到赔付，又要付钱**。这对"碰杠打法"的玩家形成系统性歧视，而碰杠恰是成都麻将的核心玩法。

**修复建议**

```ts
// 建议签名：显式接受副露数
export function getTenpaiTiles(hand: Tile[], meldCount = 0): Tile[] {
  const expected = 13 - meldCount * 3;      // 13 / 10 / 7 / 4
  if (hand.length !== expected) return [];
  // findWinPatterns 已支持 3n+2，testHand = hand + 1 张 → 14/11/8/5，无需其他改动
```

1. `isTenpai(hand, meldCount)`、`countUkeire(hand, remaining, meldCount)` 同步加参。
2. `applyDrawSettlement`（`index.ts:1401-1402`）改为 `isTenpai(state.hands[pid], state.melds[pid].length)`。
3. `calcMaxTenpaiScore` 内的 `getTenpaiTiles(hand)` 传入 `meldCount`（该函数已算出，直接传即可）。
4. **回归测试**：R2-A2 / R2-A3 为特征化测试，修复后会失败 → 届时反转断言为"P1 应受偿"。

---

#### 🔴 QA-P1-004 七对分支提前 `return`，清一色不叠加 → 清七对少算一半分

| 字段 | 内容 |
|---|---|
| **级别** | **P1 严重**（计分错误 + 教学错误） |
| **位置** | `src/core/rules/packs/chengdu/patterns.ts:240-253` |

**根因**

```ts
// patterns.ts:240
if (pattern.groups.length === 7 && pattern.groups.every(g => g.type === 'JIANG')) {
  ...（七对子 / 龙七对 + 自摸 + 杠上开花 + 抢杠 + 海底）
  return yakuList;          // ← 提前返回
}
const suits = new Set(hand.map(t => t.suit));
if (suits.size === 1) { yakuList.push({ type:'QING_YI_SE', fan:2, ... }); }  // ← 永不执行
```

**复现步骤**

```bash
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-B2
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-B3
```

| 场景 | 手牌 | 实际番型 | 实际分 | 线下应为 | 应得分 | 差额 |
|---|---|---|---|---|---|---|
| 清七对 | `W11223344556677` | `QI_DUI_ZI(2)` = **2 番** | **10** | 七对子 2 + 清一色 2 = 4 番 | 20 | **少 50%** |
| 清龙七对 | `W11112233445566` | `LONG_QI_DUI(3)` = **3 番** | **20** | 龙七对 3 + 清一色 2 = 5 番 | 40 | **少 50%** |

实测输出：

```
[R2-B2 清七对番型] QI_DUI_ZI(2) = 2 番，底分结算=10
[R2-B3 清龙七对番型] LONG_QI_DUI(3) = 3 番
```

**教学面同步失效**（轮次 3 R3-T7 交叉验证）：

```
[R3-T6 叠加规则教学缺口] 文案含「清一色 + 对对胡可叠加」但未说明「七对子/龙七对会屏蔽清一色」；
  代码 detectYaku 在七对分支提前 return。
  → 学习者据文案推算「清七对 = 七对2 + 清一色2 = 4番 = 20分」，实际结算 10 分（2番）。
```

`RuleContext.ts` 的番型互斥说明**只写了**「龙七对替代七对子（不叠加）」和「清一色 + 对对胡可叠加」，**从未声明七对会屏蔽清一色**。学习者按文案推算必然得到 20 分，实际拿到 10 分 —— 教学平台给出了错误的期望。

**修复建议（需产品/设计决策，建议由 team-lead 转 文策渊 定夺）**

- **方案 A（推荐，符合线下成都麻将）**：把七对分支的 `return` 改为 `continue` 语义 —— 抽出通用番型（清一色/杠上开花/抢杠/海底/自摸）到分支之外统一叠加，仅让「龙七对 vs 七对子」互斥。
- **方案 B（保留现口径）**：代码不动，但必须在 `RuleContext.ts` 与 UI 明确写出「七对子/龙七对不与清一色叠加」，消除教学误导。
- **无论选哪个方案**，`RuleContext.ts` 的"番型互斥与叠加"章节都必须补齐屏蔽关系；当前状态是**代码与文案互相矛盾**，这是教学产品不可接受的。

---

#### 🔴 QA-P1-005 清一色判定不计入副露花色 → 「假清一色」多送 2 番

| 字段 | 内容 |
|---|---|
| **级别** | **P1 严重**（计分错误，可被利用刷分） |
| **位置** | `patterns.ts:255` — `const suits = new Set(hand.map(t => t.suit))`；`detectYaku` 签名中**无 `melds` 参数** |

**根因**：真实调用路径 `evaluateSelfDrawScore`（`index.ts:202-204`）传入的 `testHand` 就是 `state.hands[playerId]` —— **不含副露**。因此 `suits` 集合永远只统计暗手牌花色，副露是什么花色完全不参与判定。

**复现步骤**

```bash
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-B4
```

1. 玩家有 1 副碰 `T111`（条子），手牌 11 张全为万字：`W111 W234 W567 W99`。
2. `findWinPatterns(11 张)` 成立（该函数支持 `3n+2`）。
3. `detectYaku(pattern, handAllW, W9, selfDraw=true, meldCount=1, ...)`。

**实际输出**

```
[R2-B4 假清一色] 手牌 11 张全万 + 碰 T111 → detectYaku(meldCount=1) 仍判
  QING_YI_SE(2) + ZI_MO(1) + JIN_GOU_DIAO(2)；清一色 +2 番为误判（detectYaku 签名中无 melds 参数）
```

**预期**：完整牌型为「万 + 条」混色，**不是清一色**，应为 `ZI_MO(1) + JIN_GOU_DIAO(2) = 3 番 → 20 分`。
**实际**：判为 5 番 → **40 分，翻倍超付**。

**放大效应**：`meldCount=1` 已明确告知存在副露，函数却仍判清一色 —— 说明这不是罕见边界，而是**只要"手牌同色 + 副露异色"就必然发生**。碰牌在成都麻将中极其常见（轮次 1 的 12 局共出现 33 次副露）。

**修复建议**

```ts
export function detectYaku(
  pattern: WinPattern,
  hand: Tile[],
  winTile: Tile,
  isSelfDraw: boolean,
  _meldCount: number,
  ...,
  melds: Array<{ tile: Tile }> = [],   // ← 新增
) {
  const suits = new Set([...hand, ...melds.map(m => m.tile)].map(t => t.suit));
```

1. 同步修正 4 处调用点：`index.ts:202`（自摸）、`1007`、`1132`（点炮/抢杠）、`1361`（查叫）。
2. 顺带修正 `hasQueYiMen` 已正确处理副露的做法 —— 二者应保持一致口径。
3. **回归测试**：R2-B4 为特征化测试，修复后失败 → 届时反转为断言 `QING_YI_SE` 不存在。

---

#### 🟡 QA-P2-006 金钩钓口径与线下成都麻将不一致（内部三处自洽）

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般**（内部自洽，属产品口径选择，但教学平台须明示） |
| **位置** | `patterns.ts:286-290` |

**现状**：实现仅判「胡牌张出现在将牌组中」，**不要求全部副露**。

```
[R2-C2 金钩钓口径] 门清（meldCount=0）胡将牌即得 2 番。线下成都麻将通常要求「全部副露、仅剩单吊将」。
  文档/LLM/代码三处口径一致（自定义口径），但与线下规则不一致 → 教学平台需在 UI 明示。
```

**内部一致性核查（全部一致 ✅）**：`RULES_CHENGDU.md:280`、`RuleContext.ts:67`、`RuleContext.ts:188`、`patterns.ts:41/286` 均写「胡牌张出现在将牌组中」。

**风险**：线下成都麻将「金钩钓」指**全部副露后单吊将牌**。当前实现下，门清 4 面子 + 单吊将也算金钩钓（R2-B4 的例子就顺带拿到了这 2 番）。学习者在本平台养成的番型认知，到线下牌桌会算错分 —— 对教学平台是实质风险。

**修复建议**：由 文策渊 决策二选一 ——（A）改判定为 `hand.length === 1`（除将牌外全副露）；（B）保留口径，但在 UI 番型说明与 LLM 讲解中显式标注「本平台口径：胡牌张在将牌组即可，与部分线下规则不同」。**不建议维持现状且不说明。**

---

#### 🟡 QA-P2-007 查花猪与查大叫叠加后净额为 0，结算界面产生"花猪没赔我钱"的错觉

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般**（体验/可理解性） |
| **位置** | `index.ts:1381-1413` — `applyDrawSettlement` |

**复现步骤**

```bash
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts -t R2-D1
```

P0 为花猪（定缺 T 但持 `T111 T1`），P1 听牌，P2/P3 未听牌：

```
[R2-D1 查花猪+查大叫叠加结算] scores=P0:-15 P1:15 P2:0 P3:0 Σ=0
  P2 净额=0 P3 净额=0（查花猪 +N 与查大叫 -N 相抵）
```

**明细拆解**：查花猪阶段 P0 向 P1/P2/P3 各赔 5（P0 −15）；查大叫阶段 P2/P3（未听牌）各向 P1 赔 5。P2 = +5−5 = **0**，P3 同理。

**问题**：结算逻辑本身正确且零和，但 UI 若只显示净额，玩家会认为"我抓到花猪却一分没得"，无法理解两笔独立罚分。

**修复建议**：结算界面按**科目分行展示**（查花猪收/付、查大叫收/付、净额），而非只给一个总数。这也直接服务教学目标 —— 让玩家看懂两条独立规则。

### 轮次 2 小结

基准番值、计分公式、天胡/地胡窗口、查花猪零和性**全部正确**；但**听牌判定（副露）**、**七对与清一色叠加**、**清一色对副露的忽略**三处存在实质计分错误，全部为 P1。

---

# 轮次 3：难度梯度 + 教学准确性

### 目标

- **A 教学准确性**：从源码解析番值真相源，与 LLM 教学文案**逐项**对照，杜绝"文档 > 代码"漂移。
- **B 难度梯度**：验证 high/mid/low 是否产生**可测量**的强弱差异，以及是否可复现。

### 执行场景

`tests/playtest-round3-difficulty-and-teaching.test.ts` — 12 用例（T 组教学 7 项 + D 组难度 5 项）。

```bash
pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts
# → Test Files 1 passed (1) / Tests 12 passed (12)
```

**方法**：直接读取 `patterns.ts` 源码，正则解析 `type/fan/description` 三元组作为真相源，再与 `CHENGDU_RULES` 的 markdown 番值表、`getYakuExplanation` 映射表比对。**测试随源码自动更新，不会因硬编码而失效。**

`decideLow` 使用裸 `Math.random()`，故对抗测试中以 xorshift32 临时替换 `Math.random` 保证可复现（该事实本身记为 QA-P2-009）。

### 通过项

| 用例 | 验证内容 | 结果 |
|---|---|---|
| R3-T1 | 真相源可解析：清一色 2 / 七对子 2 / 龙七对 3 / 天胡 4 / 地胡 4，共 ≥14 项 | ✅ |
| **R3-T2** | **LLM 番值表 vs `patterns.ts` 逐项对照：`代码 14 项 / 文案 14 项，差异 0 处（全部一致）`** | ✅ |
| R3-T5 | `PromptBuilder.ts:168` 番值文案已对齐（历史「清一色 3 番」已修正为 2 番，门清明确不单独计番）→ **确认设计评审 BLOCK-1 修复有效** | ✅ |
| R3-T6 | 文案计分示例与 `calculateScore` 一致：`平胡+自摸=2番→5×2^1=10`✓；`清一色+对对胡+自摸+1杠=6番→5×2^5=160`✓ | ✅ |
| R3-D1 | 参数巡检：mid `dangerWeightMul:0.5`；low `dangerWeightMul:0.3 + efficiencyWeightMul:0.7 + randomness:0.3`；三档策略非同一引用 | ✅ |
| R3-D4 | 三档均能稳定终局，零兜底触发 | ✅ |

**R3-D4 三档稳定性**：

```
high 终局=WALL_EMPTY/THREE_HU  胡牌总数=5 兜底触发=0 步数=179/141
mid  终局=WALL_EMPTY/THREE_HU  胡牌总数=5 兜底触发=0 步数=179/141
low  终局=WALL_EMPTY/WALL_EMPTY 胡牌总数=1 兜底触发=0 步数=182/183
```

> 注：`high` 与 `mid` 在这 2 个 seed 上轨迹完全相同（步数 179/141 一致）—— 因 `decideMid` 仅把 `dangerWeightMul` 从 1 降到 0.5，在这些局面下未改变 argmax 结果。样本过小，不足以判定 mid 无效，但提示**mid 档与 high 的区分度可能偏弱**，建议扩大样本复核（见 QA-P2-010 修复建议）。

### 证据：难度强弱对抗（每组 8 局，`Math.random` 已固定种子）

```
[R3-D3 难度强弱对抗（每组 8 局 / Math.random 已固定种子）]
  P0=high vs P1-3=low : 胡牌率=6/8 (75%) | 总分=-70 均分=-8.8 极差=440 | 明细=40,30,30,120,10,-320,15,5
  P0=low  vs P1-3=high: 胡牌率=3/8 (38%) | 总分=55  均分=6.9  极差=390 | 明细=0,230,30,5,-10,-50,-160,10

  ① 胡牌率梯度：high 6/8 vs low 3/8 → 方向正确 ✓
  ② 得分梯度：high 均分 -8.8 vs low 均分 6.9 → 方向相反 ✗（被流局罚分离群值反转）
  ③ 单组得分极差 high=440 low=390；远大于均分绝对值 → 8 局样本下得分无统计意义
```

**结论（两条独立）**：
- ✅ **难度梯度真实存在**：胡牌率 75% vs 38%，方向正确、差距显著（≈2 倍）。
- ❌ **玩家无法通过分数感知难度**：单局得分极差高达 440（`-320` 与 `+120`/`+230` 并存），完全淹没技术差异，甚至使得分排名反转。

### 发现的问题

---

#### 🔴 QA-P1-006 「刮风下雨」标识符含西里尔字母 `А`(U+0410)，番型讲解输出「未知番型」

| 字段 | 内容 |
|---|---|
| **级别** | **P1 严重**（教学功能直接失效，且污染已扩散至文件名） |
| **位置** | `patterns.ts:42` / `patterns.ts:293` vs `src/llm/RuleContext.ts:190` |

**根因**：同一番型在两处用了**视觉相同但码点不同**的标识符。

| 文件 | 标识符 | 逐字符码点 |
|---|---|---|
| `patterns.ts:42/293`（`YakuType` 与 `detectYaku` 产出） | `GUAFENG_XIАYU` | `GUAFENG_XIА(U+410)YU` ← **西里尔大写 А** |
| `RuleContext.ts:190`（`getYakuExplanation` 查表键） | `GUAFENG_XIAYU` | `GUAFENG_XIAYU` ← 纯拉丁 |

→ `detectYaku` 产出 `type: 'GUAFENG_XIАYU'`，`getYakuExplanation('GUAFENG_XIАYU')` **查表未命中**，返回兜底串。

**复现步骤**

```bash
pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts -t R3-T3
```

实测输出：

```
[R3-T3 番型讲解缺口] YakuType 共 15 项，其中 2 项无讲解：
  "GUAFENG_XIАYU" → GUAFENG_XIА(U+410)YU → getYakuExplanation() 返回「GUAFENG_XIАYU: 未知番型」
  "HUN_YI_SE" → HUN_YI_SE → getYakuExplanation() 返回「HUN_YI_SE: 未知番型」
```

**用户可见后果**：玩家以刮风下雨（明杠）胡牌后，AI 讲解界面显示 **「GUAFENG_XIАYU: 未知番型」** —— 教学平台的核心交付物在这条路径上完全失效。

**污染扩散范围**（已扩散到文件名，风险高于普通 typo）：

| 位置 | 字符 |
|---|---|
| `src/core/rules/packs/chengdu/patterns.ts:42, 293` | `А` U+0410（大写） |
| `tests/guafeng-xiаyu.test.ts`（**文件名**） | `а` U+0430（小写） |
| `GUAFENG_XIА YU_IMPLEMENTATION.md`（**文件名**） | `А` U+0410 |
| `design/gdd/rule-engine.md:40` | `А` U+0410（文档已沿用错误拼写） |

**额外风险**：文件名含非 ASCII 西里尔字母在跨平台（macOS 的 NFD 规范化 / Linux / Windows）与 git 索引间易产生"同名不同码点"的幽灵文件与检出失败，且 `grep GUAFENG_XIAYU` 永远搜不到真正的定义 —— 已经造成 `RuleContext` 漏配这一实际后果。

**修复建议**
1. **全仓统一为纯拉丁 `GUAFENG_XIAYU`**：改 `patterns.ts` 的 `YakuType` 与 `detectYaku` 产出，`git mv` 重命名测试文件与文档文件，同步 `design/gdd/rule-engine.md`。
2. **加 CI 护栏**：禁止 `src/**` 标识符与仓库文件名出现非 ASCII 字符（`rg -n '[^\x00-\x7F]' --glob '*.ts'` 排除中文注释/字符串后应为空）。
3. **加通用回归**：断言 `YakuType` 联合类型中每一项都能在 `getYakuExplanation` 命中（R3-T3 已实现该检查，修复后反转断言为 `missing.length === 0`）。

---

#### 🟡 QA-P2-008 混一色三重缺口：已声明、不计分、无讲解（设计评审遗留 CONCERN C4 仍未落地）

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般** |
| **位置** | `patterns.ts:31`（`YakuType` 声明）；`detectYaku` 无加分分支；`RuleContext.ts` 无讲解条目 |

```
[R3-T4 混一色三重缺口] YakuType 已声明 ✓ / detectYaku 无加分分支 ✗ / getYakuExplanation 无条目 ✗
  → 与 design/gdd/REVIEW.md C4「二选一（实现或删除）」结论一致，仍未落地。
```

**新增信息**：设计评审记录了「声明但未计分」，本轮进一步发现**教学讲解也缺条目** —— 若后续实现计分，讲解会立刻输出「未知番型」（与 QA-P1-006 同一故障模式）。另 `expectedValue.ts:87` 已有 `suits.size === 2 → estimatedFan += 1 // 可能混一色`，即**AI 估值层已在按混一色计 1 番估算**，而结算层不计分 —— 估值与结算口径不一致。

**修复建议**：执行 REVIEW C4 的二选一。
- 实现：`detectYaku` 加分支（需 文策渊 定番值），**同时**补 `getYakuExplanation` 条目 + `CHENGDU_RULES` 表格行，并核对 `expectedValue.ts:87` 的估值番数。
- 删除：从 `YakuType` 移除 `HUN_YI_SE`，清理 `expectedValue.ts:87` 的估值假设与所有文档提及。

---

#### 🟡 QA-P2-009 low 档使用裸 `Math.random()` → 同 seed 不可复现，回放/分享不可靠

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般**（影响回放功能可信度与 bug 可复现性） |
| **位置** | `src/agents/algo/policy_high.ts:485` — `if (opts?.randomness && ... && Math.random() < opts.randomness)` |

**复现步骤**

```bash
pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts -t R3-D2
```

```
[R3-D2 low 档可复现性] seed=3001 两次运行签名：
  #1 183|20,-5,-20,5
  #2 182|20,-30,10,0
  → 不一致（同一 seed 无法复现，回放/对局分享功能不可靠）
  对照：high 档同 seed 两次运行完全一致 ✓
```

**问题**：对局其余部分（洗牌、high/mid 决策）均由 seed 完全决定、可复现；唯 low 档的 30% 随机偏离走全局 `Math.random`，不受 seed 控制。后果：
- **回放页无法忠实重演** low 档对局（产品已有 replay 页面）。
- 玩家报的 low 档 bug **无法凭 seed 复现**，QA 与研发都失去抓手。

**修复建议**：把随机源注入化 —— 决策上下文携带 `rng: () => number`，由 `buildInitialState` 的同一 seed 派生（可复用现有 `shuffle(tiles, seed)` 的 PRNG）。`policy_high.ts:485` 改用 `ctx.rng()`。**回归测试**：R3-D2 为特征化测试，修复后失败 → 届时反转为断言两次运行一致。

---

#### 🟡 QA-P2-010 结算方差过大（单局极差 440）→ 难度体感无法通过分数感知

| 字段 | 内容 |
|---|---|
| **级别** | **P2 一般**（平衡性/体验，建议转 文策渊） |
| **证据** | 见上方 R3-D3 输出；另轮次 1 seed=1008 出现 `scores=-5/320/15/-330` |

**问题**：流局查花猪/查大叫的罚分按「听牌玩家最大可能得分」逐家结算，而最大得分走 `5 × 2^(番+杠−1)` 指数公式。R2-B5 已实测「龙七对 + 双杠 = 5 番 = 80 分」，再乘以逐家赔付即可轻易到 ±300 以上。

后果链条：
1. 单局得分极差 440，而技术差异带来的均分差仅约 15 分 → **信噪比 ≈ 1:30**。
2. 玩家切换 high/mid/low 后，**从分数上完全感知不到难度变化**（实测得分排名甚至反转），而胡牌率其实差了 2 倍。
3. 教学平台的正反馈失效 —— 学习者无法从分数判断自己是否进步。

**修复建议（需 文策渊 决策）**
1. 为流局罚分设**封顶**（如单笔 ≤ 底分 ×16），或对查叫罚分改用线性/对数计算而非直接复用指数胡牌分。
2. UI 侧把**胡牌率/听牌率**作为主要进步指标展示，分数作为次要指标 —— 胡牌率已实测为方差可控的有效信号（75% vs 38%）。
3. 扩大样本复核 mid 档区分度（R3-D4 中 high/mid 在 2 seed 上轨迹完全相同）；建议 100 局量级跑一次三档循环赛，以胡牌率为指标校准 `dangerWeightMul`。

---

#### 🔵 QA-P3-013 构建告警：`renameSync` 在浏览器环境不可用 + 动态/静态混合导入

| 字段 | 内容 |
|---|---|
| **级别** | **P3 轻微** |
| **证据** | `npx vite build` 输出 |

```
src/training/paramPersistence.ts (98:9): "renameSync" is not exported by "__vite-browser-external",
  imported by "src/training/paramPersistence.ts".
(!) src/agents/algo/aiParams.ts is dynamically imported by src/ui/pages/settings.ts
  but also statically imported by ... dynamic import will not move module into another chunk.
(!) src/training/paramPersistence.ts is dynamically imported ... （同上）
```

**问题**：`paramPersistence.ts` 引用 node 的 `renameSync`，被打进浏览器产物。若该路径在生产被触达会直接抛错（当前疑似仅训练模式走到，故未暴露）。动态/静态混合导入使 `settings.ts` 的懒加载失效，代码分割未生效。

**修复建议**：`paramPersistence.ts` 中的 node fs 操作用 `import.meta.env.SSR` / 运行时能力检测隔离，或拆分为 `paramPersistence.node.ts` / `.browser.ts`；统一 `aiParams.ts` 与 `paramPersistence.ts` 的导入方式（全静态或全动态）以恢复分包。

### 轮次 3 小结

**教学准确性主干是可靠的** —— 番值表 14 项与真相源**零差异**，计分示例精确匹配，`PromptBuilder` 历史缺陷确认已修。但存在 1 个 P1（西里尔字母导致讲解失效）与 1 个 P2（混一色三重缺口）。**难度梯度在胡牌率维度方向正确且显著（75% vs 38%）**，但结算方差过大使玩家无法从分数感知难度。

---

# 附录 A：UI 流可达性

本轮沿用既有契约测试（未新增），确认四个页面渲染契约完好：

```bash
pnpm vitest run tests/uiPages.contract.test.ts
```

| 用例 | 覆盖 |
|---|---|
| `home page includes core shell classes` | 首页 |
| `match page includes toolbar and content classes` | 对局页 |
| `settings page includes shell and section classes` | 设置页 |
| `replay page includes log section classes` | 回放页 |

**结论**：首页 → 设置 → 对局 → 回放 四页渲染契约 **PASS**。

> ⚠️ **覆盖缺口（诚实声明）**：契约测试仅校验 DOM 类名存在，**不覆盖交互态流转**（按钮点击、页面跳转、对局中状态同步）。真实的"首页→设置→对局→回放"端到端可达性**本轮未被自动化覆盖**，亦无 Playwright/Cypress 等 E2E 设施。此外 QA-P2-009（low 档不可复现）意味着**回放页无法忠实重演 low 档对局** —— 该功能的正确性尚未被验证。建议后续补 E2E 冒烟。

---

# 附录 B：新增测试资产清单

| 文件 | 类型 | 用例数 | 说明 |
|---|---|---|---|
| `tests/playtestHarness.ts` | 工具模块（非 `*.test.ts`，不被收集） | — | headless 对局驱动器：seed 可复现、7 类不变量守卫、`deadlockGuard`/`invariants`/`trace` 开关、`guardFires` 统计、`firstP0DiscardReactionTurn` 采集 |
| `tests/playtest-round1-core-loop-invariants.test.ts` | 测试 | 14 | 轮次 1：核心循环与不变量（含纯规则层活锁复现） |
| `tests/playtest-round2-boundary-and-scoring.test.ts` | 测试 | 15 | 轮次 2：边界场景与计分正确性 |
| `tests/playtest-round3-difficulty-and-teaching.test.ts` | 测试 | 12 | 轮次 3：难度梯度 + 教学准确性 |
| `scripts/qa-diagnose-livelock.ts` | 临时诊断脚本 | — | 定位 P0-001/002 根因（活锁）。**建议保留**为规则层调试工具，P0 修复后可删除 |

> 另有临时脚本 `scripts/qa-probe-dihu-window.ts`（探测地胡触发窗口可达性）已在结论固化为 R2-C4 后**删除**，不留冗余产物。

**合计新增 41 个用例，全部通过。** `src/**` 生产代码**零改动**（严格遵守"不修改现有玩法逻辑源码"约束）。

### 关于"特征化测试"的说明

本轮约束为**不修改玩法源码** + **保持 `pnpm test:run` 全绿**，二者叠加意味着不能用红色测试表达缺陷。故对每个已知缺陷采用**特征化测试 + 回归绊线**：

- 断言**当前（有缺陷的）实际行为**，用例名标注 `【已知缺陷 QA-xxx】`。
- 断言消息统一为 `"QA-xxx 疑似已修复：请更新本测试与 PLAYTEST_REPORT"`。
- 效果：套件保持绿；**一旦有人修好缺陷，该断言立即失败**，强制同步更新测试与本报告 —— 缺陷不会被静默修掉而报告失去时效。

涉及用例：R1-10、R1-14、R2-A2、R2-A3、R2-B2、R2-B3、R2-B4、R2-C2、R3-T3、R3-T4、R3-T7、R3-D2、R3-D3。

**这不是掩盖缺陷** —— 每条都在 `console.info` 打印完整证据（番型明细/结算分数/字符码点），且在本报告中有对应工单与修复建议。

---

# 质量门判定与阻塞项

## 判定：🔴 **FAIL**

判定依据（见 [test-plan.md §7](./test-plan.md)）：`存在 P0` → FAIL；`存在影响核心教学正确性且无绕行方案的 P1` → FAIL。**两条均成立。**

## 阻塞项（必须修复方可放行）

| # | 编号 | 级别 | 一句话 | 阻塞理由 |
|---|---|---|---|---|
| 1 | QA-P0-001 | P0 | 加杠后规则层无人可推进，对局活锁 | 12 局采样 25% 命中；关闭兜底 100% 卡死。可玩性依赖编排层兜底掩盖 |
| 2 | QA-P0-002 | P0 | `getLegalActions` 提供 `applyAction` 会拒的动作 → 空转卡死 | 状态机契约破损；静默 `return state` 是活锁温床 |
| 3 | QA-P1-003 | P1 | 副露玩家流局时被误判"大叫"倒扣分 | 结算不公；系统性歧视碰杠打法（成都麻将核心玩法） |
| 4 | QA-P1-004 | P1 | 清七对/清龙七对少算 50% 分，且教学文案与代码互相矛盾 | 教学平台教错番值＝核心价值失效 |
| 5 | QA-P1-005 | P1 | 副露异色仍判清一色，多送 2 番（分数翻倍） | 计分错误且高频（12 局出现 33 次副露） |
| 6 | QA-P1-006 | P1 | 「刮风下雨」讲解输出「未知番型」（西里尔字母 U+0410） | 教学功能直接失效；污染已扩散至文件名，有跨平台风险 |

## 非阻塞项（建 Backlog）

| 编号 | 级别 | 一句话 | 建议归口 |
|---|---|---|---|
| QA-P2-006 | P2 | 金钩钓口径与线下不一致（内部三处自洽） | 文策渊（口径决策）+ UI 明示 |
| QA-P2-007 | P2 | 查花猪/查大叫叠加后净额为 0，结算界面误导 | UI 分科目展示 |
| QA-P2-008 | P2 | 混一色：已声明/不计分/无讲解，且估值层已按 1 番估算 | 文策渊（REVIEW C4 二选一） |
| QA-P2-009 | P2 | low 档裸 `Math.random` → 同 seed 不可复现，回放不可靠 | 程基岩（RNG 注入化） |
| QA-P2-010 | P2 | 结算方差过大（极差 440），难度体感无法通过分数感知 | 文策渊（罚分封顶）+ UI（改用胡牌率指标） |
| QA-P2-011 | P2 | DeadlockGuard 掩盖规则层缺陷，33% 对局"伪正常" | 程基岩（P0 修完后降级为告警） |
| QA-P3-012 | P3 | 热路径裸 console.log 372 次/局（全 src 171 处） | 程基岩（引入 logger 分级） |
| QA-P3-013 | P3 | 构建告警：`renameSync` 进浏览器产物 + 动态/静态混合导入 | 程基岩 |

## 建议修复顺序

1. **第一批（解除 FAIL，2 个 P0）**：QA-P0-001、QA-P0-002。二者同属"规则层状态机契约"，建议一并修并配 `deadlockGuard:false` 门禁测试。
2. **第二批（教学正确性，4 个 P1）**：QA-P1-006（改标识符，改动最小、收益立竿见影）→ QA-P1-003（`getTenpaiTiles` 加 `meldCount` 参数）→ QA-P1-005（`detectYaku` 加 `melds` 参数）→ QA-P1-004（**需先由 文策渊 定叠加口径**，再改代码或改文案）。
3. **第三批**：P2/P3 按上表归口进 Backlog。

## 复跑验证方式

```bash
npx tsc --noEmit                                                       # 期望 0 错误
pnpm test:run                                                          # 期望 32 文件 / 215 用例全绿
pnpm vitest run tests/playtest-round1-core-loop-invariants.test.ts     # 轮次 1（14）
pnpm vitest run tests/playtest-round2-boundary-and-scoring.test.ts     # 轮次 2（15）
pnpm vitest run tests/playtest-round3-difficulty-and-teaching.test.ts  # 轮次 3（12）
```

> **修复上述缺陷后，对应的特征化测试会转为失败** —— 这是设计意图。届时请按每条断言消息的提示，反转断言并同步更新本报告。

---

> **质量门为 advisory（建议性）**：以上判定与依据由 QA 提供，**最终是否放行由用户（产品负责人）决定**。若因排期需要带 P1 发布，建议至少先修 QA-P1-006（改动量最小）并在 UI 明确标注「番型计分口径以本平台结算为准」，以降低教学误导风险。
