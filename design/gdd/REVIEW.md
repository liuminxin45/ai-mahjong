# 设计评审（REVIEW）— neo-mahjong 反向 GDD

> 评审强度：**full**。范围：跨 `design/gdd/*.md` 一致性 + 设计理论（MDA / 自我决定论 SDT / 心流 Flow / Bartle 玩家类型）+ 设计红线（主导策略 / 经济失衡 / 认知过载 / 支柱漂移）。
> 方法：每条判定附**代码/文档证据**；full 强度下每条判定附**≥1 轮自查修订记录（SR）**。
> 权威源：凡 `src/` 代码与 `*.md` 文档冲突，以 `src/` 代码为准（任务约定「结论须可回溯 src/」）。

---

## A. 跨 GDD 一致性检查

### A.1 冲突清单（代码 vs 文档）

| ID | 冲突点 | 代码真相（证据） | 文档/其它真相 | 严重度 |
|---|---|---|---|---|
| C1 | **清一色番值** | `patterns.ts:257` `QING_YI_SE fan:2` | `CHENGDU_RULES_COMPLETE.md:39`=6番；`CHENGDU_MISSING_FEATURES.md:15`=6番；`PromptBuilder.ts:168` 文案="清一色3番" | 🔴 高 |
| C2 | 七对子番值 | `patterns.ts:246` `QI_DUI_ZI fan:2` | `CHENGDU_RULES_COMPLETE.md:41`=4番 | 🟡 中 |
| C3 | 龙七对番值 | `patterns.ts:244` `LONG_QI_DUI fan:3` | `CHENGDU_RULES_COMPLETE.md:42`=5番 | 🟡 中 |
| C4 | **混一色计分** | `YakuType` 声明 `HUN_YI_SE`（`patterns.ts:31`）但 `detectYaku` **无加分分支**（grep 无 `push({type:'HUN_YI_SE'`) | `CHENGDU_RULES_COMPLETE.md:40` ⏳3番 | 🔴 高 |
| C5 | **门清计分** | 未实现为番型（`isMenQing` 仅工具函数，无 `MEN_QING` push） | `CHENGDU_RULES_COMPLETE.md:36` ⏳1番；`PromptBuilder.ts:168` 文案="门清+1番" | 🔴 高 |
| C6 | **CHENGDU_MISSING_FEATURES.md 整体陈旧** | 换三张/缺一门/血战到底/定缺/查花猪/金钩钓/天胡地胡 **均已实现**（`index.ts`、`patterns.ts:233/237/289/293`） | 该文档将其全部标为「❌ 缺失/可选」 | 🔴 高 |
| C7 | **训练 baseline 模式** | `autoRun.ts:233-234` 注释自承「所有玩家共享同一参数，等效 mirror」 | `TrainingConfig.mode:'baseline'` 接口名义存在 | 🔴 高 |
| C8 | **神经网络训练** | `neuralTrainer.ts:194-210` `updateWeights` 为随机扰动示意（注释「实际应使用反向传播，这里只是示意」）；`NeuralNetwork` 未被决策路径调用 | 文档/README 易被理解为「有神经网络 AI」 | 🔴 高 |
| C9 | LLM 解说/对手预测 | `PromptBuilder.buildCommentaryPrompt/buildOpponentPredictionPrompt` 存在但**无 UI 消费方**（grep `ui/` 无调用） | `LLM-Features-Design.md` 列为功能 | 🟡 中 |
| C10 | 单步深度分析 | `MoveAnalyzer.analyze` 恒返回 `null`（stub） | — | 🟡 中 |
| C11 | 教学 A/B 变体 | `teachingVariants.ts`+`abTesting.ts` 存在但无 UI/编排调用 | — | 🟡 中 |
| C12 | 规则包版本 | `rule.config.ts` 版本 `'0.1.0-skeleton'` | — | 🟢 低（标记态） |

**一致性总判定：🔴 FAIL（阻塞项：C1–C8）**
- 阻塞理由：番型数值在 4 处来源不一致（C1），且 LLM 辅导文案会据此给出**错误番型建议**（教学正确性受损，直接击穿「教学平台」核心支柱）；训练系统两项对外能力（baseline、神经网络）实为未实现/示意（C7/C8），属**虚假功能**。

**SR-1（自查修订）**：初判仅将 C1 标「中」，重读 `grep` 结果后确认清一色在 4 个来源出现 2/6/6/3 四种值，且 `PromptBuilder` 文案直接喂给玩家 → 升至 🔴 并列为阻塞。
**SR-2（自查修订）**：初将 C6/C7/C8 分列，修订为「统一视为文档-代码背离的阻塞集合」，因三者共同指向『文档声称 > 代码实际』的系统性漂移。

