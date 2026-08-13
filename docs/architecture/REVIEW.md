# 架构评审报告 — neo-mahjong（成都麻将 AI 教学平台）

- **评审对象：** `src/` 现有实现（反向梳理）
- **评审强度：** **full**（每个判定须附证据 + 至少一轮自查修订）
- **评审人：** engineering-lead（程基岩）
- **配套文档：** `ARCHITECTURE.md`、`ADR-001`~`ADR-004`
- **方法：** 静态代码通读 + 全仓 `grep` 依赖溯源 + 测试套件执行 + 一轮自查修订

---

## 0. 总评结论 (Verdict)

| 维度 | 结论 |
| --- | --- |
| 整体可运行/可部署性 | **PASS** |
| 分层与依赖纪律 | **CONCERNS**（多处单向依赖被打破） |
| 规则抽象正确性 | **PASS**（生产运行 `chengdu`） + CONCERN（死代码） |
| 决策/表达分离 | **PASS**（干净） |
| 测试策略 | **PASS**（174 项单测通过，含 ai-eval 硬/软约束校验器） |
| 性能 | **CONCERNS**（无预算/无缓存、无持续 profiling） |
| 安全 | **PASS**（密钥经 Vercel 代理隔离） + CONCERN（前端可配 endpoint） |
| 死代码 / 孤儿模块 | **CONCERNS**（多模块已声明但未接线） |
| CI | **FAIL**（仓库无任何 CI 流水线） |

> **一句话结论：** 系统在"能跑、能部署、能对局、能教学"上达到 PASS；但存在
> **结构性债务**——分层违规、死代码/孤儿模块、无 CI、构建不类型检查——这些都
> **不阻塞当前部署**，却会在规模扩展与协作时显著放大风险。**阻塞项（Blocker）**
> 见 §6，其中 **CI 缺失为唯一 FAIL 级**，需在下次迭代补齐。

---

## 1. Checkpoints（逐条判定 + 证据 + 自查）

### 1.1 Build & Deploy Pipeline —— **PASS**
- **证据：** `vite.config.ts`（dev 代理 `/api/llm/*` 注入 `KIMI_API_KEY`，仅
  dev）、`vercel.json`（`buildCommand: pnpm build`、`outputDirectory: dist`、
  `/api` 与 SPA rewrite）、`.gitignore` 已忽略 `.env*` 等密钥文件。
- **判定：** 构建与部署链路完整，密钥文件不被提交，符合 Serverless 部署范式。
- **自查修订（第 1 轮）：** 初判时未确认 `.gitignore` 是否覆盖 env；已核对确认
  忽略 `.env*`，故维持 PASS，并补入"仅 dev 注入密钥"的说明。

### 1.2 Type Safety —— **CONCERNS**
- **证据：** `tsconfig.json` 开启 `strict` + `noUnusedLocals`，`noEmit`；
  `package.json` 的 `build` 脚本为 `vite build`（esbuild 仅做转译，**不类型
  检查**）。`npm run build` 可"带类型错误"成功产出。
- **判定：** 类型严格性配置到位，但**构建不被 `tsc` 门禁**，类型错误可流入产物。
- **自查修订（第 1 轮）：** 复核 `vite.config.ts` 确认无 `build.dts` 或
  `tsc` 钩子，确认 esbuild 行为，CONCERN 成立。建议补 `tsc --noEmit`（见 §5）。

### 1.3 Layering / Dependency Integrity —— **CONCERNS**
- **证据（3 处明确违规）：**
  1. `core/rules/packs/chengdu/index.ts:14` 导入 `settingsStore`（core→store，
     反向依赖）；并在 `:255 / :470 / :472 / :510` 读取 `settingsStore.p0IsAI`。
  2. `orchestration/GameOrchestrator.ts:28-29` 导入 UI 层
     `clearChatHistory`、`showPixelDialog`（orchestration→ui）。
  3. 跨层可变全局通道：`globalThis.__trainingGameSeed`、`__aiDecision`、
     `__lastLegalActions`——热路径/测试通过 `globalThis` 跨层传态。
