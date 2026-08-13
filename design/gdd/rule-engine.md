# 系统设计文档 — S1 规则引擎（RulePack / chengdu 包）

> 源码依据：`src/core/rules/{RulePack,RuleRegistry,validation/types}.ts`、`src/core/rules/packs/chengdu/*`、`src/core/model/*`、`src/store/settingsStore.ts`
> 权威真相：本系统以 `src/` 代码为准；文档番型数值与代码冲突处已在 §6、§7 与 REVIEW.md 标注。

## ① 概述与目标
为「成都麻将（血战到底）」提供**确定性的、可重放的规则内核**。目标：
- 用统一 `RulePack` 接口抽象不同规则集，当前落地 `chengdu` 包（另有 `placeholder` 框架占位包）。
- 提供：合法动作枚举 `getLegalActions`、状态迁移 `applyAction`、并发响应结算 `resolveReactions`、回合结束判定 `isRoundEnd`、终局结算 `settleRound`、可选出牌校验器 `getDiscardValidator`。
- 保证 108 张数牌（万 W / 条 B / 筒 T，各 1–9）的牌池与「缺一门 + 血战到底 + 换三张 + 定缺」的成都特色可正确推进与结算。

`rule.config.ts` 报告版本 `'0.1.0-skeleton'`，提示该包虽功能较完整但仍自标记为骨架态。

## ② 核心机制 / 玩家动词
阶段机：`EXCHANGE → DING_QUE → PLAYING → END`（`index.ts:449,503,524,1283`）。
玩家动词（Action 联合类型，`src/core/model/action.ts`）：
- `EXCHANGE_SELECT`（换三张：选 3 张同花色）/ `EXCHANGE_CONFIRM`（遗留兼容，直接触发原子交换）
- `DING_QUE`（选缺门花色 W/B/T）
- `DRAW`（摸牌，由编排层驱动）/ `DISCARD`（出牌，受 ding-que 硬约束）
- `PENG`（碰，无吃）/ `GANG`（MING 明杠 / AN 暗杠 / JIA 加杠）
- `HU`（点炮胡 / 自摸 / 抢杠胡 / 刮风下雨胡）/ `PASS`（过）
关键规则动词语义：
- **换三张**：顺时针传递同花色 3 张（`performExchange`, `index.ts:283-322`）。
- **定缺**：选定缺门后，**手中有缺门牌时只能打缺门牌**（`getLegalActions` 过滤逻辑 `index.ts:651-669`）。
- **缺一门**：胡牌须 `hasQueYiMen`（最多 2 花色）。
- **血战到底**：`isRoundEnd` 在「牌墙空 或 已胡≥3 家」为真（`index.ts:1283-1291`）。
- **一炮多响 / 过水不能胡**：`resolveReactions` 收集多人 `HU`；可胡却 `PASS` 者置 `passedHuPlayers` 直至下次摸打解除（`index.ts:1095-1111, 908-912`）。
- **刮风下雨**：杠钱即时结算（`applyGangRainMoney`：暗杠收全员各 10、明杠收点杠人 10、加杠收原碰家 5，`index.ts:105-138`）。

## ③ 系统依赖
- 上游：`core/model`（Tile/State/Action/Event/PlayerId）、`store/settingsStore`（读取 `p0IsAI` 决定换张/定缺阶段是否由 AI 代选 `index.ts:255,472,510`）、`config/testConfig`（`trainingMode` 关日志）。
- 下游被依赖：S2 可解释 AI、S6 编排层、S4 训练系统（均直接调用 `RulePack` 跑局）。
- 同层：`validation` 提供 `ChengduDiscardValidator`（ding-que 出牌合法性）。

## ④ 关键数据结构 / 状态
- `GameState`（`src/core/model/state.ts`）：`wall/hands/discards/melds/lastDiscard/declaredHu/currentPlayer/phase/turn`。
- `ChengduState = GameState & { lastGangPlayer?; isAfterGang?; lastAddedGangTile?; pendingEvents?; lastPengTile?; roundScores?; dealInStats?; exchangeSelections?; exchangeConfirmed?; dingQueSelection?; passedHuPlayers? }`（`index.ts:219-234`）。
- `DealInStat = {count, stageB, stageC}`：`stageB/C` 标记放炮发生时的血战阶段（A 无人胡 / B 他人胡 / C 自己已胡），用于结算与训练惩罚。
- `RoundResult = {scores: Record<PlayerId,number>, dealIns: Record<PlayerId,DealInStat>}`（`RulePack.ts`）。
- `YakuType` 14+ 类（`patterns.ts:27-43`）：含 `PING_HU/DUI_DUI_HU/QING_YI_SE/HUN_YI_SE/QUAN_DAI_YAO/QI_DUI_ZI/LONG_QI_DUI/GANG_SHANG_KAI_HUA/QIANG_GANG_HU/HAI_DI_LAO_YUE/TIAN_HU/DI_HU/ZI_MO/JIN_GOU_DIAO/GUAFENG_XIАYU`。