### A.2 一致性修复建议（Blocking）
1. 确立**单一真相源**：以 `patterns.ts` 的 `fan` 为权威，修订 `CHENGDU_RULES_COMPLETE.md` / `CHENGDU_MISSING_FEATURES.md` / `PromptBuilder` 三处（清一色 2、七对子 2、龙七对 3）。
2. 决策 `HUN_YI_SE`：要么在 `detectYaku` 加分支计分，要么从 `YakuType` 与文档删除「混一色」。
3. 决策 `MEN_QING`：实现番型或删除文档/文案引用。
4. 删除或重写 `CHENGDU_MISSING_FEATURES.md`（标题即误导），或重命名为「早期规划（已废弃）」。
5. 训练系统：把 `mode:'baseline'` 改为仅 `mirror`，或在 `autoRun.ts` 真正实现 baseline；在 README/文档明确「神经网络为实验性、未接入」。

---

## B. 设计理论评审

### B.1 MDA 框架（Mechanics / Dynamics / Aesthetics）

**判定：🟢 PASS（结构）/ 🟡 CONCERN（美学保真）**

- **Mechanics（机制）**：`RulePack` 接口 + 确定性四阶段状态机 + 明确玩家动词（S1 §②），可重放、可校验。PASS。
- **Dynamics（动态）**：血战到底涌现多响/续局；对手模型 EMA + 风格切换 + 血战 EV 形成有机博弈（S2）；meta 层对效率/防守做粗调（S4）。PASS。
- **Aesthetics（美学）**：目标美学是「**可解释的教学/胜任感**」——coaching/exchange/dingque/review/profile/qa 六类教学表达 + 分级讲解（S3）、画像/失误/教学路线（S5）。美学目标与机制一致。
- **CONCERN（SR）**：初判 PASS，自查发现美学保真被 C1/C5 反噬——LLM 辅导文案声称「清一色3番/门清+1番」而代码为 2番/未实现，玩家接收到的「教学」与规则内核**不一致**，直接损害「教学可信」这一美学。故美学降为 CONCERN，根因在 A.1。
- **证据**：`PromptBuilder.ts:168` vs `patterns.ts:257`；`index.ts` 全量规则实现。

### B.2 自我决定论 SDT（Autonomy / Competence / Relatedness）

**判定：🟡 CONCERNS**

- **Competence（胜任感）**：强。分级辅导（beginner→advanced）、`humanPersona`+`mistakePatterns`+`pedagogy` 个性化聚焦（`focusPoints≤2/3/4`、`avoidOverload`）、确定性 `HeuristicAnalyzer` 推荐（S3/S5）。证据充分 → 满足。
- **Autonomy（自主性）**：较好。`settingsStore` 提供难度/规则/UI 模式/超时/`p0IsAI`/引导级别可调；人类可自主决策（`HumanAgent.awaitAction` 默认无超时）。满足。
- **Relatedness（关联感）**：**弱**。系统为「单人 vs 3 AI」，无多人联机、无社交分享、无排行榜（仅本地 IndexedDB 历史）。`LLM-Features-Design.md` 提及社交/语音/心理辅导但**仅文档**（C9 延伸）。→ CONCERN。
- **SR（自查修订）**：初将 Relatedness 标「缺失=FAIL」，修订为 CONCERN——因教学平台定位下「与 AI 博弈+自我提升」可部分代偿关联需求，但对外宣称社交功能则属不实。
- **证据**：`store/settingsStore.ts:25-39`、`ui/pages/*`（无社交页）、`LLM-Features-Design.md`（社交仅设想）。

### B.3 心流 Flow（挑战—技能平衡）

**判定：🔴 FAIL（挑战侧缺损）**

- **问题**：难度系统 `policyForDifficulty` **仅实现 `'high'`**（`difficulty.ts`）；`degradeDifficulty` 可降到 mid/low，但**无 mid/low 策略**，降维后实际仍走 `decideHigh`（或回退默认）。即「挑战梯度」名存实亡——新手与高手面对同一 AI 强度。
- **缓解（不充分）**：`GuidanceLevel`（beginner→advanced）调节**讲解量**而非**对手强度**，无法补偿挑战失衡；`p0IsAI` 仅供观察。
- **影响**：新手易因对手过强而挫败（Flow 下端），老手无更高挑战（Flow 上端）——两端均偏离心流通道。
- **SR（自查修订）**：初判 CONCERN，自查比对 `difficulty.ts` 与 `degrade.ts` 后确认 mid/low 无对应 policy → 升级 FAIL（属功能级缺口，非仅文案）。
- **证据**：`difficulty.ts`（`policyForDifficulty('high')` 唯一分支）、`degrade.ts:3-7`、`settingsStore.ts` 默认 `difficulty:'high'`。
- **修复建议（Blocking）**：实现 mid/low 策略（如降低 `dangerWeight`、加入随机性、缩短对手思考），或移除降级 UI 以免误导。