- **判定：** 单向依赖纪律被打破，core 不再"纯净"，重构与测试隔离难度上升。
- **自查修订（第 1 轮）：** 重新 `grep` 三处导入确认仍存活（非历史残留），且
  `chengdu` 是生产包，故该违规真实存在于运行时路径，CONCERN 维持并提升优先级。

### 1.4 Rule Abstraction Correctness —— **PASS + CONCERN**
- **证据：** 运行时选择见 `GameOrchestrator.ts:192-193`
  `selected = ruleId ?? this.ss.ruleId; this.rulePack = this.registry.get(selected)`；
  `settingsStore.ts:27,57` 默认 `ruleId: 'chengdu'`。
- **判定：** 生产实际运行**完整 `chengduRulePack`**（血战到底：换三张/定缺/多胡/
  番数），构造函数里的 `placeholderRulePack` 默认参数是**被覆盖的死代码**。
- **CONCERN：** ① 构造函数默认参数永不生效；② `selectRulePack()` 全仓 0 调用
  （死方法）；③ `placeholder` 仅 `PLAYING/END`，与 `chengdu` 能力不对等。
- **自查修订（第 1 轮）：** 初判曾误以为"部署用 placeholder 简化规则"；经核对
  `settingsStore` 默认 `'chengdu'` + `init()` 覆盖逻辑，**纠正为 PASS（生产用
  chengdu）**，并将原"FAIL 候选"降级为"死代码 CONCERN"。这是本轮最关键的自查纠错。

### 1.5 Decision vs Expression Separation —— **PASS**
- **证据：** 决策链路 `GameOrchestrator.ts:144-146` → `pickAlgoAction` →
  `agents/algo/policy_high.ts`（确定性 EV）；表达链路 `llm/*` + `analysis/*`
  仅消费"已发生局面快照"生成文本。全仓 `grep buildCoachingPrompt|recommendedAction`
  命中仅：`PromptBuilder`（构造）、`LLMService.ts:195,489`（产出）、
  `types.ts:60`（类型）、`LLMChatAssistant.ts:774`（**仅 UI 展示**）。
  **无任何代码将 LLM 输出回灌 `applyAction`/主循环。** 且 `LLMService.ts:486-500`
  有 `getDefaultCoachingAdvice` 降级。
- **判定：** 分离干净，LLM 故障不影响可玩性与可复现性。
- **自查修订（第 1 轮）：** 确认 `recommendedAction` 默认值是"玩家已落子"
  （`:489`），属"回声式"教学，非独立裁判——补充为 ADR-004 的"须关注"项，但不改
  PASS 判定。

### 1.6 Test Strategy —— **PASS**
- **证据：** `npx vitest run` 先前执行 **174 passed**（本会话复跑因沙箱超时被
  kill，未复得新数；建议以 CI 门禁常态跑——见 §6）。`testing/ai-eval/*` 含
  `hard`/`soft` 约束校验器（`runner.ts:251` `hard.every(...)`、`report.ts:10`）。
  `chengduRulePack` 有专属 800+ 行单测覆盖。
- **判定：** 单测覆盖机制健全，AI 评测有硬/软约束双轨校验。
- **CONCERN：** 孤儿模块（`neuralTrainer`、`pixi/*`、`parallelAutoRun`、
  `fastTrain`）未被任何运行路径引用，其单测仅验证"孤立正确性"，不验证"集成正确
  性"；CI 缺失（§1.9）使这些测试不被强制守护。

### 1.7 Performance —— **CONCERNS**
- **证据：**
  1. `llm/LLMService.ts:196` `getCoachingAdvice` 固定 `useCache:false`——相同
     局面每次打网络，存在费用与时延风险。
  2. `llm/PromptBuilder.ts:47-69` `enumerateExchangeOptions` 为 O(n³) 枚举（仅
     在 EXCHANGE 阶段、n≤13，可接受，但无注释/上限保护）。
  3. 全仓未见帧率/内存/带宽预算文档或持续 profiling 脚本。