## ⑤ 核心流程 / 算法
1. **建初始局** `buildInitialState`：`shuffle(getTileSet(), seed)`（crypto 高质量随机 / 训练种子可复现 `index.ts:358-378`）；发牌 13×4 + 庄家摸 1；`phase=EXCHANGE`（`index.ts:392-458`）。
2. **合法动作** `getLegalActions`：按 `phase` 分支；PLAYING 阶段对响应者计算可 `HU/PENG/GANG`（结合缺门与过水），对当前行动者结合向听计算自摸/刮风下雨/暗杠/加杠，并施加「有缺门牌只能打缺门」过滤（`index.ts:460-679`）。
3. **状态迁移** `applyAction`：换张/定缺/暗杠/加杠/出牌/自摸胡 各自分支，先校验后修改（牌墙空、手牌数、是否有对应碰），失败返回原状态（`index.ts:681-969`）。
4. **并发响应结算** `resolveReactions`：抢杠胡优先；否则按 `HU > GANG > PENG > 过` 优先级裁决，计算过水标记与得分，推进至下一未胡玩家（`index.ts:975-1281`）。
5. **终局结算** `settleRound`：仅牌墙摸完（`wall.length===0 && huCount<3`）触发 `applyDrawSettlement`——查花猪（向每个非花猪赔付其最大听牌分，未听也罚底分 5）、查叫（未听向听牌者赔付）（`index.ts:1293-1409`）。
6. **计分** `calculateScore(yakuList, genCount) = 5 * 2^(totalFan-1)`（`patterns.ts`），`genCount` 为杠数（根）。

## ⑥ 参数与平衡
- **番型基础分**（`patterns.ts` 权威，grep 实测）：
  - 平胡 1、自摸 1、对对胡 2、全带幺 2、清一色 **2**、七对子 **2**、龙七对 **3**、杠上开花 2、抢杠胡 2、海底捞月 2、天胡 4、地胡 4、金钩钓 2、刮风下雨 2。
  - ⏹ 历史冲突已消除（2026-08-13 全量修复冲刺）：原 `CHENGDU_RULES_COMPLETE.md:39`=6 番、`CHENGDU_MISSING_FEATURES.md:15`=6 番、`PromptBuilder:168` 文案=3 番；**七对子** 原文档=4；**龙七对** 原文档=5。现两份 CHENGDU_*.md 已校准为 patterns.ts 值；仅 `PromptBuilder.ts:168` 文案（src 侧）待 engineering-lead 修复。
  - **混一色 `HUN_YI_SE`**：在 `YakuType` 声明但 `detectYaku` 无加分分支（**未计分**）；`CHENGDU_RULES_COMPLETE.md` 已更正为「未计分（待实现）」。
  - **门清 `MEN_QING`**：代码未实现为番型（`isMenQing` 仅为工具函数）；`CHENGDU_RULES_COMPLETE.md` 已更正为「尚未实现为番型」；`PromptBuilder:168` 文案「门清+1番」（src 侧）待 engineering-lead 修复。
- **杠钱**：暗杠 10/人、明杠 10/点杠人、加杠 5/原碰家（`index.ts:113-137`）。
- **血战结束**：3 家胡 或 牌墙空（`index.ts:1283-1291`）。

## ⑦ 异常 / 边界处理
- 牌墙空仍能摸牌的防御：`applyAction` 暗杠/明杠前检查 `wall.length===0`（`index.ts:783,1206`）。
- 加杠须有对应 `PENG`（`index.ts:840-845`）。
- 碰后限制：不可立即打出刚碰的牌（`lastPengTile`，`index.ts:895-898`）。
- `validateHandSize` 警告模式（不阻塞，便于调试，`index.ts:236-242`）。
- 编排层兜底：死锁守卫（PASS-only 恢复动作）、无限循环检测（连续 10 次同状态哈希强制推进，见 S6 §7）。
- 过水不能胡的 `passedHuPlayers` 在玩家完成「摸+打」后清除（`index.ts:908-912`）。
- 流局结算仅在牌墙摸完触发，3 家胡结束**不**触发查叫（避免重复结算，`index.ts:1299-1304`）。

## ⑧ 验收标准
- [x] 四阶段状态机可完整推进至 `END`，牌墙空或 3 家胡即结束。
- [x] 换三张同花色校验、定缺缺门硬约束、缺一门胡牌前提均可被代码强制。
- [x] 碰/三种杠/点炮/自摸/抢杠/杠上开花/海底/刮风下雨得分与番型判定（除 `HUN_YI_SE` 未计分、`MEN_QING` 未实现）由 `detectYaku` 覆盖。
- [x] 一炮多响、过水不能胡、查花猪 + 查叫流局结算可运行。
- [ ] **（阻塞项）** 番型分值与文档统一：建立单一真相源（`patterns.ts` 为代码权威，但需修订 `CHENGDU_RULES_COMPLETE.md`、`CHENGDU_MISSING_FEATURES.md`、`PromptBuilder` 文案三处不一致）；明确 `HUN_YI_SE` 是否计分、`MEN_QING` 是否实现。
- [ ] `rule.config.ts` 版本 `'0.1.0-skeleton'` 应在功能稳定后升版并补测试覆盖说明。