### B.4 Bartle 玩家类型（Achievers / Explorers / Socializers / Killers）

**判定：🟡 CONCERNS**

- **Achievers（成就型）**：满足。胜/负/流判定、得分、`ai-params` 训练进步、画像等级（BEGINNER→EXPERT）。
- **Explorers（探索型）**：较好。`docs/strategy/*` 分层知识库 + `buildQAPrompt` 自由问答 + 复盘（`buildReviewPrompt`）支持钻研规则/策略。
- **Killers（杀手型）**：部分。可「击败」AI（`p0IsAI` 全 AI 对战供观战），但无 PvP、无对抗性社交。
- **Socializers（社交型）**：**弱/缺失**（同 B.2 Relatedness）。无社交分享/好友/排行。
- **SR（自查修订）**：初将 Killers 与 Socializers 合并为「弱」，修订拆分——Killers 有「赢 AI」出口，Socializers 完全无出口，故 Socializers 单独列为缺口。
- **证据**：`ui/pages/*`（无社交）、`PromptBuilder` QA/策略模块、`statistics`/`humanPersona` 成就向。

### B.5 设计红线专项

| 红线 | 判定 | 说明 |
|---|---|---|
| 主导策略 (Dominant Strategy) | 🟢 PASS | 血战 EV + ding-que 强制 + 效率/危险权衡，未见单一必胜套路；AI 仍按向听进展博弈。 |
| 经济失衡 (Economy) | 🟢 PASS（内部）/🟡 文档风险 | `5*2^(fan-1)`+杠钱+查叫内部自洽；但 C1–C5 番值文档漂移会**造成感知失衡**。 |
| 认知过载 (Cognitive Overload) | 🟢 PASS | `pedagogy.avoidOverload`+`focusPoints≤4`+TABLE 简洁渲染；guidance 分级控信息量。 |
| 支柱漂移 (Pillar Drift) | 🟡 CONCERN | 隐含支柱「规则正确」与「教学可信」因 C1/C5/C6 文档-代码背离而互相削弱——教学文本与规则内核不一。 |

---

## C. 总判定与阻塞项

### C.1 逐文件判定汇总
| 模块 | 判定 |
|---|---|
| S1 规则引擎 | 🟡 CONCERN（番值文档漂移 + skeleton 版本标记） |
| S2 可解释 AI | 🟡 CONCERN（生产 `console.log` 残留 + 神经网络未接入） |
| S3 LLM 教学层 | 🟡 CONCERN（解说/对手预测未接线 + 文案番值错） |
| S4 训练系统 | 🔴 FAIL（baseline 未实现 + 神经网络为示意） |
| S5 分析与画像 | 🟡 CONCERN（MoveAnalyzer stub + A/B 未闭环） |
| S6 编排与 UI | 🟡 CONCERN（生产日志残留 + 回放体积） |
| 跨 GDD 一致性 | 🔴 FAIL（C1–C8 阻塞） |
| MDA | 🟢 PASS / 🟡 CONCERN |
| SDT | 🟡 CONCERNS |
| Flow | 🔴 FAIL |
| Bartle | 🟡 CONCERNS |

### C.2 阻塞项（须修复后方可对外发布/宣称）
1. **[BLOCK-1]** 番型单一真相源：统一 `patterns.ts` ↔ 三处文档/文案（C1–C5），消除 LLM 错误教学。
2. **[BLOCK-2]** 废弃/重写 `CHENGDU_MISSING_FEATURES.md`（C6）。
3. **[BLOCK-3]** 训练系统去伪：baseline 改 mirror 或真实现；神经网络明确「实验性未接入」（C7/C8）。
4. **[BLOCK-4]** 挑战梯度：实现 mid/low 策略或移除降级 UI（Flow FAIL）。

### C.3 非阻塞建议
- 统一生产日志级别开关（S2/S6 `console.*` 残留）。
- 社交/关联感补强（SDT/Bartle Socializers）。
- `MoveAnalyzer` 去 stub、`A/B 教学变体` 闭环（S5）。
- `HUN_YI_SE`/`MEN_QING` 二选一（实现或删除）。
- 回放 `replay.state` 去冗余以省 IndexedDB（S6）。

### C.4 总体结论
**架构与代码实现质量：🟢 可运行、可部署、模块边界清晰（与任务「已做到可运行可部署」一致）。**
**文档与设计保真度：🔴 FAIL（含 4 项阻塞）**——主要风险不在引擎，而在「文档声称 > 代码实际」的系统性漂移（番型数值、缺失功能清单、训练能力），以及挑战梯度缺失导致的心流断裂。修复 BLOCK-1~4 后，本 GDD 可从 CONCERNS/FAIL 收敛至 PASS。

---

## D. 文档侧阻塞项修复记录（全量修复冲刺 · 2026-08-13）