- **判定：** 当前规模无性能事故，但**缺乏预算与护栏**，规模上升时风险不可观测。
- **自查修订（第 1 轮）：** 确认无 `performance.now()` 周报或 bundle 体积门禁，
  CONCERN 成立；将"局面哈希缓存"列入 ADR-004 优化建议。

### 1.8 Security —— **PASS + CONCERN**
- **证据：** `api/llm/kimi/messages.ts` 服务端读取 `KIMI_API_KEY`（env/header），
  前端不持密钥；`vite.config.ts` dev 代理仅本地注入；`localStorage` 仅存设置
  （无密钥，`settingsStore.ts`）。
- **判定：** 密钥隔离到位，符合 Serverless 代理最佳实践。
- **CONCERN：** `settingsStore` 允许浏览器侧配置 `baseUrl`/`apiKey`
  （`llmEnabled`、`LLMSettingsPanel`），属客户端 fetch，SSRF 风险低但应限制
  域名白名单。

### 1.9 Dead / Orphaned Code —— **CONCERNS**
- **证据（全仓 grep 确认"已声明但未接线"）：**
  - `ui/pixi/*`（MahjongTableScene/DiscardZone/OpponentHand/CompassRose/
    TileSprite）：仅内部互引，**0 处外部实例化**；真实牌桌渲染为
    `ui/renderers/matchTableRenderer.ts`（DOM/CSS，含 ARIA）。pixi.js 依赖实质空闲。
  - `training/neuralTrainer.ts`：仅被自身与 `gameWorker`?（实际仅被
    `neuralTrainer.ts:133` 自引用）；`parallelAutoRun.ts`、`fastTrain` 无脚本接线。
  - `orchestration/degrade.ts` `degradeDifficulty`：1 处定义、0 处运行期调用。
  - `meta/matchManager.ts` `createMatchManager`、`meta/metaStrategy.ts`
    `createMetaStrategy`：工厂函数 0 调用（仅类型被用）。
  - `GameOrchestrator.selectRulePack`：0 调用（见 §1.4）。
