# Changelog

本项目的所有重要变更都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-14

首个公开测试版。本轮覆盖 Phase 2–6：设计/架构文档体系补齐、规则引擎正确性修复、
资产清理、渲染管线与可访问性修正、音频 MVP 落地。

### 新增 (Added)
- **设计文档体系**（`design/gdd/`）：6 个系统的八节 GDD（规则引擎、可解释 AI、LLM 教学层、训练系统、分析画像、对局编排与 UI）+ 系统全景 INDEX + 跨 GDD 一致性评审。
- **架构文档体系**（`docs/architecture/`）：主架构文档 + ADR-001~004（前端栈、渲染/状态分离、RulePack 规则抽象、LLM 表达/决策分离）+ 架构评审。
- **可访问性规格**（`design/accessibility/`）：Basic/Standard/Comprehensive 三级定义、特性矩阵与改进路线图。
- **音频设计规格**（`design/audio/`）与**音频 MVP**：纯 Web Audio 程序化合成引擎（Master→SFX/BGM/Voice 总线 + 限幅），10 条音效（出牌/碰/杠/胡/结算胜负/流局/正误反馈/UI 点击），全部零二进制资产。
- **音频设置面板**：总开关 + 三路音量滑块 + 减弱动效开关，中英双语；设置持久化并兼容旧存档。
- **可访问性播报区**：match 页 aria-live 文字播报通道（满足 A11Y-S2），音效均带视觉/文字孪生。
- **6 色 LUT 运行时色彩重映射**（`src/ui/tilePalette.ts`）：原色/高对比/红色盲/绿色盲/蓝色盲 5 种模式，无需生成变体资产。
- **Playtest 测试体系**：headless 对局 harness + 3 轮 41 用例（核心循环不变量、边界计分、难度与教学准确性）。
- **CI 工作流**（`.github/workflows/ci.yml`）：push/PR 自动跑测试与构建。
- **资产审计**（`design/art/ASSET_AUDIT.md`）与**性能基线**（`docs/performance/bench-before.json`）。

### 修复 (Fixed)
- **规则引擎 2 个 P0（致命）**：
  - 加杠后 `getLegalActions` 仅返回 PASS 导致活锁 → 补抢杠胡响应窗口 + 加杠者补摸（杠上开花判定）。
  - `getLegalActions` 与 `applyAction` 契约不一致（碰后打碰牌空转卡死）→ 非法动作返回带 `rejected` 标记的新对象，绝不静默返回同一引用。
- **规则引擎 4 个 P1（教学正确性）**：
  - `isTenpai` 硬编码 13 张 → 加 `meldCount` 参数（13 − 副露×3），副露玩家流局不再被误判"大叫"倒扣分。
  - 清七对/清龙七对清一色不叠加（七对分支提前 return）→ 修正为正确叠加（清七对 4 番、清龙七对 5 番）。
  - 清一色判定不计副露花色 → `detectYaku` 并入副露，消除"假清一色"多送 2 番。
  - "刮风下雨"标识符含西里尔字母 А(U+0410) 导致讲解输出"未知番型" → 统一为纯拉丁 `GUAFENG_XIAYU`。
- **渲染管线**：牌面 4 个缩放档位宽高比全部对齐源图 20:28；xs 档 5 种显示尺寸统一；关闭对像素画的错误平滑（删除"先模糊再锐化"的自相矛盾管线）。
- **可访问性硬失败**：条子墨色 `#6abe30` 对比度 2.33:1（不达 WCAG 3:1）→ 换 `#4b692f`（6.25:1 达标）。

### 变更 (Changed)
- **构建门禁**：`pnpm build` 现在先跑 `tsc --noEmit` 再做 `vite build`，类型回归无法悄悄上线。
- **难度梯度**：high/mid/low 三档真正分流（此前 mid/low 降级后仍走 high）。
- **训练系统去伪**：`baseline` 模式明确即 mirror（未独立实现）；神经网络模块标注"实验性、未接入决策路径"。
- **像素牌缓存**：改为 LRU（上限 320 条），单会话内存有硬约束。

### 移除 (Removed)
- **孤儿资产清理**：删除 `resource/png/` 42 张未引用的高清矢量牌面（与像素美术语言不兼容）+ 根目录 2 张开发期截图，回收约 3 MB。
- **未使用的 PixiJS 依赖**与 `src/ui/pixi/` 孤儿代码。
- **死代码**：`src/orchestration/degrade.ts`（零调用的 `degradeDifficulty`）等。
- README 失效的预览图引用。

### 已知问题 (Known Issues)
- 英文模式不渲染牌面图片（`lang === 'zh'` 才渲染），英文界面退化为文本牌——列入下一版本。
- 完整 BGM、教练语音朗读、空间化 3D 音未纳入 MVP（音频总线已预留接口）。
- 完整性能剖析报告待补（基线 `bench-before.json` 已存）。
- favicon 未提供。