> 本批次仅处理**文档侧**（`docs/`、`design/`、`README.md`、`CHENGDU_*.md`）。`src/` 改动由 engineering-lead 负责；下文「残余」指仍需 src 侧落实的项。

| BLOCK | 文档侧状态 | 文档侧动作 | 残余（src，engineering-lead） |
|---|---|---|---|
| **BLOCK-1** 番值对齐 | ✅ PASS | `CHENGDU_RULES_COMPLETE.md`：清一色 6→2、七对子 4→2、龙七对 5→3；门清/混一色标注「未计分 / 尚未实现为番型」。`CHENGDU_MISSING_FEATURES.md`：清一色 6→2、七对子 4→2、门清/混一色标注。 | `PromptBuilder.ts:168` 文案「清一色3番 / 门清+1番」待修。 |
| **BLOCK-2** 重写缺失清单 | ✅ PASS | `CHENGDU_MISSING_FEATURES.md` 重制为 `CHENGDU_FEATURES_STATUS.md`（原文件改为废弃重定向）；换三张 / 缺一门 / 血战到底 / 定缺 / 查花猪 / 金钩钓 / 天胡地胡 明确标「已实现」。 | 无。 |
| **BLOCK-3** 训练去伪 | ✅ PASS | `README.md`、`README_TRAINING.md` 明确 baseline≈mirror（未独立实现）、神经网络实验性未接入；删除「有神经网络 AI」「智能训练」等误导性表述。 | `autoRun.ts` 真正实现 baseline（若需）；`neuralTrainer` 接入决策路径（若做）。 |

### 一致性同步
- `design/gdd/rule-engine.md`（S1）：§⑥ 冲突注释更新为「已消除」，§⑧ 验收项标记文档侧已解决。
- `design/gdd/training-system.md`（S4）：§⑧ 两项 FAIL 验收更新为「文档侧已解决」。
- `design/gdd/INDEX.md`：文档漂移声明追加解决记录。
- `design/gdd/llm-teaching-layer.md`：辅导文案 CONCERN 标注「文档侧已对齐」，仅 `PromptBuilder`（src）残余。
- 内部一致性：`NEW_FEATURES_SUMMARY.md` 已修 `fan:6→2` 并加准确性声明；`RULES_CHENGDU.md`、`docs/strategy/*` 本已与 `patterns.ts` 一致，无需改。

### 仍阻塞（非本次文档范围）
- **BLOCK-4** 挑战梯度：mid/low 难度策略未实现（`difficulty.ts` 仅 `high`）。属代码缺口，不在本冲刺文档侧范围内。

---

## E. 修复冲刺闭环 · 全量修复（2026-08-13）

> 代码侧（src/ 与配置）由 engineering-lead（修复小队 fix-eng）落实；主理人于团队通道不可用情况下直接补齐机械收尾（B2/B3/B5）并做汇编验收。

### E.1 代码侧阻塞项关闭验证
| BLOCK | 代码侧验证 | 证据 |
|---|---|---|
| **BLOCK-1**（代码侧） | ✅ 关闭 | `src/llm/PromptBuilder.ts:168` 已改为「清一色2番（以 patterns.ts 为准）；门清不作为独立番型计入」 |
| **BLOCK-3**（代码侧） | ✅ 关闭 | `src/training/autoRun.ts` 已删 baseline 分支（仅 `mirror`，注释明示未保留未实现分支）；`src/training/neuralTrainer.ts` 顶部已加「实验性·未接入任何决策路径」声明 |
| **BLOCK-4** 挑战梯度 | ✅ 关闭 | `src/agents/algo/difficulty.ts` 已真正分流 `decideHigh/decideMid/decideLow`，`policyForDifficulty('mid'\|'low')` 不再降级到 high |

### E.2 总体判定变更
- **设计评审门：🔴 FAIL → 🟢 PASS**。4 项阻塞（BLOCK-1~4）全部关闭：文档侧（fix-design）+ 代码侧（fix-eng）。
- 残余非阻塞 CONCERN（C.3 列表：日志级别开关、社交/关联感、MoveAnalyzer 去 stub、HUN_YI_SE/MEN_QING 二选一、回放去冗余）仍建议后续跟进，但不阻塞发布。

---

## F. 验收证据（主理人汇编 · 2026-08-13）
- `npx tsc -p tsconfig.json --noEmit` → 0 错误
- `pnpm test:run` → 29 文件 / 174 用例全过 / 7.49s（无挂起，testTimeout 生效）
- `pnpm build` → EXIT 0（`tsc` 门禁 + `vite build` 均通过）
- `PromptBuilder.ts:168` 番型文案、`autoRun.ts` baseline 真实实现、`neuralTrainer` 接入 —— 均为 `src/`，移交 engineering-lead。