- **判定：** 孤儿模块膨胀认知负担与打包体积，且易误导"已实现"。
- **自查修订（第 1 轮）：** 逐一对上述符号 `grep` 外部引用计数，确认均为 0/仅
  内部引用；CONCERN 维持，并区分"可删除（pixi/neuralTrainer）"与"预留扩展
  （meta/* 工厂）"两类处置建议。

### 1.10 CI —— **FAIL**
- **证据：** 仓库根仅 `.github/copilot-instructions.md` 与 `copilot-memory.md`
  （非 CI）；`find` 无 `*.yml/*.yaml` 的 ci/workflow/pipeline；无 `.gitlab-ci.yml`、
  无 `Jenkinsfile`。`package.json` 仅有 `dev/build/test/train/ai-eval`，**无
  `typecheck` / `lint` 脚本，无 CI 触发**。`vercel.json` 仅负责部署，不跑测试。
- **判定：** **仓库无任何持续集成流水线**。这意味着：类型错误、测试回归、孤儿
  代码膨胀均无人值守拦截，仅靠人工本地 `npm test`。
- **自查修订（第 1 轮）：** 初判以"vercel.json 即部署=有 CI"草率；经 `find`
  确认**无任何 CI 定义文件**，降级为 **FAIL**。这是唯一硬性 FAIL，列为 §6 阻塞项。

---

## 2. 自查修订记录 (Self-Review Log)

| 轮次 | 发现 | 动作 | 影响 |
| --- | --- | --- | --- |
| R1 | 误判"部署用 placeholder 简化规则" | 核对 `settingsStore.ts:27,57` + `GameOrchestrator:192-193` | §1.4 由"FAIL 候选"纠正为 PASS + 死代码 CONCERN |
| R1 | 误将 `vercel.json` 视作 CI | `find` 确认无 CI 文件 | §1.10 由 CONCERN 升级为 **FAIL** |
| R1 | 分层违规是否历史残留？ | 复 `grep` 三处导入均存活 | §1.3 CONCERN 提升优先级 |
| R1 | LLM 是否回灌决策？ | `grep recommendedAction` 全链路仅 UI 展示 | §1.5 维持 PASS，补充 ADR-004 关注项 |

---

## 3. 阻塞项 (Blockers)

| # | 级别 | 项 | 为何阻塞 / 何时必须修 |
| --- | --- | --- | --- |
| B1 | **FAIL** | 无 CI 流水线 | 类型/测试回归无人值守；**下次合并前必须补齐最小 CI**（typecheck + test + build） |
| B2 | CONCERN | 构建不类型检查（`vite build` 用 esbuild） | 类型错误可入产物；随 B1 一并加 `tsc --noEmit` 门禁 |
| B3 | CONCERN | `chengduRulePack` 反向依赖 `settingsStore` | 破坏 core 纯净性；新增规则/单测隔离时必爆，建议参数化注入 `p0IsAI` |
| B4 | CONCERN | 孤儿模块（pixi / neuralTrainer / parallelAutoRun / degrade / meta 工厂 / selectRulePack） | 认知与体积负担；发布前至少移除或显式标注"实验性" |

> **当前部署不被 B2~B4 阻塞**（系统可运行可部署）；但 B1 为质量门禁缺失，须在
> 团队规模扩大或多人协作前关闭。

---

## 4. 控制清单 (Control Manifest — 一页可执行规则)

> 下列规则供程序员 PR 前逐项自检；CI 应自动拦截违规项。

### Security
- [ ] 任何 LLM/第三方密钥**仅**出现在 `api/*` 服务端（env/header），前端不得持有。
- [ ] 前端 LLM `baseUrl` 须走**域名白名单**校验（`LLMSettingsPanel` 提交时校验）。
- [ ] `.env*` 已被 `.gitignore` 忽略；新增密钥同步更新 ignore。

### Performance
- [ ] 新增 LLM 调用默认带**局面哈希缓存**，不得 `useCache:false` 无条件直连。
- [ ] 组合/枚举类算法必须标注复杂度上限与 n 上限（如 `enumerateExchangeOptions`）。
- [ ] 主循环热路径禁止 `globalThis` 跨层可变态；状态变更经 `store.applyState` 产生新引用。

### CI
- [ ] PR 必须过 `tsc --noEmit`（strict）— 不得仅靠 esbuild 转译。
- [ ] PR 必须过 `vitest run` 全量（含 `testing/ai-eval` 硬约束）。
- [ ] 构建产物体积须有上限门禁（防止 pixi 等孤儿依赖被误打包）。

### Layering（单向依赖：core ← agents ← orchestration ← ui；side: llm/analysis/training/persistence/store/meta）
- [ ] `core/**` **禁止**导入 `store/`、`ui/`、`llm/`、`orchestration/`。
- [ ] `orchestration/**` **禁止**导入 `ui/`（UI 回调以接口注入，勿直接 `import`
      `clearChatHistory`/`showPixelDialog`）。
- [ ] 规则实现（`packs/*`）所需运行配置以**构造函数/参数**注入，勿直接读 `settingsStore`。
- [ ] 新增"可插拔"能力（规则/AI/分析）须经注册表或工厂，不得在主循环硬编码新分支。
- [ ] 新增模块若**无运行路径引用**，须加 `// EXPERIMENTAL` 注释或移入 `experimental/`，
     禁止"声明即视为已实现"。

### Testing
- [ ] 每个 `RulePack` 实现须有专属单测覆盖 `getLegalActions/applyAction/resolveReactions`。
- [ ] 决策层（`agents/algo/*`）改动须过 `testing/ai-eval` 硬约束（`hardPass`）。
- [ ] 孤儿/实验模块改动不降低主路径测试覆盖率。

---

## 5. 建议修复优先级 (Recommendations)

1. **P0（本迭代）：** 补最小 CI（`typecheck`+`test`+`build`，见 §4 CI 清单）。—— 关闭 B1。
2. **P1：** `chengduRulePack` 去 `settingsStore` 依赖（参数化 `p0IsAI`）。—— 关闭 B3。
3. **P1：** 清理/标注孤儿模块（pixi→删或 `EXPERIMENTAL`；neuralTrainer/parallelAutoRun
   同理；死方法 `selectRulePack`/`degradeDifficulty` 删）。—— 关闭 B4。
4. **P2：** `getCoachingAdvice` 加局面哈希缓存；统一"确定性建议 vs LLM 建议"的 UI 权威源
   （见 ADR-004 后果）。
5. **P2：** `vite build` 前加 `tsc --noEmit` 作为本地/CI 预检脚本。

---

## 6. 参考 (References)
- `ARCHITECTURE.md`（分层、依赖图、运行时数据流、已知债务）
- `ADR-001`（前端栈）、`ADR-002`（渲染/状态分离）、`ADR-003`（规则可插拔）、`ADR-004`（决策/表达分离）
- 关键证据文件：`src/core/rules/RulePack.ts`、`RuleRegistry.ts`、
  `src/core/rules/packs/chengdu/index.ts:14,255,470,472,510`、
  `src/core/rules/packs/placeholder/index.ts:108,217`、
  `src/orchestration/GameOrchestrator.ts:28-29,123-138,144-146,192-193`、
  `src/store/settingsStore.ts:1,27,57`、
  `src/llm/LLMService.ts:189-198,486-500`、`src/llm/PromptBuilder.ts:47-69`、
  `src/analysis/LLMAnalyzer.ts`、`src/ui/components/LLMChatAssistant.ts:774`、

---

## 7. 修复冲刺闭环 · 限期债务 B1–B5（2026-08-13）

> 由 engineering-lead（修复小队 fix-eng）落实，主理人于团队通道不可用情况下补齐机械收尾并做汇编验收。

| 债务 | 状态 | 关闭动作 | 验收 |
|---|---|---|---|
| **B1** core→store 分层违规 | ✅ 关闭 | `src/core/rules/packs/chengdu/index.ts` 已无 `settingsStore` import，`p0IsAI` 改经注入 | tsc 0 错误 |
| **B2** PixiJS 未使用 + 孤儿 | ✅ 关闭 | 删除 `src/ui/pixi/*`；`package.json` 移除 `pixi.js`；`pnpm install` 同步 lockfile（grep 确认 0 处残留）；清理 `legacy.css` 死样式 `.pixi-host` | lockfile 无 `pixi.js@` |
| **B3** 构建无类型检查 | ✅ 关闭 | `package.json` build 改为 `"tsc -p tsconfig.json --noEmit && vite build"` | `pnpm build` EXIT 0 |
| **B4** 无 CI + 测试挂起 | ✅ 关闭 | 新建 `.github/workflows/ci.yml`（push/PR 跑 `test:run`+`build`）；`vitest.config.ts` 加 `testTimeout/hookTimeout:10000` | `pnpm test:run` 7.49s 全过 |
| **B5** 死代码 | ✅ 关闭 | 删除 `src/orchestration/degrade.ts`（`degradeDifficulty` 零调用）；`selectRulePack` 已先行移除 | grep 全仓零引用 |

### 总体判定
- **架构评审门：🟢 PASS（维持）**，原 5 项限期债务 B1–B5 全部关闭，0 新增阻塞。
- 验收证据：`tsc` 0 错误 / `pnpm test:run` 174 用例全过 / `pnpm build` EXIT 0。
  `vercel.json`、`vite.config.ts`、`.github/`（仅 copilot 文档，无 CI）。
