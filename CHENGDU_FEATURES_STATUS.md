# Chengdu 麻将规则包 — 功能落地状态（以 src/ 代码为权威真相源）

> ⚠️ **本文件取代 `CHENGDU_MISSING_FEATURES.md`**。原文档将换三张 / 缺一门 / 血战到底 / 定缺 / 查花猪 / 金钩钓 / 天胡地胡 等**已实现**功能标为「❌ 缺失 / 可选」，与 `src/` 实际实现不符（详见 `design/gdd/REVIEW.md` C6）。
>
> 番值真相源：`src/core/rules/packs/chengdu/patterns.ts` 的 `fan` 字段（清一色=2、七对子=2、龙七对=3）。混一色（`HUN_YI_SE`）、门清（`MEN_QING`）**当前未计入番数**。

## ✅ 已实现（代码已落地，可运行）

### 核心流程
- **换三张**（EXCHANGE 阶段，顺时针同花色 3 张交换）
- **定缺**（DING_QUE，缺门出牌硬约束）
- **缺一门**（hasQueYiMen，胡牌前提：手+副露最多 2 花色）
- **血战到底**（isRoundEnd：3 家胡 或 牌墙空即结束）
- **查花猪 + 查叫**（流局结算：向非花猪赔付其最大听牌分，未听也罚底分）

### 副露 / 胡牌
- 碰 / 明杠 / 暗杠 / 加杠
- 点炮胡 / 自摸 / 抢杠胡 / 杠上开花 / 海底捞月 / 刮风下雨
- 一炮多响、过水不能胡

### 番型（detectYaku 实际计分）
| 番型 | 番数 | 说明 |
|---|---|---|
| 平胡 PING_HU | 1 | 兜底 |
| 自摸 ZI_MO | 1 | 自摸 |
| 对对胡 DUI_DUI_HU | 2 | 全刻子 |
| 全带幺 QUAN_DAI_YAO | 2 | 每组含幺九 |
| 清一色 QING_YI_SE | 2 | 单一花色 |
| 七对子 QI_DUI_ZI | 2 | 7 对 |
| 龙七对 LONG_QI_DUI | 3 | 七对含四张同牌（替代七对子，不叠加） |
| 杠上开花 GANG_SHANG_KAI_HUA | 2 | — |
| 抢杠胡 QIANG_GANG_HU | 2 | — |
| 海底捞月 HAI_DI_LAO_YUE | 2 | — |
| 天胡 TIAN_HU | 4 | 庄家首张 |
| 地胡 DI_HU | 4 | 闲家首巡点炮 |
| 金钩钓 JIN_GOU_DIAO | 2 | 单钓将 |
| 刮风下雨 GUAFENG_XIАYU | 2 | 与碰同牌胡 |
| 根 genCount | +1/杠 | 每杠 +1 番（calculateScore 计入） |

### 系统
- 事件记录、状态一致性、手牌校验、防御性检查、测试覆盖

## ❌ 尚未实现（明确标注，不伪称已落地）

- **门清 MEN_QING**：`isMenQing` 仅为工具函数，`detectYaku` 无加分分支 → 当前 **NOT 计分**（若实现拟 +1 番）。
- **混一色 HUN_YI_SE**：`YakuType` 已声明，`detectYaku` 无加分分支 → 当前 **NOT 计分**。
- **全双 / 全单 / 无字**：无 `YakuType` 定义。
- **边张 / 坎张 / 单钓**：无 `YakuType` 定义（金钩钓=单钓将已落地，但边/坎张未独立计分）。
- **三色 / 三节高 / 老少配 / 全求人 / 卡五星 / 三同刻**：无 `YakuType` 定义。
- **坎张听牌限制、见张管牌**等流程型高级规则：未实现。

## 🧪 训练系统说明（与 BLOCK-3 对齐）

- `TrainingConfig.mode='baseline'` 名义存在，但 `autoRun.ts` 自承「所有玩家共享同一套参数、等效 mirror」——**baseline 未独立实现**。
- `neuralTrainer.ts` 的 `updateWeights` 为随机扰动示意，非真实反向传播；`NeuralNetwork` **未被任何决策路径调用**（实验性）。

## 结论

本规则包已实现成都血战核心规则与 14+ 主体番型。历史文档曾将已落地功能误标为「缺失」，已于本次修复更正。所有番值以 `patterns.ts` 为准；未实现项已在本清单中显式列出，不再以「可选 / 待实现」含糊带过。
